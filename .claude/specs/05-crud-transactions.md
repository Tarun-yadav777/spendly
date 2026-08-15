# Spec: Transactions (List, Filter, Edit, Delete)

## Overview
Spendly currently has no way to browse, edit, or delete individual expenses — `/analytics` only shows a preview of "Recent Transactions" (capped at 8 rows visible, sourced from an endpoint capped at 500 rows), and the `edit`/`delete` routes are still unimplemented placeholders. This feature adds a dedicated `/transactions` page — reachable via a new "Transactions" nav link placed next to the "Spendly" brand (matching the provided Figma reference's left-aligned nav-link cluster: `Overview`, `Transactions`, `Budgets`, `Reports`, of which only "Transactions" is being built, since that's the only one requested) — that lists **every** expense (not capped), with category/month/year filters, and per-row Edit and Delete actions that operate on the real `expenses` table.

**Assumption — filters:** the Figma reference (`TransactionsTable.tsx`) only shows a category filter. The request says "filters" (plural) though, and the app already has unused `month`/`year` filtering built into `analytics.get_recent_expenses` (the API accepts them, but no UI in `analytics.html` ever sends them). So "filters" here means: **category** (client-side, exactly like the existing Recent Transactions widget) **+ month + year** (also client-side, derived from the fetched data — no backend query changes needed). No free-text search, since it wasn't requested — flag if that's wanted too.

**Assumption — Edit uses Month + Year selects, not a date picker.** `expenses.month`/`expenses.year` are the only date precision the schema stores (no day column). Spec 04's Add form uses a `<input type="date">` and discards the day server-side — acceptable there because it's a fresh entry the user is actively dating. Pre-filling a date picker for an *existing* row would require inventing a fake day-of-month (the real one was never stored), which would misrepresent the data. So the Edit form uses two `<select>`s (Month name, Year) instead, pre-filled with the row's actual stored values — no fabricated precision.

**Assumption — Delete is POST-only, not GET.** The existing placeholder route `/expenses/<int:id>/delete` has no `methods=` (defaults to GET). A GET-triggered delete is a CSRF/link-prefetch hazard (a stray `<link rel="prefetch">`, crawler, or browser history click could silently delete data). This feature makes it `methods=["POST"]`, triggered by a small inline `<form>` per row with a JS `confirm()` — not a plain `<a href>`.

**Assumption — show all rows on `/transactions`, no 8-row initial collapse.** The Analytics page's Recent Transactions widget intentionally previews a handful; this page's entire purpose is exhaustive browsing, so it renders all matching rows by default (currently 519 total — trivial for a browser table, no pagination needed).

## Depends on
- Step 02 (Login) — `/transactions` and the edit/delete routes are logged-in only, reusing `login_required`.
- Step 03 (Analytics) — reuses `analytics.get_recent_expenses` for the transaction list, and mirrors `analytics.html`'s Tailwind/violet-indigo-slate/dark-mode-override page pattern.
- Step 04 (Add Expense) — the Edit form and its validation mirror the Add Expense form and validation (`database/expenses.py`, `templates/add_expense.html`); this feature factors the shared validation out so both routes use one implementation instead of two copies.

## Routes
- `GET /transactions` — renders the transactions page shell (filters + table container) — logged-in only; redirects to `/login` if not authenticated
- `GET /api/transactions` — returns JSON of **all** expenses (`id`, `expense_name`, `amount`, `category`, `month`, `year`, `note`) for client-side filtering/sorting — logged-in only; returns 401 JSON if not authenticated
- `GET /expenses/<int:id>/edit` — renders the edit form pre-filled with that expense's current values — logged-in only; redirects to `/login` if not authenticated; 404 if `id` doesn't exist
- `POST /expenses/<int:id>/edit` — validates and updates the expense, then redirects to `/transactions` — logged-in only; redirects to `/login` if not authenticated; 404 if `id` doesn't exist; re-renders the form with an `error` on invalid input
- `POST /expenses/<int:id>/delete` — deletes the expense, then redirects to `/transactions` — logged-in only; redirects to `/login` if not authenticated; 404 if `id` doesn't exist

## Database changes
No schema changes. New functions in `database/expenses.py` operating on the existing `expenses` table:
- `get_expense(id)` — fetch a single row (or `None`) for the edit form and the 404 checks
- `update_expense(id, expense_name, amount, category, note, month, year)` — parameterised `UPDATE`
- `delete_expense(id)` — parameterised `DELETE`
- `validate_fields(expense_name, amount_raw, category)` — the required-field / positive-amount / known-category checks currently inline in `add_expense`'s POST handler, extracted so `edit_expense` can reuse them instead of duplicating that logic (`app.py`'s `add_expense` route is updated to call this too)

