# ZEIT.2 — Office Team-Arbeitszeit Audit & Abnahme

**Datum:** 2026-07-04 (selective restore from `stash@{0}^3` + manual merge)  
**Scope:** Office `/business/office/time-tracking/team` (Team-Arbeitszeit)  
**Commit:** `feat(wfm): complete office team timekeeping` (separater ZEIT.2-Commit, kein Deploy)

---

## Phase 1 — Ist-Audit (vor ZEIT.2)

### Routen & Tabs

| Route | Komponente | Status vor Fix |
|-------|------------|----------------|
| `/business/office/time-tracking/team` | `TimeTrackingTeamScreen` | Rudimentär |
| `/business/office/time-tracking/live` | `OfficeLiveEmployeesScreen` | Basis Live-Liste |
| `/business/office/time-tracking/export` | `WfmExportScreen` | CSV/PDF/DATEV via `createWfmExportJob` |
| `/business/office/time-tracking/requests` | `WfmEmployeeRequestsOfficeScreen` | ABSENCE.1 vollständig |
| `/business/office/time-tracking` | `TimeTrackingEmployeeScreen` | Eigene Erfassung (Stempeln) |

**Navigation:** `src/lib/navigation/modulenav/officenav.ts` — „Arbeitszeit“, „Live-Mitarbeiter“.

### Root Cause — rudimentäre Anzeige

| Problem | Ursache |
|---------|---------|
| Nur Name + Status-Badge (z. B. „Kathrin Pott · Büro“) | UI renderte nur `employeeName`, `statusLabel`, optional `lastEventAt` / Minuten |
| KPIs nur 3 statt 8 | `getWfmLiveEmployeeOverview` lieferte nur `totalCount`, `onlineCount`; keine Pause/Einsatz/Büro/HO-Aggregation |
| Keine Detailansicht | Kein Klick-Handler, keine Event-Timeline |
| Abwesenheit unsichtbar | `listWfmAbsencesForTeam` nicht in Team-Screen angebunden |
| Warnungen nur global | `WfmRuleWarningsPanel` teamweit, nicht pro Mitarbeiter |
| Schnell-Genehmigung ohne Pflichtbegründung | Inline `reviewWfmAbsenceRequest` mit Platzhalter-Ablehnung |

**Datenjoin:** Sessions aus `workforce_work_sessions` via `listSessionsForDate` waren korrekt; Events wurden nicht geladen. Namen aus `employees` korrekt. Counts real (nicht hardcoded).

---

## Phase 2–6 — Umsetzung ZEIT.2

### Neuer Service

`src/lib/wfm/wfmTeamTodayService.ts` — `getWfmTeamTodayOverview`:

- Join: Sessions + Events + Absences (heute) + Rule Violations + Pending Approvals
- Employee-Profile inkl. `avatar_url`
- KPI-Aggregation (8 Karten)
- Pro-Mitarbeiter-Warnungen (ArbZG + fehlende Endzeit/Pause)

### Display-Helpers

`src/lib/wfm/wfmDisplayHelpers.ts` — deutsche Labels für Quelle, Dauer, Status, Event-Typen.

### UI

| Datei | Rolle |
|-------|-------|
| `TimeTrackingTeamScreen.tsx` | 8 KPIs, Nav-Tabs, Team heute, Realtime-Refresh |
| `WfmTeamTodayEmployeeCard.tsx` | Avatar, Status, Tätigkeit, Zeiten, Quelle, Warnungen |
| `WfmTeamTodayDetailPanel.tsx` | Tagesdetails: Timeline, Abwesenheit, Hinweise |

### ABSENCE.1 Integration

- Tab „Mitarbeitenden Anträge“ unverändert an `WfmEmployeeRequestsOfficeScreen` angebunden
- Inline-Schnellgenehmigung aus Team-Screen entfernt → Link + InfoBanner
- Kalender-Sync-Hinweis in Antrags-Detail ergänzt

### Eigene Erfassung

