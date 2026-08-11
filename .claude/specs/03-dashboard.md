# Spec: Analytical Dashboard

## Overview
Spendly's `expenses` table already holds ~2 years of categorized historical spend data (imported via the raw-data pipeline in `spec_raw_data_to_database.md`). This feature adds a logged-in `/dashboard` page that performs EDA (exploratory data analysis) on that data: a spend summary, a monthly trend, a category breakdown, and a list of the largest individual expenses — with a month/year filter to drill into a specific period. Charts render client-side with Chart.js (loaded via CDN, no new pip dependency); Flask exposes the aggregated numbers as JSON for the page's JS to consume.

**Numbering note:** this spec is deliberately filed as step 03, ahead of Logout (previously placeholder-labeled "Step 3" in `app.py`). Logout's placeholder comment will need renumbering when it's implemented — not addressed by this spec.

## Depends on
- Step 02 (Login) — `/dashboard` is a logged-in-only route and reuses the `session["logged_in"]` flag established there.
- The raw-data import pipeline (`spec_raw_data_to_database.md`) — the `expenses` table must be populated for the dashboard to show anything meaningful.

## Routes
- `GET /dashboard` — renders the dashboard page shell (filter controls + chart containers) — logged-in only; redirects to `/login` if `session["logged_in"]` is not set
- `GET /api/dashboard/summary` — returns JSON aggregates for the current filter (`month`, `year` query params, both optional): total spend, average monthly spend, top N largest expenses, spend-by-category totals, spend-by-month totals — logged-in only; returns 401 JSON if not logged in

## Database changes
No database changes. All aggregation is done with `SELECT`/`GROUP BY` queries against the existing `expenses` table (`expense_name`, `amount`, `note`, `category`, `month`, `year`, `source_sheet`, `created_at`) via `get_db()`.

## Templates
- **Create:** `templates/dashboard.html` — extends `base.html`; month/year filter form, summary stat tiles, chart canvases (trend, category breakdown), top-expenses table
- **Modify:** `templates/base.html` — add a "Dashboard" nav link (visible only when logged in) alongside the existing "Sign in" link

## Files to change
- `app.py` — add `GET /dashboard` and `GET /api/dashboard/summary` routes; add a small `login_required` check (no decorator currently exists — introduce one since this is the first protected route being implemented)
- `templates/base.html` — add conditional "Dashboard" nav link

## Files to create
- `templates/dashboard.html`
- `static/js/dashboard.js` — fetches `/api/dashboard/summary`, initializes Chart.js charts, wires up the filter form
- `database/analytics.py` — query functions (`get_summary`, `get_monthly_totals`, `get_category_totals`, `get_top_expenses`) used by the `/api/dashboard/summary` route, keeping aggregation SQL out of `app.py`

## New dependencies
No new pip dependencies. Chart.js is loaded client-side via CDN `<script>` tag in `dashboard.html`, the same pattern already used for three.js in `login.html`.

## Rules for implementation
- No SQLAlchemy or ORMs
- Parameterised queries only
- Passwords hashed with werkzeug
- Use CSS variables — never hardcode hex values
- All templates extend `base.html`
- `/dashboard` and `/api/dashboard/summary` must check `session.get("logged_in")` and reject/redirect unauthenticated requests
- Aggregation SQL lives in `database/analytics.py`, not inline in `app.py` route handlers
- Month/year filter is optional — omitting both shows all-time data

## Definition of done
- [ ] Visiting `/dashboard` while logged out redirects to `/login`
- [ ] Visiting `/dashboard` while logged in renders the page with summary tiles, a monthly trend chart, a category breakdown chart, and a top-expenses table
- [ ] `GET /api/dashboard/summary` (logged in, no filter) returns JSON with all-time totals matching a manual `SELECT SUM(amount) FROM expenses` check
- [ ] `GET /api/dashboard/summary?month=5&year=2026` returns JSON scoped to only that month/year
- [ ] `GET /api/dashboard/summary` while logged out returns 401
- [ ] Selecting a month/year in the dashboard's filter form updates the charts and stat tiles without a full page reload
- [ ] App starts with `python app.py` without errors
