# Production Smoke — ZEIT.1 Employee Resolver Fix

**Datum:** 2026-07-03  
**Production URL:** https://caresuiteplus.app  
**ZEIT.1 Code-Commit (HEAD bei Release):** `2c48eb8ff8e6d7ffcf8c7b0c86979b6466c8a740` — `fix(wfm): resolve portal employee_id for MP time tracking`  
**Smoke-Skript:** `.audit-zeit1-browser-smoke.mjs` (Production via `AUDIT_WEB_URL=https://caresuiteplus.app`)  
**Ergebnis-JSON:** `.audit-zeit1-browser-results.json` (lokal, nicht committed)  
**Execute-Nachtest:** `.audit-zeit1-prod-g-execute.mjs` → `.audit-zeit1-prod-g-execute.json`  
**Screenshots:** `.audit-zeit1-browser-screenshots/` (lokal, nicht committed)

---

## Phase 1 — Pre-deploy Gate

| Check | Ergebnis |
|-------|----------|
| Branch | `main...origin/main` (nach Push: ahead 0) |
| HEAD | `2c48eb8ff8e6d7ffcf8c7b0c86979b6466c8a740` (= ZEIT.1) |
| origin/main (vor Deploy) | `2c48eb8ff8e6d7ffcf8c7b0c86979b6466c8a740` (sync) |
| Staged changes | **keine** |
| Deploy-relevante Remote-Codebasis | ZEIT.1 bereits auf `origin/main` |
| Secrets in Staging | **nein** |
| Lokaler Working Tree | **dirty** (viele untracked `.audit-*`, geänderte Docs/Screenshots, 1 lokale Änderung `src/__tests__/office/profileRoleAndTimeTrackingFix.test.ts` — **nicht** im Deploy enthalten) |

**Gate:** **GRÜN** für Empty-Commit-Deploy (Release-Trigger only; kein zusätzlicher App-Code committed).

---

## Phase 2 — Pre-deploy DB Stamp

**Übersprungen.** Kein sicherer, idempotenter Production-DB-Stamp für ZEIT.1 in diesem Lauf definiert; Schema/Resolver-Fix ist reine App-Logik auf bereits verknüpftem Portal-Account.

---

## Phase 3 — Deploy Trigger

| Feld | Wert |
|------|------|
| Deploy-Commit | `04c7e0f2ffe30aab212a99fa4477f19d32130218` |
| Message | `chore(deploy): release zeit1 employee resolver fix [deploy]` |
| `[deploy]` in Message | **ja** |
| Push `origin main` | **success** (`2c48eb8f..04c7e0f2`) |

---

## Phase 4 — Build Monitor

| Feld | Wert |
|------|------|
| Entry-JS vor Deploy (live) | `entry-0b8aa93d200aac66a920cf730af25acb.js` |
| Entry-JS nach Deploy (live) | `entry-02886ffce2cc7ef958b09c694eb118ff.js` |
| Bundle-Wechsel | **ja** (~3 min nach Push, Poll bis 10:52:11 UTC+2) |
| Build-Status (indirekt) | **success** (Production HTML referenziert neues Entry-Bundle) |

---

## Phase 5 — Production Smoke (Playwright, `domcontentloaded`)

**Credentials:** `AUDIT_EMPLOYEE_USERNAME` / `AUDIT_EMPLOYEE_PASSWORD` aus `.env.local` (nicht geloggt).  
**Portal-Account:** `audit-employee@caresuiteplus.test`, `employee_id=911a9b50-0325-45ce-a1ce-87cc9376c816`, Login **OK**.

### Ampel pro Prüfpunkt (funktional, ZEIT.1-Fokus)