**Vorhanden:** `TimeTrackingEmployeeScreen` mit `wfmClockIn/Pause/Resume/ClockOut` — kein separates manuelles Buchungsformular. Gap dokumentiert: keine freie Zeitkorrektur-UI im Team-Kontext (Korrekturen über `requestWfmTimeCorrection` + Admin-Genehmigung).

### Export

**Vorhanden (Variant A):** `WfmExportScreen` mit CSV/PDF/DATEV via `createWfmExportJob`. Erfordert `time.tracking.admin.export`. Kein Fake-Button, kein Coming-Soon-Platzhalter nötig.

**ZEIT.2-EXPORT.1 — Root Cause Export-Tab rot:**

| Beobachtung | Ursache |
|-------------|---------|
| Smoke: „export screen missing“ | `.audit-zeit2-smoke.mjs` setzte Auth-Token in `localStorage`, **ohne** `page.reload()` — Profil/Sitzung nicht hydratisiert |
| 3s-Festtimeout nach Navigation | Lazy-Route `/export` + `RequireAuth`-Loading („Sitzung wird geprüft…“) — Titel „Arbeitszeit-Export“ erschien nicht rechtzeitig |
| Kein Produkt-Crash | `WfmExportScreen` rendert korrekt; fehlende `testID`/Ready-State erschwerten deterministisches Warten |

**Fix (minimal):**

| Datei | Änderung |
|-------|----------|
| `WfmExportScreen.tsx` | `testID="wfm-export-screen"`, `exportReady`-Gate (Buttons disabled ohne Mandant/User), InfoBanner beim Laden, Web-Download via `triggerCsvDownload` + guarded `Blob`/`createObjectURL`, ungenutzten `buildWfmPdfStub`-Import entfernt |
| `.audit-zeit2-smoke.mjs` | `page.reload()` nach Login (wie ABSENCE.1-Smoke), `waitForScreenLabel`/`waitForScreenText` statt Festtimeout |
| `zeit2OfficeTeamTimekeeping.test.ts` | +3 Tests: Export-Shell, disabled ohne Session, headless-sicherer Download |

---

## Phase 7 — Tests

```
npx vitest run src/__tests__/wfm/zeit2OfficeTeamTimekeeping.test.ts
npx vitest run src/__tests__/wfm/wfmAbsenceP1.test.ts src/__tests__/wfm/wfmAbsenceApprovalWorkflow.test.ts src/__tests__/wfm/wfmAbsencePortalDateSubmit.test.ts
npx vitest run src/__tests__/wfm/zeit1EmployeeResolverScreens.test.ts
npx vitest run src/__tests__/portal/employeePortalProfileLive.test.ts
```

**Ergebnis (2026-07-04 ZEIT.2-EXPORT.1):**

| Suite | Tests |
|-------|-------|
| `zeit2OfficeTeamTimekeeping.test.ts` | 18/18 grün (+3 Export-Stabilisierung) |
| `wfmExportService.test.ts` | 2/2 grün |
| `wfmAbsenceP1.test.ts` | 18/18 grün |
| `wfmAbsenceApprovalWorkflow.test.ts` | 9/9 grün |
| `wfmAbsencePortalDateSubmit.test.ts` | 5/5 grün |
| `zeit1EmployeeResolverScreens.test.ts` | 4/4 grün |
| `employeePortalProfileLive.test.ts` | 24/24 grün |

**Gesamt:** 80/80 grün — keine ABSENCE-/Portal-Regression.

Abgedeckt: KPI-Labels, enriched rows, ABSENCE.1 requests wiring, Export-Tab ohne Crash (leer/bereit), Export-Buttons disabled ohne Session, Export-Service leerer Monat, session+event join, deutsche Labels ohne raw keys, ArbZG-Warnungen, `portalRejectionReason` erhalten.

**Früherer Stand (restore):** 75/75 grün (15 ZEIT.2 + 60 Regression).

---

## Phase 8 — Browser Smoke (lokal)

**Skript:** `.audit-zeit2-smoke.mjs`  
**Dev-Server:** `http://localhost:8090` (neu gestartet nach Export-Fix)  
**Ergebnis (2026-07-04 ZEIT.2-EXPORT.1):** `.audit-zeit2-smoke-results.json` — **6 grün / 1 gelb / 0 rot**

