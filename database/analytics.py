from database.db import get_db


def _build_filter(month, year):
    clauses, params = [], []
    if month is not None:
        clauses.append("month = ?")
        params.append(month)
    if year is not None:
        clauses.append("year = ?")
        params.append(year)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where_sql, params


def get_summary(month=None, year=None):
    where_sql, params = _build_filter(month, year)
    conn = get_db()
    try:
        row = conn.execute(f"""
            SELECT COALESCE(SUM(amount), 0) AS total_spend,
                   COUNT(*) AS expense_count,
                   COUNT(DISTINCT year || '-' || month) AS period_count
            FROM expenses {where_sql}
        """, params).fetchone()
    finally:
        conn.close()
    total = round(row["total_spend"], 2)
    periods = row["period_count"] or 0
    return {
        "total_spend": total,
        "average_monthly_spend": round(total / periods, 2) if periods else 0.0,
        "expense_count": row["expense_count"],
    }


def get_monthly_totals(month=None, year=None):
    where_sql, params = _build_filter(month, year)
    conn = get_db()
    try:
        rows = conn.execute(f"""
            SELECT year, month, ROUND(SUM(amount), 2) AS total
            FROM expenses {where_sql} GROUP BY year, month ORDER BY year, month
        """, params).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


def get_category_totals(month=None, year=None):
    where_sql, params = _build_filter(month, year)
    conn = get_db()
    try:
        rows = conn.execute(f"""
            SELECT category, ROUND(SUM(amount), 2) AS total, COUNT(*) AS count
            FROM expenses {where_sql} GROUP BY category ORDER BY total DESC
        """, params).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


RECENT_EXPENSES_LIMIT = 500


def get_recent_expenses(month=None, year=None, limit=RECENT_EXPENSES_LIMIT):
    where_sql, params = _build_filter(month, year)
    conn = get_db()
    try:
        rows = conn.execute(f"""
            SELECT id, expense_name, amount, category, month, year, note
            FROM expenses {where_sql} ORDER BY year DESC, month DESC, id DESC LIMIT ?
        """, params + [limit]).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]
