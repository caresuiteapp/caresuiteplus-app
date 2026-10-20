# Content Portal C.13 — Browser-E2E Abnahme

**Datum:** 2026-06-23

## Gate

Browser-Walkthrough **nicht gestartet** — Auth-Gate C.12 nicht grün.

| Voraussetzung | Status |
|---------------|--------|
| Business-Login | **fehlgeschlagen** |
| Employee-Portal-Login | **nicht geprüft** (Credentials ungültig / Bootstrap fehlgeschlagen) |
| Client-Portal-Login | **nicht geprüft** |

## HTTP-Smoke (ohne Browser)

| Flow | Status |
|------|--------|
| A Software → Mitarbeiterportal | **nicht geprüft** |
| B Software → Klient:innenportal | **nicht geprüft** |
| C Nachrichten | **nicht geprüft** |
| D Nachweis/Freigabe | **nicht geprüft** |

## Unit-/Integration-Scope (Proxy)

Content-Portal-Tests: **21/21 grün** (siehe `.audit-test-content-portal-c12-c14.log`)

- `liveDataProtection`, `demoLeak`, `portalApproval`, `portalSyncFlow`

## Blocker

1. Business-Auth `400` gegen Live-Supabase
2. Kein `SUPABASE_SERVICE_ROLE_KEY` für Bootstrap-Reparatur
3. Playwright/Browser nicht ausgeführt

## Empfehlung

Nach Credential-Fix:

- `node scripts/audit/contentPortalAuthBootstrap.mjs`
- `node scripts/audit/contentPortalAuthVerify.mjs`
- Browser gegen E2E-Mandant `a4ba83bd-…` nur mit Testdaten-Screenshots