| Check | Ampel | Details |
|-------|-------|---------|
| office_login | grün | Business-Auth OK (+ reload nach Token-Injection) |
| team_kpis_and_rows | grün | 8 KPIs + „Team heute“ |
| team_employee_detail | grün | Expand/Empty-State OK |
| live_tab | grün | Live-Mitarbeiter |
| requests_tab | gelb | Kalender-Hinweis nur sichtbar wenn Antrag ausgewählt (by design); **nicht blockierend** — Smoke prüft Tab ohne Antrag-Auswahl; betrifft ABSENCE.1 Detail-UI, nicht ZEIT.2 Team/Export; produktionsrelevant nur bei gezielter Antragsprüfung |
| own_time_entry | grün | Admin ohne MA-Profil → „Team-Übersicht nutzen“ |
| **export_tab** | **grün** | `wfm-export-screen` sichtbar, CSV-Export-Actions oder Locked-Banner |

**Screenshots:** `docs/audit/zeit2-smoke-screenshots/` inkl. `export.png` (lokal)

**Vorher (restore, vor Fix):** 5 grün / 1 gelb / 1 rot — export_tab rot („export screen missing“).

---

## Offene Gaps (ohne Migration/RLS)

| Gap | Empfehlung |
|-----|------------|
| Team-Liste zeigt nur MA mit Session oder Abwesenheit heute | Optional: alle aktiven MA des Mandanten einblenden (separate Query) |
| Kalender-Block im Detail | Nur Abwesenheitsdaten; kein Live-Kalender-Widget |
| Manuelle Zeitbuchung Office | Nur Stempeln, kein Freitext-/Retro-Formular |
| `listWfmAbsencesForTeam` Permission | Benötigt `office.employees.absences.view` — ohne Permission keine Abwesenheits-Overlay |
| Pending-Korrekturen KPI | Zählt nur bei `office.employees.absences.approve` (shared approvals table) |

---

## Matrix — User Spec

| Anforderung | Status |
|-------------|--------|
| 8 KPI-Karten | ✅ |
| Team heute: Name, Avatar, Status, Tätigkeit, Zeiten, Quelle, Warnungen | ✅ |
| Detail bei Klick | ✅ |
| Sessions/Events Join | ✅ |
| Abwesenheit sichtbar | ✅ (mit Permission) |
| Mitarbeitenden Anträge (ABSENCE.1) | ✅ |
| Eigene Erfassung | ✅ (Stempeln) |
| Export | ✅ (CSV/PDF/DATEV, Web-Download guarded) |
| Kein Fake Export/Manual UI | ✅ |
| Tests 12+ | ✅ (18 ZEIT.2 + 62 Regression = 80) |
| Browser Smoke | 6 grün / 1 gelb / 0 rot (export stabil) |
| ABSENCE P1 preserved | ✅ (`portalRejectionReason`, calendar sync exports) |
| `WfmEmployeeRequestsOfficeScreen` untouched | ✅ |

---

## Commit-Readiness

| Kriterium | Status |
|-----------|--------|
| Export-Tab lokal grün | ✅ |
| Export fachlich (Variant A) | ✅ — Monats-CSV/PDF/DATEV via `createWfmExportJob` |
| ABSENCE.1 unberührt | ✅ |
| Migrationen/RLS unberührt | ✅ |
| Stash `stash@{0}` vorhanden | ✅ |
| Quarantäne-Ordner vorhanden | ✅ (`_local-quarantine-zeit2-restore-20260704-014224`) |
| Tests | 80/80 grün |
| Browser Smoke (Commit-Lauf) | 6 grün / 1 gelb / 0 rot |
| Commit ausgeführt | ✅ `feat(wfm): complete office team timekeeping` |
| Push/Deploy | ❌ (bewusst nicht in diesem Lauf) |

## Deploy-Empfehlung

Push ohne `[deploy]` — Netlify-Build erst nach expliziter Freigabe mit `[deploy]` in der Commit-Message oder manuellem Build-Hook.
