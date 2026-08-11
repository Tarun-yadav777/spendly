import os
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash

from database import analytics

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ["FLASK_SECRET_KEY"]


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
    return render_template("landing.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        password = request.form.get("password", "")
        if check_password_hash(os.environ["APP_PASSWORD_HASH"], password):
            session["logged_in"] = True
            return redirect(url_for("dashboard"))
        return render_template("login.html", error="Incorrect password")
    return render_template("login.html")


@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html")


@app.route("/api/dashboard/summary")
def api_dashboard_summary():
    if not session.get("logged_in"):
        return jsonify(error="Unauthorized"), 401
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    return jsonify({
        "filter": {"month": month, "year": year},
        "summary": analytics.get_summary(month, year),
        "monthly_totals": analytics.get_monthly_totals(month, year),
        "category_totals": analytics.get_category_totals(month, year),
        "top_expenses": analytics.get_top_expenses(month, year),
    })


# ------------------------------------------------------------------ #
# Placeholder routes — students will implement these                  #
# ------------------------------------------------------------------ #

@app.route("/logout")
def logout():
    return "Logout — coming in Step 3"


@app.route("/profile")
def profile():
    return "Profile page — coming in Step 4"


@app.route("/expenses/add")
def add_expense():
    return "Add expense — coming in Step 7"


@app.route("/expenses/<int:id>/edit")
def edit_expense(id):
    return "Edit expense — coming in Step 8"


@app.route("/expenses/<int:id>/delete")
def delete_expense(id):
    return "Delete expense — coming in Step 9"


if __name__ == "__main__":
    app.run(debug=True, port=5001)
