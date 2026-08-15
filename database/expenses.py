from database.db import get_db

CATEGORIES = [
    "Bill", "Entertainment", "Food", "Groceries",
    "Health", "Loans", "Others", "Shopping", "Travel",
]


def add_expense(expense_name, amount, category, note, month, year):
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO expenses "
            "(expense_name, amount, note, category, month, year, source_sheet) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (expense_name, amount, note, category, month, year, "Manual Entry"),
        )
        conn.commit()
        return cursor.lastrowid
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
