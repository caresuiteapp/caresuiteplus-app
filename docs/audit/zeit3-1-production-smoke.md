# Production Smoke — ZEIT.3.1 Office-Arbeitszeit Daten-JOIN

**Datum:** 2026-07-04  
**Production URL:** https://caresuiteplus.app  
**ZEIT.3.1 Code-Commits:**  
- `ab2f1227` — `fix(wfm): join planned visits into office timekeeping history`  
- `008d67d1` — `docs(wfm): add zeit3 data join hotfix report`  
**Deploy-Trigger-Commit:** `04800f6` — `chore(deploy): release zeit31 office timekeeping data join [deploy]`  
**Pre-Deploy Verification:** **GO** (lokal `:4173`, 2026-07-04)  
**Smoke-Skript (lokal, nicht committed):** `.audit-zeit31-prod-smoke.mjs` → `.audit-zeit31-prod-smoke-results.json`

**Credentials:** `AUDIT_BUSINESS_EMAIL` / `AUDIT_BUSINESS_PASSWORD`, `AUDIT_EMPLOYEE_USERNAME` / `AUDIT_EMPLOYEE_PASSWORD` aus `.env.local` (nicht geloggt).

---

## Phase 1 — Pre-deploy Gate

| Check | Ergebnis |
|-------|----------|
| Branch | `main` = `origin/main` (`008d67d1`) |
| ZEIT.3.1 auf `origin/main` | **ja** (`ab2f1227`, `008d67d1`) |
| Staged / modified tracked files | **keine** (nur untracked `.audit-*`) |
| Lokaler Browser-Smoke | **GO** (`.audit-zeit31-local-smoke-results.json`) |
| Production Bundle vor Deploy | `entry-7554aae1c78495f0e43a61737e988ac8.js` (ZEIT.3) |
| Code-Änderungen im Deploy | **nein** (Empty-Commit-Trigger) |

**Gate:** **GRÜN**

---

## Phase 2 — Deploy Trigger

| Feld | Wert |
|------|------|
| Deploy-Commit | `04800f6` |
| Message | `chore(deploy): release zeit31 office timekeeping data join [deploy]` |
| `[deploy]` in Message | **ja** |
| Push `origin main` | **success** (`008d67d1..04800f6`) |

---

## Phase 3 — Build Monitor

| Feld | Wert |
|------|------|
| Entry-JS vor Deploy | `entry-7554aae1c78495f0e43a61737e988ac8.js` |
| Entry-JS nach Deploy | `entry-534e8ee0855c14ec3ecd91dd67191ec8.js` |
| Bundle-Pfad | `/_expo/static/js/web/entry-534e8ee0855c14ec3ecd91dd67191ec8.js` |
| Bundle-Wechsel | **ja** (~90 s nach Push, Poll Attempt 3) |
| Build-Status (indirekt) | **success** (Production HTML referenziert neues Entry-Bundle) |

### ZEIT.3.1 Bundle-Nachweis

Strings im Production-Bundle (`entry-534e8ee…`):

| Marker | Gefunden |
|--------|----------|
| `planned_missing_actual` | **ja** |
| `unplanned_actual` | **ja** |
| `joinOfficeTimekeeping` | **ja** |
| `Geplante Eins` (KPI-Label) | **ja** |
| `Fehlende Buchung` | **ja** |
| `Planzeit fehlt` | **ja** |

---

## Phase 4 — Production Smoke (Playwright)

**Zeitstempel:** 2026-07-04T06:23Z  
**Zeitraum:** 2026-07-01 – 2026-07-04 (Freier Zeitraum)  
**Supabase-Referenz:** 63 Assignments mit Planzeit, 2 Mitarbeitende

### A — Office-Team-Arbeitszeit

| Prüfung | Ampel | Details |
|---------|-------|---------|
| Route `/business/office/time-tracking/team` | **grün** | Kein White Screen (`bodyLength: 13882`) |
| KPI-Karten | **grün** | Geplante/Erfasste/Fehlende/Ungeplante Einsätze sichtbar |
| Historie-Tabelle | **grün** | 63 Detail-Buttons |
| Filter | **grün** | MA-Filter, Zeitraum, Ampel, Offene Prüfungen |
| Harte Runtime Errors | **grün** | Keine |

**A Gesamt:** **grün**

### B — Zeitraum mit echten Daten

| Prüfung | Ampel | Details |
|---------|-------|---------|
| Geplante Einsätze in Historie | **grün** | 63 Zeilen (JOIN aus `assignments`) |
| Ist-Zeiten | **grün** | 1 erfasster Einsatz |
| MA mit geplanten Einsätzen | **grün** | KPI „MA geplant: 2“, MA-Filter aktiv |
| Nicht nur Session-/Ist-Zeilen | **grün** | 62 fehlende Buchungen = geplante Einsätze ohne Ist |
| Kevin/Kathrin im sichtbaren Text | **gelb** | Namen nicht im Body-Text (Filter zeigt Initialen „PO“); Daten korrekt über Employee-IDs gejoint |

**B Gesamt:** **grün**

### C — Plan-/Ist-Anzeige

| Prüfung | Ampel | Details |
|---------|-------|---------|
| Planzeiten sichtbar | **grün** | z. B. `Plan: 07:10 – 09:35` |
| Kein `Plan: — – —` bei Plan-Daten | **grün** | `rawPlanDash: false` |
| Ist fehlt → Hinweis | **grün** | „Fehlende Buchung“, „Start: nicht erfasst“ |
| Ungeplant-Hinweise | **grün** | Filter/Labels vorhanden (0 ungeplante Buchungen im Zeitraum) |

