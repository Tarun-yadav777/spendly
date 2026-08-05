# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This is **Spendly**, a Flask expense tracker built incrementally as a step-based learning exercise. Most of the app is scaffolding: routes exist as placeholders (e.g. `"Logout — coming in Step 3"`) and `database/db.py` / `database/__init__.py` are empty stubs with only a docstring describing what to build. Expect to implement features step by step rather than finding a complete app to modify.

The documented plan for `database/db.py` (see comments in that file) is:
- `get_db()` — returns a SQLite connection with `row_factory` and foreign keys enabled
- `init_db()` — creates all tables using `CREATE TABLE IF NOT EXISTS`
- `seed_db()` — inserts sample development data

## Commands

Windows venv is already created at `venv/` (Python 3.14).

```powershell
# Activate the virtual environment
venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run the app (debug mode, port 5001)
python app.py

# Run tests
pytest
```

No lint/format tooling is configured in this repo.

## Architecture

- `app.py` — single Flask application file; all routes are defined directly here (no blueprints). `app.run(debug=True, port=5001)`.
- `database/db.py` — intended home for all SQLite access (connection handling, schema creation, seeding). Currently empty.
- `templates/` — Jinja2 templates extending `base.html`, which defines the nav/footer shell and yields `title`, `head`, `content`, and `scripts` blocks.
- `static/css/style.css`, `static/js/main.js` — shared frontend assets linked from `base.html`.
- SQLite DB file is `expense_tracker.db` at the project root (gitignored, created at runtime).

## Conventions observed in existing code

- Routes use plain `@app.route` decorators, grouped in `app.py` under a "Routes" section and a "Placeholder routes" section for unimplemented ones.
- Auth forms (`register.html`, `login.html`) POST to `/register` and `/login` respectively and render an `error` template variable on failure.
- Expense routes follow a REST-ish pattern: `/expenses/add`, `/expenses/<int:id>/edit`, `/expenses/<int:id>/delete`.


# Coding Guidelines
## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

