# ZEIT.3.1 — Office-Arbeitszeit Daten-JOIN Hotfix

**Datum:** 2026-07-04  
**Ausgangs-HEAD:** `ce85a80a` (nach Production-ZEIT.3 Deploy `c993ff8c`)  
**Scope:** Vollständiger Zeitraum-JOIN für `/business/office/time-tracking/team`

## Root Cause

Die Office-Historie (`getWfmOfficeTimeOverview` → `buildEntriesForDate`) baute Zeilen **ausschließlich** aus:

- `workforce_work_sessions` + `workforce_time_events` (Ist-Zeiten)
- In-Memory-Overlays (`wfmOfficeTimekeepingStore`)
- Manuellen Nachträgen

**Nicht** einbezogen wurden:

| Quelle | Tabelle/Service | Folge |
|--------|-----------------|-------|
| Geplante Einsätze | `assignments` (`planned_start_at`, `planned_end_at`, `assignment_date`) | Einsätze ohne Session fehlten komplett |
| Mitarbeitende | `employees` | Nur MA mit Ist-Eintrag im Filter |
| Planzeiten | — | `plannedStartAt`/`plannedEndAt` nur aus Overlays → UI „Plan: — – —“ |
| KPIs | — | Zählung nur über vorhandene Ist-Zeilen → geplante/fehlende Einsätze = 0 |

## Lösung — JOIN-Strategie

Neue Module:

1. **`wfmOfficePlannedVisitRepository.ts`** — lädt geplante Einsätze aus `assignments` (Zeitraum via `assignment_date`), Demo-Seed für Tests
2. **`wfmOfficeDataJoinService.ts`** — merge geplant + ist + manuell

Ablauf in `getWfmOfficeTimeOverview`:

```
assignments (Plan) ──┐
sessions/events (Ist)├── joinOfficeTimekeepingData() ──► entries + KPIs
manual entries ──────┤
employees + absences ┘
```

Join-Key: `{employeeId}:{assignmentId}:{workDate}`

## Zeilentypen (`rowKind`)

| Typ | Bedingung | Status/Ampel |
|-----|-----------|--------------|
| `planned_with_actual` | Plan + Ist | Ampel nur wenn Plan **und** Ist vorhanden |
| `planned_missing_actual` | Plan ohne Ist | `pending_review`, Flag `missing_booking`, keine Ampel |
| `unplanned_actual` | Ist ohne Plan-Zuordnung | Flag `unplanned`, Hinweis im UI |
| `manual_entry` | Office-Nachtrag/Korrektur | bestehende ZEIT.3-Logik |
| `session_only` | Session ohne Plan-Match | Büro/Homeoffice ohne Einsatzplan |

## UI / Fallback-Texte

- Plan fehlt: „Planzeit fehlt“ / „Kein geplanter Einsatz zugeordnet“
- Ist fehlt: „Noch nicht erfasst“
- Ampel: „Start/Ende: nicht erfasst“ statt falscher Farben

Neue KPIs: geplante Einsätze, erfasste Einsätze, fehlende/ungeplante Buchungen, MA mit Arbeitszeit/geplant/abwesend.

## Tests

`src/__tests__/wfm/zeit31OfficeTimekeepingDataJoin.test.ts` — 11 Tests

Regression:

- `zeit3OfficeTimekeeping.test.ts` — 39/39
- `zeit2OfficeTeamTimekeeping.test.ts` — 18/18

## Browser-Smoke (lokal)

Empfohlen nach `npx expo export -p web` + `npx serve -s dist -l 4173`:

1. `/business/office/time-tracking/team` — Historie-Panel
2. Zeitraum Heute + 2026-07-01…2026-07-04
3. Geplante Einsätze + fehlende Buchungen sichtbar
4. Planzeiten nicht mehr „— – —“ wenn in `assignments` vorhanden
5. Mitarbeitendenfilter (Buttons)
6. Execute-Ampel Regression unverändert (kein Code in Execute-Pfad)

## Gelb-Punkte / offen

- Abwesenheitszeilen erscheinen nicht als eigene Tabellenzeile (nur KPI `employeesAbsent` + Team-heute-Karten)
- Wiederkehrende Einsätze: nur direkte `assignments`-Zeilen im Datumsbereich (kein Recurrence-Expand)
- Detail-Aktionen „Zuordnen“ als dedizierter Flow noch nicht separat (Korrektur/Nachtrag über bestehende Office-Aktionen)

## Deploy-Empfehlung

Nach Review + lokalem Browser-Smoke mit echten Test-Einsätzen deployen. Kein `[deploy]` in diesem Commit.
