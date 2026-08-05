"""CLI entrypoint for the raw budget data import pipeline.

Usage:
    python scripts/run_import.py --file "data/raw data/Budget Organizer.xlsx" [--dry-run]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.db import init_db
from database.import_raw_data import load_raw_data, load_to_database, transform_data

DEFAULT_FILE = "data/raw data/Budget Organizer.xlsx"


def print_summary(df) -> None:
    print(f"\nTotal rows: {len(df)}")

    print("\nBy category:")
    for category, count in df["category"].value_counts().items():
        print(f"  {category}: {count}")

    print("\nBy month:")
    by_month = df.groupby(["year", "month"]).size().sort_index()
    for (year, month), count in by_month.items():
        print(f"  {year}-{month:02d}: {count}")

    others = df[df["category"] == "Others"][["expense_name", "note"]].drop_duplicates()
    print(f"\nClassified as Others - review ({len(others)} unique pairs):")
    if others.empty:
        print("  (none)")
    else:
        for _, row in others.iterrows():
            print(f"  {row['expense_name']!r} / note={row['note']!r}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import historical budget Excel data into the expenses table."
    )
    parser.add_argument("--file", default=DEFAULT_FILE, help="Path to the budget Excel workbook")
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview without writing to the database"
    )
    args = parser.parse_args()

    raw = load_raw_data(args.file)
    df = transform_data(raw)

    print_summary(df)

    if args.dry_run:
        print("\nDry run complete - no rows written.")
        return

    init_db()
    count = load_to_database(df)
    print(f"\nInserted {count} rows into expenses.")


if __name__ == "__main__":
    main()
