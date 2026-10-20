# Production Smoke — ZEIT.2 Office Team-Arbeitszeit

**Datum:** 2026-07-04  
**Production URL:** https://caresuiteplus.app  
**ZEIT.2 Code-Commit:** `b367d591a0c2c52ecef1563bed097ca5a469131b` — `feat(wfm): complete office team timekeeping`  
**Deploy-Trigger-Commit:** `c90ea191` — `chore(deploy): release zeit2 office team timekeeping [deploy]`  
**Smoke-Skripte (lokal, nicht committed):**
- `.audit-zeit2-smoke.mjs` → `.audit-zeit2-smoke-results.json`
- `.audit-absence1-p1-prod-smoke-final.mjs` → `.audit-absence1-p1-prod-smoke-final.json` (ABSENCE.1 + Regressionen)
- `.audit-absence1-p0-prod-smoke.mjs` → `.audit-absence1-p0-prod-smoke-results.json` (Referenz — flaky Form-Fills auf gemeinsamer Page; nicht für Verdict verwendet)

**Screenshots:** `docs/audit/zeit2-smoke-screenshots/` (Production-Lauf, lokal)

---

## Phase 1 — Pre-deploy Gate

| Check | Ergebnis |
|-------|----------|
| Branch | `main` = `origin/main` (`b367d591`) |
| HEAD | `b367d591` (= ZEIT.2) |
| `origin/main..HEAD` | leer (sync) |
| Staged / modified tracked files | **keine** |
| Untracked | `.audit-*`, Screenshots, Docs (nicht im Deploy) |
| `stash@{0}` | vorhanden (`wip-absence-p0-and-zeit2-before-isolation`) |
| Code-Änderungen im Deploy | **nein** (nur Empty-Commit-Trigger) |

**Gate:** **GRÜN**

---

## Phase 2 — Deploy Trigger

| Feld | Wert |
|------|------|
| Deploy-Commit | `c90ea191` |
| Message | `chore(deploy): release zeit2 office team timekeeping [deploy]` |
| `[deploy]` in Message | **ja** |
| Push `origin main` | **success** (`b367d591..c90ea191`) |

---

## Phase 3 — Build Monitor

Netlify `build.ignore`: Build nur wenn letzte Commit-Message `[deploy]` enthält (`exit 1` = bauen).

| Feld | Wert |
|------|------|
| Entry-JS vor Deploy (live) | `entry-2744779024923bddfce929ff88b67a52.js` |
| Entry-JS nach Deploy (live) | `entry-307de5b1dc6b4d64f20b7162203b2048.js` |
| Bundle-Wechsel | **ja** (~100 s nach Push, Poll Versuch 5) |
| Build-Status (indirekt) | **success** (Production HTML referenziert neues Entry-Bundle) |

---

## Phase 4 — ZEIT.2 Production Smoke (Office Team-Arbeitszeit)

**Credentials:** `AUDIT_BUSINESS_EMAIL` / `AUDIT_BUSINESS_PASSWORD` aus `.env.local` (nicht geloggt).  
**Skript:** `.audit-zeit2-smoke.mjs` mit `AUDIT_WEB_URL=https://caresuiteplus.app`

### Office Team-Arbeitszeit — Gesamt: **grün**

| Prüfpunkt | Ampel | Details |
|-----------|-------|---------|
| Office Login | grün | Business-Auth + Reload OK |
| 8 KPI-Karten | grün | Heute erfasst, Aktive MA, In Pause, Im Einsatz, Im Büro, Homeoffice, Offen zur Prüfung, Offene Anträge |
| Team-Zeilen („Team heute“) | grün | `hasTeamToday: true` — Zeilen mit Avatar/Status sichtbar |
| Detail-Panel (Klick) | grün | Tagesdetails / Ereignisse expandierbar |
| Events / Abwesenheiten im Detail | ja | Detail-Check grün (Timeline/Empty-State) |
| Technischer Leak (`workforce_`, raw keys) | nein | — |

### Tabs

| Tab | Route | Ampel | Details |
|-----|-------|-------|---------|
| Live-Mitarbeiter | `/business/office/time-tracking/live` | **grün** | Titel „Live-Mitarbeiter“ |
| Export | `/business/office/time-tracking/export` | **grün** | Arbeitszeit-Export, CSV-Actions |
| Mitarbeitenden Anträge | `/business/office/time-tracking/requests` | **gelb** | Tab lädt; Kalender-Sync-Hinweis nur bei ausgewähltem Antrag (by design, siehe ZEIT.2 Audit) |
| Eigene Erfassung | `/business/office/time-tracking` | **grün** | Admin → „Team-Übersicht nutzen“ |

**ZEIT.2 Skript-Summary:** 6 grün / 1 gelb / 0 rot

---

## Phase 5 — ABSENCE.1 Regression & weitere Regressionen

**Skript:** `.audit-absence1-p1-prod-smoke-final.mjs` (separate Employee/Office-Pages, Production-URL hardcoded)  
**Zeitstempel Lauf:** 2026-07-04T00:49:27Z

### ABSENCE.1 — **grün**

