import calendar
import os
import secrets
from datetime import date
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, abort, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash

from database import analytics, expenses

load_dotenv()

app = Flask(__name__)
# Generated fresh on every process start (not read from .env) so that restarting
# the server invalidates any session cookie issued before the restart, forcing
# re-login instead of a stale-but-still-valid cookie staying logged in.
app.secret_key = secrets.token_hex(32)


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    return wrapped


# ------------------------------------------------------------------ #
# Routes                                                              #
# ------------------------------------------------------------------ #

@app.route("/")
def landing():
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        password = request.form.get("password", "")
        if check_password_hash(os.environ["APP_PASSWORD_HASH"], password):
            session["logged_in"] = True
            return redirect(url_for("analytics_page"))
        return render_template("login.html", error="Incorrect password")
    return render_template("login.html")


@app.route("/analytics")
@login_required
def analytics_page():
    return render_template("analytics.html")


@app.route("/api/analytics/summary")
def api_analytics_summary():
    if not session.get("logged_in"):
        return jsonify(error="Unauthorized"), 401
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    return jsonify({
        "filter": {"month": month, "year": year},
        "summary": analytics.get_summary(month, year),
        "monthly_totals": analytics.get_monthly_totals(month, year),
        "category_totals": analytics.get_category_totals(month, year),
        "recent_transactions": analytics.get_recent_expenses(month, year),
    })


@app.route("/logout")
def logout():
    session.pop("logged_in", None)
    return redirect(url_for("login"))


@app.route("/expenses/add", methods=["GET", "POST"])
@login_required
def add_expense():
    if request.method == "POST":
        expense_name = request.form.get("expense_name", "").strip()
        amount_raw = request.form.get("amount", "").strip()
        category = request.form.get("category", "").strip()
        note = request.form.get("note", "").strip()
        date_raw = request.form.get("date", "").strip()

        parsed_date = None

        if not date_raw:
            amount = None
            error = "All fields except note are required."
        else:
            amount, error = expenses.validate_fields(expense_name, amount_raw, category)

        if error is None:
            try:
                parsed_date = date.fromisoformat(date_raw)
            except ValueError:
                error = "Please enter a valid date."

        if error:
            return render_template("add_expense.html", error=error,
                                    categories=expenses.CATEGORIES, form=request.form)

        expenses.add_expense(
            expense_name=expense_name, amount=amount, category=category,
            note=note, month=parsed_date.month, year=parsed_date.year,
        )
        return redirect(url_for("analytics_page"))

    return render_template("add_expense.html", categories=expenses.CATEGORIES)


@app.route("/transactions")
@login_required
def transactions_page():
    return render_template("transactions.html")


@app.route("/api/transactions")
def api_transactions():
    if not session.get("logged_in"):
        return jsonify(error="Unauthorized"), 401
    return jsonify(transactions=analytics.get_recent_expenses(limit=10000))


@app.route("/expenses/<int:id>/edit", methods=["GET", "POST"])
@login_required
def edit_expense(id):
    expense = expenses.get_expense(id)
    if expense is None:
        abort(404)

    current_year = date.today().year
    years = sorted(set(range(min(expense["year"], current_year - 5),
                              max(expense["year"], current_year) + 1)))
    months = [(i, calendar.month_name[i]) for i in range(1, 13)]

    if request.method == "POST":
        expense_name = request.form.get("expense_name", "").strip()
        amount_raw = request.form.get("amount", "").strip()
        category = request.form.get("category", "").strip()
        note = request.form.get("note", "").strip()
        month_raw = request.form.get("month", "").strip()
        year_raw = request.form.get("year", "").strip()

        amount, error = expenses.validate_fields(expense_name, amount_raw, category)

        month = year = None
        if error is None:
            try:
                month, year = int(month_raw), int(year_raw)
                if not 1 <= month <= 12:
                    raise ValueError
            except ValueError:
                error = "Please choose a valid month and year."

        if error:
            return render_template("edit_expense.html", error=error, expense=expense,
                                    categories=expenses.CATEGORIES, months=months,
                                    years=years, form=request.form)

        expenses.update_expense(id, expense_name=expense_name, amount=amount,
                                 category=category, note=note, month=month, year=year)
        return redirect(url_for("transactions_page"))

    return render_template("edit_expense.html", expense=expense,
                            categories=expenses.CATEGORIES, months=months, years=years)


@app.route("/expenses/<int:id>/delete", methods=["POST"])
@login_required
def delete_expense(id):
    if expenses.get_expense(id) is None:
        abort(404)
    expenses.delete_expense(id)
    return redirect(url_for("transactions_page"))


# ------------------------------------------------------------------ #
# Placeholder routes — students will implement these                  #
# ------------------------------------------------------------------ #


@app.route("/profile")
def profile():
    return "Profile page — coming in Step 4"


if __name__ == "__main__":
    app.run(debug=True, port=5001)
