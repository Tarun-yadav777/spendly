# Spec: Login

## Overview
Spendly is a single-user app for Tarun Yadav — there is no registration flow and no `users` table. This feature adds a password-gated login page: the page shows "Tarun Yadav" as a static label (not an input) and a single password field. On correct password, a Flask session is established; on incorrect password, the form re-renders with an error. The password credential is not stored in the database — it lives as a hash in an environment variable, since there is exactly one user and it will never change via a UI. This also removes the multi-user registration flow (`/register`, `register.html`), which no longer makes sense for a single static user, per the existing decision in `.claude/specs/spec_raw_data_to_database.md` to scrap accounts/auth in favor of a single-user model.

## Depends on
None — this is the first authentication-related step now that multi-user registration has been dropped from the roadmap.

## Routes
- `GET /login` — render the login page (static "Tarun Yadav" label + password field) — public
- `POST /login` — verify the submitted password against the hashed password in the environment; on success, set a `logged_in` session flag and redirect to `/profile`; on failure, re-render `login.html` with an `error` message — public

`/register` is removed entirely (route deleted, not left as a placeholder).

## Database changes
No database changes. The password credential is stored as a hash in an environment variable (`APP_PASSWORD_HASH` in `.env`), not in SQLite — there is no `users` table.

## Templates
- **Create:** None
- **Modify:**
  - `templates/login.html` — remove the email field; replace the username concept with a static "Welcome back, Tarun Yadav" label; keep the single password field; remove the "Don't have an account? Create one free" link (register no longer exists)
  - `templates/base.html` — remove the "Get started" nav link that points to `/register`; keep the "Sign in" link

## Files to change
- `app.py` — add `app.secret_key` (loaded from `FLASK_SECRET_KEY` env var), change `/login` to accept `GET`/`POST` and implement password verification against `APP_PASSWORD_HASH`, remove the `/register` route
- `templates/login.html` — see Templates above
- `templates/base.html` — see Templates above
- `.env.example` — add `FLASK_SECRET_KEY=` and `APP_PASSWORD_HASH=` placeholders

## Files to create
None. (`.env` itself is created locally by the developer, not committed — already gitignored.)

## New dependencies
No new dependencies. `werkzeug` (for `generate_password_hash`/`check_password_hash`) and `python-dotenv` (for loading `.env`) are already in `requirements.txt`.

## Rules for implementation
- No SQLAlchemy or ORMs
- Parameterised queries only
- Passwords hashed with werkzeug
- Use CSS variables — never hardcode hex values
- All templates extend `base.html`
- No `users` table — the single password hash comes from the `APP_PASSWORD_HASH` environment variable, loaded via `python-dotenv`
- Use Flask's built-in signed-cookie session (`flask.session`) — no Flask-Login or other session-management dependency
- Delete `templates/register.html` and the `/register` route rather than leaving them as dead placeholders

## Definition of done
- [ ] `GET /login` renders a page showing "Tarun Yadav" as static text and exactly one input field (password) — no email field, no username input
- [ ] Submitting the correct password at `POST /login` redirects to `/profile` and a session cookie is set
- [ ] Submitting an incorrect password at `POST /login` re-renders the login page with a visible error message and no session cookie is set
- [ ] `GET /register` returns a 404 (route removed)
- [ ] `templates/register.html` no longer exists
- [ ] `templates/base.html` nav no longer contains a link to `/register`
- [ ] App starts with `python app.py` without errors once `.env` is populated from the updated `.env.example`
