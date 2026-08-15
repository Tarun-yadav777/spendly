# Spec: Add Expense

## Overview
Spendly's `/analytics` page can currently only show historical data imported from spreadsheets — there is no way to log a new expense from the app itself. This feature adds an "Add Expense" button to the nav bar (visible only when logged in), styled and positioned to match the provided Figma reference (`Navbar.tsx` in the "User dashboard design" Figma Make file: a small gradient pill button with a `+` icon, sitting directly before the account/sign-out control). Clicking it opens a themed form page where the user enters an expense and it's inserted into the existing `expenses` table, immediately visible back on `/analytics`.

**Date field is manual, not auto-populated:** the form takes a single `<input type="date">` that the user fills in themselves — it must NOT default to or silently use today's date. Expenses are often logged after the fact (e.g. entering last week's spend today), so auto-populating with the submission date would misfile it under the wrong month/year. "Month year to be extracted using code" means the Flask route parses `month`/`year` out of that manually-entered date server-side with Python's `date.fromisoformat`, rather than exposing two separate month/year dropdowns — not that the date itself is automatic. This matches the existing `expenses.month` / `expenses.year` INTEGER columns (there's no day-precision column to fill).

**Assumption — full page, not a modal:** `CLAUDE.md` documents `/expenses/add` as a standalone REST-ish route (alongside `/expenses/<id>/edit`, `/expenses/<id>/delete`), and the placeholder route is already `GET`-only at that path. The Figma navbar only shows the button, not what it opens. To stay consistent with the app's existing routing convention and avoid introducing a new modal/fetch pattern that nothing else in the codebase uses yet, the button is a plain link to `GET /expenses/add`, which renders a full form page (themed like `analytics.html`/`login.html`) rather than an in-page modal.

## Depends on
- Step 02 (Login) — the button and route are gated behind `session["logged_in"]`, reusing the existing `login_required` decorator.
- Step 03 (Analytics dashboard) — the button is added to the nav bar that's already shared by `/analytics`, and the form redirects back there on success.

## Routes
- `GET /expenses/add` — renders the add-expense form — logged-in only; redirects to `/login` if not authenticated
- `POST /expenses/add` — validates and inserts the new expense, then redirects to `/analytics` — logged-in only; redirects to `/login` if not authenticated; re-renders the form with an `error` message on invalid input

## Database changes
No schema changes. Inserts into the existing `expenses` table (`expense_name`, `amount`, `note`, `category`, `month`, `year`, `source_sheet`, `created_at` via its `DEFAULT CURRENT_TIMESTAMP`). Manually-added rows use a fixed `source_sheet` value of `"Manual Entry"` so they're visibly distinguishable from imported `Budget-*` rows without needing a new column. `category` is validated server-side against the fixed set already used by real data (`Bill`, `Entertainment`, `Food`, `Groceries`, `Health`, `Loans`, `Others`, `Shopping`, `Travel`) — no new categories table, since none was asked for.

## Templates
- **Create:** `templates/add_expense.html` — extends `base.html`; form with `expense_name`, `amount`, `category` (`<select>`), `note`, `date` fields; styled with the same Tailwind + violet/indigo/slate palette and `[data-theme="dark"] #add-expense-page ...` override pattern already used in `analytics.html`; renders `error` on validation failure the same way `login.html` does
- **Modify:** `templates/base.html` — add an "Add Expense" link into `.nav-links`, positioned immediately before the "Sign out" link, shown under the same `{% if session.get('logged_in') %}` branch; reuses the existing `.nav-cta` gradient class (same violet→indigo gradient as the Figma button and the old "Sign in" CTA) plus a small inline `+` icon matching the Figma design's Plus icon

## Files to change
- `app.py` — change `/expenses/add` from the `GET`-only placeholder to `GET`/`POST`, protected by `@login_required`; `POST` reads form fields, parses `date` into `month`/`year`, calls `database.expenses.add_expense(...)`, redirects to `/analytics` on success or re-renders the form with `error` on failure
- `templates/base.html` — add the nav link described above

## Files to create
- `templates/add_expense.html`
- `database/expenses.py` — `add_expense(expense_name, amount, category, note, month, year)`, a parameterised `INSERT` against the `expenses` table (keeps the write out of `app.py`, mirroring how `database/analytics.py` keeps reads out of it)

## New dependencies
No new dependencies. `date.fromisoformat` (stdlib `datetime`) parses the `date` input; no new pip packages.

## Rules for implementation
- No SQLAlchemy or ORMs
- Parameterised queries only
- Passwords hashed with werkzeug (unaffected by this feature — no password handling here)
- Use CSS variables — never hardcode hex values, except where reusing the app's existing established exception (`.nav-cta`'s hardcoded gradient, already present in `style.css`) — don't introduce *new* hardcoded hex values
- All templates extend `base.html`
- `GET/POST /expenses/add` must check `session.get("logged_in")` and redirect unauthenticated requests to `/login`
- Insert SQL lives in `database/expenses.py`, not inline in `app.py`
- Server-side validation: `expense_name`, `amount`, `category`, `date` are required; `amount` must parse as a positive number; `category` must be one of the fixed known categories; invalid input re-renders the form with an `error`, it does not 500

## Definition of done
- [ ] Visiting `/expenses/add` while logged out redirects to `/login`
- [ ] Visiting `/expenses/add` while logged in renders the themed form with `expense_name`, `amount`, `category` dropdown, `note`, and `date` fields; `date` is empty, not pre-filled with today's date
- [ ] Submitting valid data inserts a new row into `expenses` with `month`/`year` correctly derived from the submitted `date`, `source_sheet` set to `"Manual Entry"`, and redirects to `/analytics`
- [ ] The newly added expense is visible on `/analytics` (recent transactions / totals reflect it) without any manual DB edits
- [ ] Submitting with a missing required field or a non-positive `amount` re-renders the form with an `error` message instead of crashing
- [ ] The "Add Expense" button appears in the nav bar immediately to the left of "Sign out", only when logged in, and visually matches the app's existing gradient CTA styling
- [ ] App starts with `python app.py` without errors
