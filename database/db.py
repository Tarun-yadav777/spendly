import sqlite3
from pathlib import Path

DATABASE = Path(__file__).resolve().parent.parent / "expense_tracker.db"


def get_db() -> sqlite3.Connection:
    """Return a SQLite connection with row_factory and foreign keys enabled."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Create all tables using CREATE TABLE IF NOT EXISTS."""
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                expense_name TEXT NOT NULL,
                amount REAL NOT NULL,
                note TEXT,
                category TEXT NOT NULL,
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                source_sheet TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    finally:
        conn.close()


def seed_db() -> None:
    """Insert sample development data.

    Out of scope for the raw-data import feature — left as a no-op so
    it doesn't insert fake rows that could be mistaken for real imported data.
    """
    pass
