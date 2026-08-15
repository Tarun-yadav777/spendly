import os
import secrets
from datetime import date
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
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

        error = None
        amount = None
        parsed_date = None

        if not expense_name or not amount_raw or not category or not date_raw:
            error = "All fields except note are required."
        elif category not in expenses.CATEGORIES:
            error = "Please choose a valid category."
        else:
            try:
                amount = float(amount_raw)
                if amount <= 0:
                    error = "Amount must be a positive number."
            except ValueError:
                error = "Amount must be a valid number."

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


# ------------------------------------------------------------------ #
# Placeholder routes — students will implement these                  #
# ------------------------------------------------------------------ #


@app.route("/profile")
def profile():
    return "Profile page — coming in Step 4"


@app.route("/expenses/<int:id>/edit")
def edit_expense(id):
    return "Edit expense — coming in Step 8"


@app.route("/expenses/<int:id>/delete")
def delete_expense(id):
    return "Delete expense — coming in Step 9"


if __name__ == "__main__":
    app.run(debug=True, port=5001)
