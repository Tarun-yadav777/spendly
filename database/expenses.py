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


def get_expense(id):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, expense_name, amount, category, month, year, note "
            "FROM expenses WHERE id = ?", (id,),
        ).fetchone()
    finally:
        conn.close()
    return dict(row) if row else None


def update_expense(id, expense_name, amount, category, note, month, year):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE expenses SET expense_name = ?, amount = ?, category = ?, "
            "note = ?, month = ?, year = ? WHERE id = ?",
            (expense_name, amount, category, note, month, year, id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def delete_expense(id):
    conn = get_db()
    try:
        conn.execute("DELETE FROM expenses WHERE id = ?", (id,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def validate_fields(expense_name, amount_raw, category):
    """Shared required-field / positive-amount / known-category checks, used by
    both add_expense and edit_expense. Returns (amount: float|None, error: str|None)."""
    if not expense_name or not amount_raw or not category:
        return None, "All fields except note are required."
    if category not in CATEGORIES:
        return None, "Please choose a valid category."
    try:
        amount = float(amount_raw)
    except ValueError:
        return None, "Amount must be a valid number."
    if amount <= 0:
        return None, "Amount must be a positive number."
    return amount, None
