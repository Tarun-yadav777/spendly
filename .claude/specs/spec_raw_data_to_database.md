# Spec: Raw Budget Data Import Pipeline

**Project:** Spendly (Flask expense tracker)
**Feature:** One-time / repeatable import of historical Excel budget data into `expense_tracker.db`
**Status:** Draft v2 — for Claude Code plan mode
**Author:** Engineering (spec only, no implementation yet)

---

## 1. Problem Statement

The user has been tracking personal expenses manually in an Excel workbook (`Budget_Organizer.xlsx`) for ~2 years, one sheet per month. Spendly needs a one-time (but re-runnable) import pipeline that:

1. Loads every monthly sheet into pandas.
2. Cleans each sheet down to real expense rows (drops headline/total rows).
3. Classifies each expense into one of a fixed set of categories using Claude Haiku, based on the expense name and note.
4. Persists the cleaned, categorized rows into the SQLite database used by the running Flask app.

This pipeline is a **build-time/admin tool**, not a user-facing route. It should live outside `app.py`'s request/response cycle and be invocable from the command line.

---

## 2. Source Data — Observed Structure

Inspected directly from the uploaded workbook. 24 sheets total, currently named `Budget-<Mon><YY?>` with inconsistent formatting (some carry a 2-digit year suffix, some don't, and one has a typo — `Ded25`).

**Per-sheet layout** (columns A:C, ~20–24 rows), e.g. `Budget-May26`:

| Row | A | B | C |
|---|---|---|---|
| 1 | `BUDGET` | *(blank)* | *(blank)* |
| 2 | `EXPENSE` | `AMOUNT` | `Note` |
| 3..n | `Rent` | `650` | `Rent+Wifi+elec Bill` |
| ... | ... | ... | ... |
| last | `Total` | `1839` | *(blank)* |

### 2.1 Sheet naming — now standardized upfront

**Decision (per user):** rather than the pipeline inferring or configuring year mappings for ambiguous sheet names, the user will rename all 24 sheets in the workbook itself to a single, unambiguous format before the first import run. This removes the need for the `sheet_year_map.py` config from the previous draft.

**Confirmed format:** `Budget-<mon><yy>` — 3-letter lowercase month abbreviation + 2-digit year, e.g. `Budget-jul26`, `Budget-dec25`.

Parsing implications, worth being explicit about since this format needs a month-name lookup (unlike a pure numeric format):
- Validate with `^Budget-([a-z]{3})(\d{2})$` (case-insensitive on the month letters, but the user's convention is lowercase).
- Map the 3-letter abbreviation to a month number via a fixed table using Python's `calendar.month_abbr` (or an explicit dict) — case-normalized so `Jul`/`JUL`/`jul` all resolve the same way, since the source data has been inconsistent about case before.
- 2-digit year needs a fixed century assumption. Given the data only spans 2024–2026, use `year = 2000 + yy` unconditionally rather than a sliding-window heuristic — simpler and correct for the foreseeable range of this dataset.
- Note this format does **not** sort correctly as plain text (`jul26` sorts before `may26` alphabetically, not chronologically) — not a problem for the pipeline itself (which sorts by the parsed `year`/`month` columns, not the sheet name string), but worth knowing if you're ever scanning the raw sheet tab list by eye.

**Action needed from user before implementation:** rename the 24 sheets to this format. The parser in §4.4 will hard-fail with a clear error listing any sheet name that doesn't match the pattern or has an unrecognized month abbreviation, rather than guessing — so a sheet renamed incorrectly (or a typo like the old `Ded25`) is caught immediately in `--dry-run`, not silently misfiled.

### 2.2 Other known data quality issues (unchanged from v1, still must be handled)

- **`Note` column is not always a string.** Example: `Mobile Recharge` row has `Note = 48` (a bare number), not text. Category-classification logic and DB column typing both need to tolerate this.
- **`AMOUNT` is sometimes a float with long decimal tails** (e.g. `5.5978260869565215`) — needs rounding, not truncation, before storage.
- **Header/footer rows to strip:** row 1 (`BUDGET` headline) and the last row (`Total`, with a summed amount and blank note) on every sheet. Detect by content (`EXPENSE`/`Total` labels), not by hardcoded row index.
- **Duplicate `EXPENSE` labels are normal**, not an error (e.g. multiple `Grocery` rows in one month). No dedup should occur.

---

## 3. Non-Goals

- No changes to `app.py` routes or templates in this spec.
- No UI for triggering the import — CLI only.
- No real-time/incremental sync with the Excel file; this is a batch import.
- No handling of workbook formats other than the one observed (fixed 3-column `EXPENSE/AMOUNT/Note` layout).
- **No user accounts / auth.** Per the user, the registration/login feature is being scrapped for now — this pipeline and the resulting schema carry no `user_id` or FK to a `users` table. If multi-user support returns later, that's a separate migration, not part of this spec.
- LLM categorization does not need to be perfectly accurate — it needs to be consistent, cheap, and cached, with a safe fallback.

---

## 4. Proposed Design

### 4.1 File location

New module, following the existing convention that DB access lives under `database/`:

```
database/
  db.py                  # existing — get_db(), init_db(), seed_db()
  import_raw_data.py     # NEW — this spec
scripts/
  run_import.py          # NEW — thin CLI entrypoint
```

(The `data/sheet_year_map.py` config from v1 is dropped — no longer needed now that sheet names are standardized at the source.)

Rationale: keeping pandas/openpyxl/LLM-classification logic out of `db.py` keeps `db.py` focused on plain SQLite access, matching its documented scope (connection, schema, seeding).

### 4.2 Database schema addition

Add to `init_db()` (or a new migration function) in `db.py`, following the existing `CREATE TABLE IF NOT EXISTS` convention:

```sql
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_name TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    category TEXT NOT NULL,
    month INTEGER NOT NULL,          -- 1-12
    year INTEGER NOT NULL,           -- e.g. 2026
    source_sheet TEXT NOT NULL,      -- traceability, e.g. 'Budget-2026-05'
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Changes from v1: no `user_id` column, no FK to `users`. Also dropped `expense_date` (the placeholder first-of-month date added false precision) in favor of just the explicit `month`/`year` columns the user asked for — anything needing a real date can derive one from `month`/`year` later if the app grows day-level tracking.

### 4.3 Function 1 — `load_raw_data(filepath: str) -> dict[str, pd.DataFrame]`

- Opens the workbook with `pandas.read_excel(filepath, sheet_name=None)` to get all sheets at once as a dict of `{sheet_name: DataFrame}`.
- Does **not** clean or filter anything — a faithful raw load only, so it's independently testable and re-usable if the workbook format changes.
- Raises a clear error (not a silent empty dict) if the file is missing or unreadable.

### 4.4 Function 2 — `transform_data(raw: dict[str, pd.DataFrame]) -> pd.DataFrame`

Per sheet:
1. Parse `month`/`year` directly from the standardized sheet name via `^Budget-([a-z]{3})(\d{2})$`, mapping the month abbreviation through a fixed lookup and the year via `2000 + yy` (see §2.1). Any sheet name that doesn't match, or whose month abbreviation isn't recognized, raises immediately with the offending sheet name listed — no silent guessing, no fallback year.
2. Drop the `BUDGET` headline row and the `Total` row, identified by matching the first column against `{"BUDGET", "Total"}` (case-insensitive), not by row position.
3. Drop fully blank rows.
4. Rename columns to `expense_name`, `amount`, `note`.
5. Coerce `note` to string (handles the numeric-note case in §2.2); coerce `amount` to float, rounded to 2 decimal places.
6. Add `source_sheet`, `month`, `year` columns.
7. Concatenate all sheets into one long DataFrame.
8. Call the categorization step (§4.5) to add a `category` column.
9. Return the combined, categorized DataFrame — this is the single object Function 3 writes to the DB.

### 4.5 Categorization sub-step (within `transform_data`, or a separate `categorize_expenses(df) -> pd.DataFrame`)

- Fixed category set: `["Food", "Travel", "Bill", "Health", "Entertainment", "Shopping", "Groceries", "Loans", "Others"]`.
- **Model: Claude Haiku (`claude-haiku-4-5-20251001`)** — chosen specifically for low cost/consumption per the user's request. This is the cheapest current Claude model and is more than sufficient for a short, closed-set classification task like this.
- One LLM call per **unique** `(expense_name, note)` pair, not per row — the sample data shows many repeated pairs (`Grocery`/`Dunnes` appears 3x in one month alone), so cache classification results in a local dict keyed on the lowercased pair before calling the LLM, then map results back onto all matching rows. This is the main cost lever, on top of using Haiku, and matters more as more months are added.
- Keep the prompt short and the response constrained to a single word from the fixed list — minimizes both input and output tokens, which matters for a 24-sheet, few-hundred-row batch.
- Parse the response defensively (strip whitespace, case-normalize, validate against the allowed set).
- **Fallback rule:** any classification that fails to call, times out, or returns a value outside the fixed set → `"Others"`, logged with the offending `(expense_name, note)` pair for later manual review. The pipeline must not crash on a single bad classification.
- Keep this call swappable: define it as `classify_expense(expense_name: str, note: str) -> str` so the model/prompt can change later without touching the rest of the pipeline.
- **API key config:** load `ANTHROPIC_API_KEY` from a `.env` file via `python-dotenv` (add to `requirements.txt` if not already present). `.env` should be gitignored (check/add to `.gitignore` if missing, alongside the existing `expense_tracker.db` entry) and a `.env.example` with a blank `ANTHROPIC_API_KEY=` placeholder should be committed so the setup step is discoverable.

### 4.6 Function 3 — `load_to_database(df: pd.DataFrame) -> int`

- Opens a connection via the existing `get_db()` from `db.py` — no separate connection logic.
- Bulk-inserts rows into `expenses` using `executemany`.
- Wrapped in a single transaction (commit once at the end, rollback on any exception) so a partial failure doesn't leave the table half-populated.
- Returns the count of rows inserted, for the CLI to report.
- **Idempotency:** since there's no `user_id` to scope by, re-running this needs to avoid duplicating all rows on a second run. **Confirmed approach:** before inserting, delete existing rows whose `source_sheet` is in the current import's set, then insert fresh. This makes "re-run after fixing one sheet" safe and predictable.

### 4.7 CLI entrypoint — `scripts/run_import.py`

```
python scripts/run_import.py --file "Budget_Organizer.xlsx" [--dry-run]
```

- `--dry-run` runs load + transform + categorize and prints a summary (row counts per category, per month, list of any fallback-to-"Others" classifications) without writing to the DB. This should be the first thing exercised, given the sheet-renaming step in §2.1 is manual and worth double-checking before a real write.

---

## 5. Acceptance Criteria

- [ ] All 24 sheets are renamed to `Budget-<mon><yy>` (e.g. `Budget-jul26`) and `--dry-run` parses every one without a naming error.
- [ ] Running `run_import.py --dry-run` produces a clean summary with a visible list of any `"Others"`-fallback classifications for manual review.
- [ ] `BUDGET` and `Total` rows never appear in the output.
- [ ] Amounts in the output are floats rounded to 2 decimals; the `Mobile Recharge`/note-as-number case doesn't crash the pipeline.
- [ ] Duplicate `(expense_name, note)` pairs are classified once and reused, not re-sent to the LLM per row.
- [ ] `classify_expense` calls `claude-haiku-4-5-20251001` (or whatever the current lowest-cost Claude model is at implementation time — worth a quick check against Anthropic's docs since model names/availability change).
- [ ] A real (non-dry-run) run inserts rows into `expenses` with correct `month`/`year` and a category from the fixed 9-value set only.
- [ ] Re-running the import for an already-imported sheet replaces rather than duplicates that sheet's rows.

---