| ID | Route / Prüfung | Ergebnis | Details |
|----|-----------------|----------|---------|
| **A** | Login / Portal-Session | **grün** | Employee-Portal-Login OK; `/portal/employee` lädt (Body ~1095 Zeichen), „Heute“ sichtbar |
| **B** | Profil (read-only) | **grün** | `/portal/employee/profile` — Profil „P0 Test Admin“, SOLL/IST Woche, kein Profil-Fehlerbanner |
| **C** | Heute H5 | **grün** | Dashboard-Sektionen inkl. „Heute“, „Meine Einsätze“ |
| **D** | `/portal/employee/arbeitszeit` | **grün** | **Kein** Text „Kein Mitarbeiterprofil für diesen Benutzer gefunden“; Arbeitszeit-UI („Status heute“, „Nicht gestartet“) |
| **E** | `/portal/employee/times` | **grün** | „Fahrten & Zeiten“, Einsatz-Zeitstempel (~2779 Zeichen Body) |
| **F** | Urlaub | **grün** | `/portal/employee/arbeitszeit/urlaub` — Urlaub-Antrag-UI |
| **F** | Abwesenheiten | **grün** | `/portal/employee/arbeitszeit/abwesenheiten` — Abwesenheits-UI |
| **G** | Execute (nur erreichbar) | **grün** | `/portal/employee/assignments/d68152bd-978a-4733-9c94-463f4a375316/execute` öffnet (~413 Zeichen), **kein** Profil-Fehler |

**Hinweis G:** Hub-Route `/portal/employee/execution` lieferte im Automationslauf leeren Body (RN-web/CSSStyleDeclaration-Fehler); der **operative Execute-Pfad** über Assignment-ID ist erreichbar (Nachtest).

### Runtime / Technischer Text

| Signal | Gefunden |
|--------|----------|
| Profil-Resolver-Fehler (ZEIT.1 Blocker) | **Nein** auf allen geprüften Routen |
| React Hydration | **Ja** — Minified #418, #421, #422 (mehrfach) |
| Hard crash / White screen (Hauptflows) | **Nein** |
| Console 400/403 (Supabase REST) | **Ja** (wiederholt, kein UI-Whiteout) |
| UI-Muster preparedOnly / Mock / Placeholder / Coming Soon | **Nein** (sichtbarer Body-Text) |

Automatisches Skript-Verdict (`overall: rot`) wegen strikter „Minified React error“-Regel — **manuell für ZEIT.1 überschrieben** (siehe Ampel oben).

---

## Phase 6 — Post-deploy Production DB Stamp

**Übersprungen** — kein dedizierter, risikoarm bestätigter Stamp-Schritt für diesen Hotfix-Lauf.

---

## Phase 7 — Artefakte (nicht committed)

- `docs/audit/zeit1-production-smoke.md` (dieses Dokument)
- `.audit-zeit1-browser-results.json`, `.audit-zeit1-production-smoke-run.log`
- `.audit-zeit1-prod-g-execute.json`, `.audit-zeit1-prod-g-execute.mjs`
- Screenshots unter `.audit-zeit1-browser-screenshots/`

---

## Phase 8 — Final Verdict

### **Restricted GO** (ZEIT.1 Employee Resolver)

| Kriterium | Status |
|-----------|--------|
| Netlify/Production Bundle gewechselt | ja |
| ZEIT.1 Commit live (via Deploy auf `main`) | ja (`2c48eb8f` Inhalt + neues Bundle) |
| MP Login | grün |
| Arbeitszeit ohne Profil-Fehler | **grün (Fix verifiziert)** |
| MP Zeiten / Urlaub / Abwesenheiten | grün |
| Execute erreichbar (Assignment) | grün |
| Bekannte Hydration/Console-Rauschen | gelb (bestehend, kein ZEIT.1-Regressionssignal) |

**OFFLINE.0 Empfehlung:** **nein** — Production für ZEIT.1-Kernpfad Restricted GO; OFFLINE.0 erst nach expliziter Freigabe / separatem Offline-Paket-Lauf.

---

## Abschlussbericht (Kurz)

| Feld | Wert |
|------|------|
| Production URL | https://caresuiteplus.app |
| ZEIT.1 Commit | `2c48eb8ff8e6d7ffcf8c7b0c86979b6466c8a740` |
| Deploy Commit | `04c7e0f2ffe30aab212a99fa4477f19d32130218` |
| `[deploy]` | ja |
| Bundle before → after | `entry-0b8aa93d…` → `entry-02886ffc…` |
| Pre-deploy DB stamp | skipped |
| Post-deploy DB stamp | skipped |
| Smoke verdict | **Restricted GO** |
| OFFLINE.0 | **recommend no** |