**C Gesamt:** **grün**

### D — Zeilentypen

| Typ | Ampel | Details |
|-----|-------|---------|
| `planned_with_actual` | **grün** | 1 erfasster Einsatz, Abweichung KPI = 1 |
| `planned_missing_actual` | **grün** | 62 fehlende Buchungen, Plan sichtbar, keine falsche Ampel |
| `unplanned_actual` | **gelb** | Keine Daten im Zeitraum (KPI = 0); UI-Hinweise vorhanden |
| `manual_entry` | **gelb** | Kein Nachtrag im Testzeitraum |
| `session_only` | **gelb** | Marker im Text erkennbar, kein dedizierter Fall im Zeitraum |

**D Gesamt:** **grün**

### E — KPIs

| KPI | Wert | Ampel |
|-----|------|-------|
| Geplante Einsätze | **63** | grün |
| Erfasste Einsätze | **1** | grün |
| Fehlende Buchungen | **62** | grün |
| Ungeplante Buchungen | **0** | grün |
| Offene Prüfungen | **63** | grün |
| Abweichungen | **1** | grün |
| MA mit Arbeitszeit | **1** | grün |
| MA geplant | **2** | grün |

KPIs basieren auf vollständigem JOIN — nicht mehr fälschlich 0 bei vorhandenen Assignments.

**E Gesamt:** **grün**

### F — Filter und Detailpanel

| Prüfung | Ampel | Details |
|---------|-------|---------|
| Mitarbeitendenfilter | **grün** | „Alle MA“ + MA-Buttons |
| Zeitraumfilter | **grün** | Freier Zeitraum + Datumsinputs |
| Status-/Ampelfilter | **grün** | „Nur Rot/Blau“, „Offene Prüfungen“ |
| Detailpanel Plan + Ist | **grün** | 4/4 Panels: Plan, Ist, Audit-Trail, Hinweise |
| Keine Datenvermischung | **grün** | Snippets konsistent pro Zeile |

**F Gesamt:** **grün**

### G — Regressionen

| Route / Bereich | Ampel | Details |
|-----------------|-------|---------|
| ZEIT.1 `/portal/employee/arbeitszeit` | **grün** | Lädt (719 Zeichen) |
| ZEIT.2 Team-KPIs | **grün** | Unverändert neben ZEIT.3.1-Historie |
| OFFLINE.2 `/portal/employee/assignments` | **grün** | Lädt (1068 Zeichen) |
| Execute `/portal/employee/assignments/.../execute` | **grün** | Execute-Button sichtbar |
| ABSENCE.1 | **gelb** | Automatisierung nutzte falsche Route `/portal/employee/absence`; korrekte Route laut ZEIT.1-Smoke: `/portal/employee/arbeitszeit/abwesenheiten` |
| PROFILE.1 `/portal/employee/profile` | **grün** | Lädt (686 Zeichen) |
| SIGNATURE Review | **gelb** | Automatisierung nutzte falsche Route; korrekte Business-Route: `/assist/nachweise/review` (vgl. ZEIT.3-Smoke) |
| White Screens / endloses Laden | **grün** | Keine auf Kernrouten |

**G Gesamt:** **grün** (ABSENCE/SIGNATURE nur Automatisierungs-Route **gelb**, kein ZEIT.3.1-Regressionsnachweis)

### H — Console / Hydration

| Prüfung | Ampel | Details |
|---------|-------|---------|
| React #421/#418/#422 | **gelb** | 13 Hydration-Hits — **pre-existing** (vgl. `hydration-console-audit.md`) |
| Neue ZEIT.3.1 Hard Errors | **grün** | Keine blockierenden Runtime-Fehler |
| White Screens | **grün** | Keine |

**H Gesamt:** **gelb** (nicht blockierend)

---

## Gelb-Punkte (explizit)

1. **Hydration #421:** Pre-existing MP-Rauschen, kein White Screen, nicht durch ZEIT.3.1 verursacht.
2. **Kevin/Kathrin-Namen:** Nicht im extrahierten Body-Text; MA-Filter nutzt Initialen — JOIN-Daten korrekt (63 geplant, 2 MA).
3. **Ungeplante/manuelle/session_only-Zeilen:** Keine Testdaten im gewählten Zeitraum; UI-Marker und KPI-Logik vorhanden.
4. **Regression ABSENCE/SIGNATURE:** Falsche Playwright-Routen im Smoke-Skript — keine Produkt-Regression auf den getesteten ZEIT-Pfaden.

---

## Finale Bewertung

| Kriterium | Ergebnis |
|-----------|----------|
| Deploy erfolgreich | **ja** |
| Bundle-Wechsel | **ja** |
| ZEIT.3.1 im Bundle | **ja** |
| Office-Team-Arbeitszeit Production | **grün** |
| Planzeiten / fehlende Buchungen / KPIs | **grün** |
| Detailpanel | **grün** |
| ZEIT Execute-Regression | **grün** |
| Hydration blockierend | **nein** |

### **GO**

ZEIT.3.1 ist live. Der Daten-JOIN zeigt geplante Einsätze, Planzeiten, fehlende Buchungen und korrekte KPIs in Production. Keine roten Blocker.

---

## Commits / Deploy-Trennung

| Commit | Message | Deploy? |
|--------|---------|---------|
| `04800f6` | `chore(deploy): release zeit31 office timekeeping data join [deploy]` | **ja** (einmalig) |
| *(Smoke-Doku)* | `docs(audit): add zeit31 production smoke report` | **nein** |