`GET /api/transactions` reuses `analytics.get_recent_expenses` with a high explicit `limit` (e.g. `limit=10000`) instead of its 500 default, so it never silently truncates — no changes to `database/analytics.py` itself.

## Templates
- **Create:** `templates/transactions.html` — extends `base.html`; Tailwind CDN + `[data-theme="dark"] #transactions-page ...` overrides (same technique as `analytics.html`/`add_expense.html`); category/month/year filter `<select>`s; a transactions table (Merchant, Category, Date, Amount, Actions columns — Actions holds an Edit link and a Delete form/button) rendered by JS from `/api/transactions`, showing all matching rows
- **Create:** `templates/edit_expense.html` — extends `base.html`; same visual pattern as `add_expense.html`; fields: `expense_name`, `amount`, `category` (`<select>`), `note`, `month` (`<select>` of month names), `year` (`<select>`, range covering at least the edited row's own year so it's never missing from the list) — all pre-filled with the expense's current values
- **Modify:** `templates/base.html` — wrap the existing brand button and a new "Transactions" nav link in a `.nav-left` flex group (so the link sits immediately next to "Spendly", matching the Figma layout, instead of being pushed apart by `.nav-inner`'s `justify-content: space-between`); link shown only when `session.get('logged_in')`; highlighted when `request.endpoint == 'transactions_page'`

## Files to change
- `app.py` — add `GET /transactions`, `GET /api/transactions`, replace the `GET /expenses/<int:id>/edit` and `GET /expenses/<int:id>/delete` placeholders with the real `GET/POST edit_expense` and `POST delete_expense` implementations; update `add_expense`'s POST handler to call the new `expenses.validate_fields` helper instead of its inline checks
- `templates/base.html` — nav restructuring described above
- `static/css/style.css` — add `.nav-left` (flex wrapper) and nav-link styling for the new Transactions link, reusing the existing `--nav-link-color` / `--nav-link-hover-bg` / `--nav-link-hover-color` custom properties (no new hardcoded hex)

## Files to create
- `templates/transactions.html`
- `templates/edit_expense.html`
- `static/js/transactions.js` — fetches `/api/transactions`, renders the filterable/sortable table (adapted from `analytics.js`'s existing `renderTransactionsTable`), wires the category/month/year filters, and builds each row's Edit link + Delete confirm-form
- `database/expenses.py` — add `get_expense`, `update_expense`, `delete_expense`, `validate_fields` (file already exists from spec 04; this adds to it, not a new file from scratch)

## New dependencies
No new dependencies.

## Rules for implementation
- No SQLAlchemy or ORMs
- Parameterised queries only
- Passwords hashed with werkzeug (unaffected — no password handling here)
- Use CSS variables — never hardcode hex values; reuse the existing `--nav-link-*` tokens for the new nav link
- All templates extend `base.html`
- `GET /transactions`, `GET /api/transactions`, `GET/POST /expenses/<id>/edit`, and `POST /expenses/<id>/delete` must all check `session.get("logged_in")` and redirect (or 401 for the JSON endpoint) unauthenticated requests
- `POST /expenses/<id>/delete` must not be reachable via GET
- Insert/update/delete SQL lives in `database/expenses.py`, not inline in `app.py`
- Edit validation reuses the same required-field / positive-amount / known-category rules as Add (via the shared `validate_fields` helper) — invalid input re-renders the form with an `error`, it does not 500
- Editing or deleting a non-existent `id` returns 404, not a crash

## Definition of done
- [ ] "Transactions" appears in the nav immediately next to "Spendly", only when logged in, and is visually highlighted while on `/transactions`
- [ ] Visiting `/transactions` while logged out redirects to `/login`; `/api/transactions` returns 401 JSON while logged out
- [ ] Visiting `/transactions` while logged in lists every expense (currently 519+), not capped at 8 or 500
- [ ] The category filter narrows the visible rows to that category; combining it with month/year filters narrows further; clearing filters shows everything again
- [ ] Each row has a working Edit link that opens `/expenses/<id>/edit` pre-filled with that row's real `expense_name`, `amount`, `category`, `note`, `month`, and `year`
- [ ] Submitting a valid edit updates the row in the DB and redirects to `/transactions`, where the updated values are visible
- [ ] Submitting an edit with a missing field or non-positive amount re-renders the edit form with an `error`, no 500
- [ ] Clicking Delete (after confirming) removes the row from the DB and redirects to `/transactions`; the row no longer appears anywhere (transactions list or analytics totals)
- [ ] Visiting `/expenses/999999/edit` (a non-existent id) returns 404, not a crash
- [ ] `pytest` still passes (schema untouched, no regressions)
- [ ] App starts with `python app.py` without errors
