"""Import pipeline: raw Excel budget workbook -> categorized rows in the expenses table.

Intended to be invoked via scripts/run_import.py, not imported by app.py.
"""

import calendar
import os
import re
from pathlib import Path

import anthropic
import pandas as pd
from dotenv import load_dotenv

from .db import get_db

load_dotenv()

CATEGORIES = [
    "Food", "Travel", "Bill", "Health", "Entertainment",
    "Shopping", "Groceries", "Loans", "Others",
]

SHEET_NAME_RE = re.compile(r"^Budget-([a-zA-Z]{3})(\d{2})$")
MONTH_ABBR_TO_NUM = {abbr.lower(): i for i, abbr in enumerate(calendar.month_abbr) if abbr}
HEADER_LABELS = {"budget", "expense", "total"}

_client = None


def _get_client() -> anthropic.Anthropic:
    """Lazily construct the Anthropic client, failing fast with a clear error
    if ANTHROPIC_API_KEY isn't configured, rather than letting every row
    silently fall back to "Others"."""
    global _client
    if _client is None:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Add it to .env before running the import."
            )
        _client = anthropic.Anthropic()
    return _client


def parse_sheet_name(sheet_name: str) -> tuple[int, int]:
    """Parse a 'Budget-<mon><yy>' sheet name into (month, year)."""
    match = SHEET_NAME_RE.match(sheet_name)
    if not match:
        raise ValueError(
            f"Sheet name '{sheet_name}' does not match required format 'Budget-<mon><yy>'"
        )
    mon_str, yy_str = match.groups()
    month = MONTH_ABBR_TO_NUM.get(mon_str.lower())
    if month is None:
        raise ValueError(f"Unrecognized month abbreviation in sheet name '{sheet_name}'")
    year = 2000 + int(yy_str)
    return month, year


def load_raw_data(filepath: str) -> dict[str, pd.DataFrame]:
    """Load every sheet of the workbook as-is, with no cleaning or filtering."""
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"Excel file not found: {filepath}")
    try:
        return pd.read_excel(path, sheet_name=None, header=None)
    except Exception as e:
        raise RuntimeError(f"Failed to read workbook {filepath}: {e}") from e


def classify_expense(expense_name: str, note: str) -> str:
    """Classify one expense into one of CATEGORIES via Claude Haiku.

    Falls back to "Others" on any API failure or unrecognized response —
    the pipeline must not crash on a single bad classification.
    """
    client = _get_client()
    prompt = (
        f"Classify this expense into exactly one category from this list: "
        f"{', '.join(CATEGORIES)}.\n"
        f"Expense: {expense_name}\n"
        f"Note: {note}\n"
        f"Respond with only the category name, nothing else."
    )
    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=10,
            messages=[{"role": "user", "content": prompt}],
        )
        category = response.content[0].text.strip()
    except (anthropic.APIError, IndexError, AttributeError):
        return "Others"

    for c in CATEGORIES:
        if category.lower() == c.lower():
            return c
    return "Others"


def categorize_expenses(df: pd.DataFrame) -> pd.DataFrame:
    """Add a `category` column, calling classify_expense once per unique
    (expense_name, note) pair and reusing the result across duplicate rows."""
    _get_client()  # fail fast if ANTHROPIC_API_KEY is missing, before the loop

    cache: dict[tuple[str, str], str] = {}
    categories = []
    for name, note in zip(df["expense_name"], df["note"]):
        key = (name.strip().lower(), note.strip().lower())
        if key not in cache:
            cache[key] = classify_expense(name, note)
        categories.append(cache[key])

    df = df.copy()
    df["category"] = categories
    return df


def transform_data(raw: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Clean, normalize, and categorize every sheet into one combined DataFrame."""
    frames = []

    for sheet_name, sheet_df in raw.items():
        month, year = parse_sheet_name(sheet_name)

        # Drop fully-blank columns first — at least one sheet (Budget-Nov24) has
        # an extra leading blank column that would otherwise shift EXPENSE/AMOUNT/Note
        # out of the first 3 positions.
        df = sheet_df.dropna(axis=1, how="all")
        df = df.iloc[:, :3].copy()
        df.columns = ["expense_name", "amount", "note"]
        df = df.dropna(how="all")

        label_mask = df["expense_name"].astype(str).str.strip().str.lower().isin(HEADER_LABELS)
        df = df[~label_mask]

        df["expense_name"] = df["expense_name"].astype(str).str.strip()
        df["note"] = df["note"].fillna("").astype(str)

        amount = pd.to_numeric(df["amount"], errors="coerce")
        bad = amount.isna()
        if bad.any():
            for name in df.loc[bad, "expense_name"]:
                print(f"Warning: dropping row with non-numeric amount in {sheet_name}: {name}")
            df = df[~bad]
            amount = amount[~bad]
        df["amount"] = amount.round(2)

        df["source_sheet"] = sheet_name
        df["month"] = month
        df["year"] = year

        frames.append(df)

    combined = pd.concat(frames, ignore_index=True)
    combined = categorize_expenses(combined)
    return combined[
        ["expense_name", "amount", "note", "category", "month", "year", "source_sheet"]
    ]


def load_to_database(df: pd.DataFrame) -> int:
    """Insert rows into expenses, replacing any existing rows for the same
    source_sheet(s) so re-running the import is idempotent."""
    if df.empty:
        return 0

    conn = get_db()
    try:
        source_sheets = tuple(df["source_sheet"].unique())
        placeholders = ",".join("?" * len(source_sheets))
        conn.execute(
            f"DELETE FROM expenses WHERE source_sheet IN ({placeholders})",
            source_sheets,
        )

        rows = list(
            df[["expense_name", "amount", "note", "category", "month", "year", "source_sheet"]]
            .itertuples(index=False, name=None)
        )
        conn.executemany(
            "INSERT INTO expenses "
            "(expense_name, amount, note, category, month, year, source_sheet) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()
        return len(rows)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
