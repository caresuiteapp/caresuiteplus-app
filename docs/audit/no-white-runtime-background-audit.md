# Runtime White-Background Audit

**Branch:** `recovery/hybrid-live-restore`  
**Date:** 2026-06-19  
**Tool:** `auditVisibleBackgrounds()` — brightness > 205, area > 5000, alpha > 0.4  
**CI script:** `npm run audit:runtime-backgrounds` (`scripts/audit-runtime-backgrounds.mjs`)

---

## Environment

| Setting | Value |
|---------|-------|
| Route requested | `/business/office/clients`, `/business/office/employees` |
| Route reached | `/auth/business-login` (auth redirect — live Supabase mode, no session in Playwright) |
| Viewport | 1440×900 |
| Server | `npx expo start --web --port 8081` |
| Browser | Playwright + system Edge (headless) |

**Auth note:** Could not reach authenticated clients/employees list without credentials. Runtime fix targets React Navigation stack scenes visible on the login redirect — same stack wraps office routes after login.

---

## BEFORE fix (top offenders)

| # | bg color | size (px²) | brightness | mapped component / source |
|---|----------|------------|------------|---------------------------|
| 1 | `rgb(242, 242, 242)` | 1,296,000 (1440×900) | 242 | React Navigation stack scene overlay — `@react-navigation/native` `DefaultTheme.colors.background` |
| 2 | `rgb(242, 242, 242)` | 1,296,000 (1440×900) | 242 | Nested stack scene overlay (same `DefaultTheme` card/background on RN Web absolute scene `div`) |

DOM signature: `div.css-view-… r-position-u8s1d r-top-ipm5af` (fullscreen absolute stack layer).

---

## Root cause

| File | Line | Issue |
|------|------|-------|
| `app/_layout.tsx` | 14–21 (pre-fix) | Root `Stack` used `palette.background.app` but **no `ThemeProvider`** — React Navigation fell back to `DefaultTheme` (`background: rgb(242, 242, 242)`) for stack scene layers on RN Web |
| `app/+html.tsx` | — (missing) | `html` / `body` / `#root` had no dark base — browser default white showed through transparent children |
| `@react-navigation/native` `DefaultTheme.js` | 8 | `background: 'rgb(242, 242, 242)'` — exact runtime offender color |

---

## Fix applied

| File | Change |
|------|--------|
| `app/_layout.tsx` | Wrap with `ThemeProvider`; dark/aurora → `transparent` surface + `contentStyle`; register `__CARE_AUDIT_BACKGROUNDS__` in dev |
| `app/+html.tsx` | **NEW** — `html, body, #root, #expo-root { background-color: #050816 !important }` |
| `src/devtools/auditVisibleBackgrounds.ts` | **NEW** — runtime audit function |
| `src/devtools/registerDevAudit.ts` | **NEW** — `window.__CARE_AUDIT_BACKGROUNDS__` in dev web |
| `scripts/audit-runtime-backgrounds.mjs` | **NEW** — Playwright/CDP CI doc runner |
| `package.json` | `audit:runtime-backgrounds` script |
| `ScreenShell.tsx`, `platformshell.tsx`, list views, `PremiumDataTable.tsx` | `testID` → `data-testid` for audit mapping |

---

## AFTER fix (top offenders)

| # | bg color | size | brightness | notes |
|---|----------|------|------------|-------|
| — | — | — | — | **0 offenders** on `/auth/business-login` @ 1440×900 |

Repeat on `/business/office/employees` redirect: **0 offenders**.

---

## Static check

```
npm run audit:no-white
Priority path violations: 0
```

---

## Allowed exceptions

- Document HTML preview iframe (`#fff`) — intentional
- Platform topbar light dropdown surfaces — explicit allowlist
- Small UI chips/inputs using aurora glass tokens (brightness ≤ 205 or area < 5000)

---

## Dev console usage

```js
window.__CARE_AUDIT_BACKGROUNDS__()  // dev web only; outlines top 20
```

---

## Visual white gone?

**On tested route (login redirect @ 1440×900):** Yes — no large light panels; root is `#050816`, stack scenes transparent.

**Authenticated clients list:** Not verified in browser (login required). Root/stack fix applies to the same navigation shell used post-login; re-run after session:

```bash
npm run audit:runtime-backgrounds -- --route /business/office/clients
```
