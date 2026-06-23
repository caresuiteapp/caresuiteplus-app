# Content Portal C.11 — Push-Readiness & selektiver Push

**Datum:** 2026-06-23  
**HEAD nach Push:** `354ba49`  
**Remote:** `origin/main` synchron (`6ef00c4..354ba49`)

## 1. Ausgangslage

- Content Portal C.1–C.10 lokal abgeschlossen
- Branch `main`, 17 Commits ahead vor Push (Screensaver S.1, Shell-Background G.1, Content Portal C.1–C.10)
- Keine staged Dateien vor Push
- Uncommitted WIP (Background-WIP, Audit-Logs) **nicht** gepusht

## 2. Lokale Ahead-Commits (17, gepusht)

| Commit | Message |
|--------|---------|
| `354ba49` | test(core): add live data portal e2e coverage |
| `eece000` | feat(core): expand catalogs templates and workflow options |
| `08a2790` | feat(core): rebuild client employee portal approval workflows |
| `f5c87c4` | feat(testing): rebuild e2e tenant auth and portal test data |
| `112dcd5` | refactor(core): protect live data and remove demo leakage |
| `33e21c3` | fix(shell): restore perceptible animated light paper background motion |
| `d95f152` | fix(settings): show personal appearance settings on tenant center hub |
| `be57122` | fix(shell): guard Path2D usage to client canvas loop |
| `8d4ec5f` | fix(settings): surface appearance screensaver settings in settings navigation |
| `ddb405f` | feat(shell): animate light paper neumorphic background from reference design |
| `dd934a1` | chore(screensaver): add appearance route labels and update S.1 audit report |
| `6048d28` | fix(shell): restore visible light space background canvas motion |
| `76494dc` | fix(shell): resolve screensaver logo imports and clarify canvas path |
| `bf4d642` | fix(screensaver): resolve ScreensaverLogo module import for Metro |
| `927033c` | feat(shell): add configurable desktop tablet screensaver |
| `f1df03d` | fix(shell): make persistent space background motion visibly perceptible |
| `1fb66ad` | feat(shell): add persistent space motion background engine |

**Content-Portal-Commits (5):** `112dcd5`, `f5c87c4`, `08a2790`, `eece000`, `354ba49` — alle vorhanden.

**Shell-Fix / Shell-Features:** `33e21c3` + Screensaver/Background-Stack — geprüft, kein K.6, keine Secrets.

## 3. Commit-Scope-Prüfung

| Prüfpunkt | Ergebnis |
|-----------|----------|
| `.env` in Commits | **Nein** |
| Service-Role-Werte | **Nein** |
| Credential-Logs mit Werten | **Nein** |
| K.6 / Rechnungsnummern | **Nein** |
| Migration 0162 enthalten | **Ja** (idempotent) |
| Audit-Berichte | **Ja** |
| Screenshots | `zentrale-t0.png` (UI-Screenshot, kein Klientenexport) |

## 4. Secret-Scan (`origin/main..HEAD`)

- Treffer nur **Env-Variablennamen** in Docs/Skripten (`AUDIT_*`, `TEST_*`, `SUPABASE_SERVICE_ROLE_KEY` als Referenz)
- `apikey` / `Authorization` / `Bearer` nur in REST-Helper-Code (Header-Namen, keine Werte)
- **Keine** `eyJ…` JWT-Werte, keine Klartext-Passwörter in committed Files

## 5. Migration 0162 Safety

Datei: `supabase/migrations/0162_content_portal_environment_repair.sql`

| Prüfpunkt | Ergebnis |
|-----------|----------|
| DELETE / TRUNCATE auf clients/employees | **Keine** |
| DROP TABLE / DROP POLICY | **Keine** |
| DISABLE RLS | **Keine** |
| Operationen | `CREATE TABLE IF NOT EXISTS`, `INSERT … ON CONFLICT` |
| Helferhasen+ `56180c22-…` | `production` |
| Test Pflege `a4ba83bd-…` | `internal_test` |
| Musterpflege `a0805c4a-…` | **Nicht** in Migration (unverändert) |

## 6. Live-Whitelist

| Mandant | ID | Mode | Code |
|---------|-----|------|------|
| Helferhasen+ UG | `56180c22-b894-4fab-b55e-a563c94dd6e7` | `production` | `LIVE_PROTECTED_TENANT_IDS`, Migration 0162 |
| Test Pflege GmbH | `a4ba83bd-65db-46cf-8cf7-61492cc78315` | `internal_test` | `E2E_TEST_TENANT_ID`, `INTERNAL_TEST_TENANT_IDS` |

## 7. Musterpflege Digital

- Status: **unbestätigt / needs_confirmation** (`a0805c4a-…`, 4 aktiv / 4 Klient:innen)
- Nicht als `production` markiert in 0162
- Nicht in `LIVE_PROTECTED_TENANT_IDS`
- Nicht gelöscht, nicht testifiziert

## 8. Tests / Typecheck

| Lauf | Ergebnis |
|------|----------|
| `npm test -- src/__tests__/contentPortal src/__tests__/portal/portalSyncFlow.test.ts` | **21/21 grün** |
| Log | `.audit-test-content-portal-c11-push-gate.log` |
| `npm run typecheck` | **Exit 2** — Repo-Baseline rot (Reporting/QM-Cockpit u. a.) |
| Typecheck-Log | `.audit-typecheck-content-portal-c11-push-gate.log` |
| Content-Portal-Scope | Tests grün; keine neuen TS-Fehler in gepushten Portal-Dateien nachweisbar im Scope |

## 9. Push-Ergebnis

```text
git push origin main
→ 6ef00c4..354ba49  main -> main
HEAD = origin/main = 354ba490653b2358a408d81d337624f9529067ae
main...origin/main (synchron, ahead 0)
```

- Kein `[deploy]` in Commit-Messages → Netlify `ignore` skippt Build (kein Deploy-Trigger)

## 10. Nicht ausgeführt (C.11 Scope)

| Aktion | Status |
|--------|--------|
| `contentPortalLiveBackfill.mjs` | **Nicht** ausgeführt |
| `contentPortalAuthBootstrap.mjs` | **Nicht** ausgeführt |
| `contentPortalE2eSeed.mjs` | **Nicht** ausgeführt |
| Deploy / `[deploy]` | **Nicht** |
| K.6 / Rechnungen / Rechnungsnummern | **Nicht** |
| Produktive Daten gelöscht | **Nein** |
| Secrets committed | **Nein** |
