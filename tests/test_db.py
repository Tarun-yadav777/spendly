import sqlite3

import pandas as pd

from database import db
from database.import_raw_data import load_to_database


def test_init_db_creates_expenses_table(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE", tmp_path / "test.db")

    db.init_db()

    conn = sqlite3.connect(tmp_path / "test.db")
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'"
    ).fetchone()
    conn.close()
    assert row is not None


def test_init_db_is_idempotent(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE", tmp_path / "test.db")

    db.init_db()
    db.init_db()  # must not raise


def test_load_to_database_replaces_by_source_sheet(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE", tmp_path / "test.db")
    db.init_db()

    df1 = pd.DataFrame([
        {"expense_name": "Rent", "amount": 650.0, "note": "", "category": "Bill",
         "month": 1, "year": 2025, "source_sheet": "Budget-jan25"},
        {"expense_name": "Grocery", "amount": 50.0, "note": "Dunnes", "category": "Groceries",
         "month": 1, "year": 2025, "source_sheet": "Budget-jan25"},
    ])
    count1 = load_to_database(df1)
    assert count1 == 2

    df2 = pd.DataFrame([
        {"expense_name": "Rent", "amount": 700.0, "note": "", "category": "Bill",
         "month": 1, "year": 2025, "source_sheet": "Budget-jan25"},
    ])
    count2 = load_to_database(df2)
    assert count2 == 1

    conn = sqlite3.connect(tmp_path / "test.db")
    total = conn.execute(
        "SELECT COUNT(*) FROM expenses WHERE source_sheet = 'Budget-jan25'"
    ).fetchone()[0]
    conn.close()
    assert total == 1


def test_load_to_database_empty_df_is_a_noop(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE", tmp_path / "test.db")
    db.init_db()

    empty = pd.DataFrame(columns=["expense_name", "amount", "note", "category",
                                   "month", "year", "source_sheet"])
    assert load_to_database(empty) == 0
