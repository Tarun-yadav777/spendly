---
name: spend-app-login-page
description: Generates a 3D-animated login screen (React artifact) for Tarun Yadav's personal daily-spend tracking web app. Single-user only — username is fixed to "Tarun Yadav", the only field the user fills in is the password. Background is an animated three.js scene of floating coins/currency particles that fits a finance/spend-tracking theme. Use this skill whenever the user asks to build, redesign, or restyle the login/sign-in page for their daily spend app, wants a "3D login page", or references this skill by name. Also consult it for tweaks to the existing login page (animation speed, color palette, error states) since it documents the established design tokens and signature element to keep changes consistent.
---

# Spend App Login Page

Builds the single-user login screen for Tarun's daily-spend tracking app: a fixed username, a password field, and an animated 3D coin/currency-particle background. This is a **visual/UI skill** — it produces a polished front-end artifact, not a real authentication backend.

## Non-negotiable constraints

1. **Single user, fixed username.** The username is always "Tarun Yadav" — display it as read-only text or a locked/pre-filled input (with a small lock icon), never an editable field the user has to type into every time.
2. **Only the password is entered.** One password `<input type="password">` with a show/hide toggle. Support Enter-to-submit.
3. **No real security claims.** This is a client-side visual mockup, not a secure auth system. Never hardcode a real plaintext password to check against in the artifact code, and never imply the check is secure — client-side JS is always visible to anyone who opens dev tools. If the user wants an actual gate, treat "success"/"failure" as a demo state (e.g. any non-empty password succeeds, or compare against a placeholder value clearly marked as a demo), and say so plainly rather than presenting it as real auth. Point out that real auth needs a backend if the user seems to be relying on this for actual protection.
4. **React artifact**, per the user's stated preference — single `.jsx` file, default export, Tailwind core utility classes only, three.js available via `import * as THREE from 'three'` (r128 — no `OrbitControls`, no `CapsuleGeometry`).

## Design direction (established tokens)

Read `skills/frontend-design/SKILL.md` first for the general design process (token system, restraint, one signature element). The brief for *this* skill is already pinned down — apply that process, but land on these specifics unless the user asks to change them:

- **Theme**: finance / daily spend, not generic "tech dashboard." Palette and type should feel like a premium personal-finance product, not a SaaS admin panel.
- **Background signature element**: a three.js scene of coins and currency symbols (₹, $, or a mix — ask if unsure which currency matters to the user) drifting/rotating in a soft 3D field, with gentle depth-of-field or parallax on mouse move. Keep particle count and motion restrained — this is a login screen, not a hero animation; it shouldn't distract from the password field.
- **Foreground**: a glass/frosted card floating above the 3D scene (backdrop-blur + subtle border + soft shadow) holding the locked username, the password field, and a submit button.
- **Motion**: one orchestrated entrance (card fades/slides in, particles already animating in the background) rather than scattered micro-animations everywhere.
- **Error/empty states**: if the password is empty or the demo check fails, show a clear, non-apologetic inline message in the interface's voice (e.g. "Incorrect password" or "Enter your password") — not a generic red border with no text.

## Build checklist

- [ ] Username shown as fixed/locked text — "Tarun Yadav" — never an editable input
- [ ] Single password input with show/hide toggle + Enter-to-submit
- [ ] three.js coin/currency particle background, restrained motion, mouse parallax optional
- [ ] Glass card layout above the animation, responsive down to mobile
- [ ] Visible keyboard focus states; reduced-motion respected (pause/simplify particle motion under `prefers-reduced-motion`)
- [ ] Clear demo-auth messaging in any code comments or explanation — never framed as real security
- [ ] One signature moment (the coin field), everything else quiet and disciplined

See `references/token-example.md` for a starting palette/type/layout token set and a minimal three.js particle setup to build from — treat it as a starting point to adapt, not boilerplate to paste unchanged.