| Prüfpunkt | Ergebnis | Details |
|-----------|----------|---------|
| Abwesenheit submit | grün | 16.08.2026 Ausstehend |
| 15.08 Regression (Parser) | grün | Kein „Invalid time value“ |
| Urlaub submit | grün | 01.09–03.09 Ausstehend |
| Office Inbox | grün | „Mitarbeitenden Anträge“, 3 pending |
| Ablehnung ohne Grund blockiert | grün | Validierung sichtbar |
| Ablehnung mit Grund | grün | Urlaub abgelehnt + Begründung im Portal |
| Genehmigung Abwesenheit | grün | Portal „Genehmigt“, 16.08 sichtbar |
| Kalender 15.08–16.08 | grün | `calendar_entry: true` (Eintrag in August-Ansicht) |
| Kalender-Monatsnavigation August | gelb | `calendar_august: false` — Eintrag dennoch gefunden |

### Weitere Regressionen

| Bereich | Ampel | Details |
|---------|-------|---------|
| **PROFILE.1** | **grün** | 14/14 Profil-Tabs |
| **ZEIT.1** | **grün** | Arbeitszeit ohne „Kein Mitarbeiterprofil“ |
| **SIGNATURE.1** | **grün** | `/assist/nachweise/review` — Nachweis/Prüfung |
| **OFFLINE.1** | **gelb** | Offline-Banner auf Arbeitszeit nicht erkannt (gleicher Befund wie P1-Prod-Lauf 2026-07-03) |
| **Execute-Pfad** | **grün** | Assignment-Execute erreichbar (>100 Zeichen Body, kein Profil-Fehler) |

**Hinweis P0-Skript:** `.audit-absence1-p0-prod-smoke.mjs` meldete 7× rot (Form-Submit auf wiederverwendeter Page, leere Inbox nach fehlgeschlagenem Create). P1-Final-Skript ist für ABSENCE.1-Verdict maßgeblich.

---

## Phase 6 — Runtime / Bekannte Gelb-Punkte

| Signal | Gefunden |
|--------|----------|
| React Hydration (#418, #421, #422) | Ja (Console, kein Whiteout auf Kernflows) |
| `requests_tab` Kalender-Hinweis | Gelb — nur bei Antrag-Auswahl sichtbar |
| OFFLINE.1 Banner | Gelb — Text nicht auf Arbeitszeit-Route detektiert |
| Hard crash Team-Arbeitszeit / Export | Nein |

---

## Phase 7 — Artefakte (nicht committed)

- `docs/audit/zeit2-production-smoke.md` (dieses Dokument)
- `.audit-zeit2-smoke-results.json`, `.audit-zeit2-prod-smoke-run.log`
- `.audit-absence1-p1-prod-smoke-final.json`, `.audit-zeit2-prod-absence1-run.log`
- `.audit-absence1-p0-prod-smoke-results.json` (Nebenlauf, nicht verdict-relevant)
- Screenshots unter `docs/audit/zeit2-smoke-screenshots/`

---

## Phase 8 — Final Verdict

### **Restricted GO** (ZEIT.2 Office Team-Arbeitszeit)

| Kriterium | Status |
|-----------|--------|
| Netlify Bundle gewechselt | ja |
| ZEIT.2 Commit live | ja (`b367d591` + neues Bundle) |
| Office Team-Arbeitszeit Kern-UI | grün |
| Alle 4 Tabs nutzbar | ja (1× gelb by design) |
| ABSENCE.1 End-to-End | grün |
| PROFILE.1 / ZEIT.1 / SIGNATURE.1 / Execute | grün |
| OFFLINE.1 Banner | gelb (bestehend, kein ZEIT.2-Blocker) |

**Kein Production NO-GO:** Keine roten ZEIT.2-Checks; ABSENCE.1-Flows auf Production bestätigt.

**Kein vollständiges Production GO:** Bekannte Gelb-Punkte (Kalender-Hinweis im Requests-Tab ohne Auswahl, OFFLINE.1-Banner-Detektion, Hydration-Rauschen) bleiben dokumentiert.

---

## Abschlussbericht (Kurz)

| Feld | Wert |
|------|------|
| Production URL | https://caresuiteplus.app |
| ZEIT.2 Commit | `b367d591` |
| Deploy-Trigger-Commit | `c90ea191` |
| Build Status | **success** (Bundle-Wechsel bestätigt) |
| Bundle before → after | `entry-2744779024923bdd…` → `entry-307de5b1dc6b4d64…` |
| Office Team-Arbeitszeit | **grün** |
| 8 KPI-Karten | **ja** |
| Team-Zeilen | **ja** |
| Detail-Panel | **ja** |
| Events/Absences im Detail | **ja** |
| Tab Live-Mitarbeiter | **grün** |
| Tab Export | **grün** |
| Tab Mitarbeitenden Anträge | **gelb** |
| Tab Eigene Erfassung | **grün** |
| ABSENCE.1 Regression | **grün** |
| PROFILE.1 | **grün** |
| ZEIT.1 | **grün** |
| SIGNATURE.1 | **grün** |
| OFFLINE.1 | **gelb** |
| Execute erreichbar | **ja** |
| Finale Bewertung | **Restricted GO** |
| Smoke-Doku lokal erstellt | **ja** (nicht committed) |
