# ZEIT.3 — Gap Review (ZEIT.1 / ZEIT.2 sichtbare Lücken)

**Datum:** 2026-07-04  
**Basis-HEAD:** `7b47c82b`  
**Scope:** Dokumentation offener Lücken — **kein Retro-Booking-Build**  
**Referenz-Audits:** `zeit1-employee-resolver-fix.md`, `zeit2-office-team-timekeeping.md`, `timekeeping-system-audit-and-blueprint.md`

---

## Executive Summary

ZEIT.1 (MP-Resolver) und ZEIT.2 (Office Team-Arbeitszeit) sind **funktional grün** (80/80 Tests ZEIT.2-Stand, 137/137 S1-Sprint). Verbleibende Lücken sind **produktiv akzeptiert** oder **Follow-up-Tracks** — keine S1-Blocker.

---

## ZEIT.1 — Mitarbeitendenportal (Restpunkte)

| Gap | Status | Priorität | Empfehlung |
|-----|--------|-----------|------------|
| Console 400 auf `wfm_work_sessions` (Filter/leer) | Gelb | Niedrig | CONSOLE.2 — kein ZEIT.1-Defekt |
| Hydration #421 auf MP-Routen | Gelb | Mittel | HYDRATION.1 |
| Kein Offline-Write für Stempeln | Rot (Design) | — | OFFLINE-Write-Engine explizit out of scope |
| Korrekturantrag-UI im MP | Teilweise | Mittel | `requestWfmTimeCorrection` existiert; UX-Ausbau ZEIT.4 |
| Fahrten & Zeiten vs. Arbeitszeit-Split | Grün | — | Zwei Routen bewusst getrennt |

**ZEIT.1 Verdict:** Produktionsreif für Restricted GO.

---

## ZEIT.2 — Office Team-Arbeitszeit (Restpunkte)

Aus `zeit2-office-team-timekeeping.md` § Offene Gaps, bestätigt S1:

| Gap | Beschreibung | Blockierend? |
|-----|--------------|--------------|
| Team-Liste nur MA mit Session/Abwesenheit heute | MA ohne heutige Aktivität unsichtbar | Nein — ZEIT.2.1 optional |
| Kalender-Block im Detail | Nur Abwesenheitsdaten, kein Live-Widget | Nein |
| Manuelle Retro-Zeitbuchung Office | Nur Stempeln (`TimeTrackingEmployeeScreen`), kein Freitext-Formular | Nein — Korrektur über Approval-Queue |
| `listWfmAbsencesForTeam` Permission | Braucht `office.employees.absences.view` | Nein — by design |
| Pending-Korrekturen KPI | Nur mit `office.employees.absences.approve` | Nein |
| Requests-Tab Smoke gelb | Kalender-Hinweis nur bei Antrag-Auswahl | Nein |

**Export-Tab:** ZEIT.2-EXPORT.1 **grün** (Smoke + 3 Tests).

---

## Querschnitt WFM / Timekeeping

| Thema | Ist | Gap | Track |
|-------|-----|-----|-------|
| MP Stempeln | ✅ | Offline-Persistenz | OFFLINE.4+ |
| Office Team KPIs (8) | ✅ | Alle MA des Mandanten | ZEIT.2.1 |
| DATEV/CSV/PDF Export | ✅ | Kein Echtzeit-Export | — |
| Abwesenheit MP + Office | ✅ ABSENCE.1 | Duplikat-Prüfung Portal-Submit | ABSENCE.2 |
| Assist ↔ WFM Sync | Teilweise | Nicht ZEIT.2-Scope | Assist-Track |
| ArbZG-Warnungen Team | ✅ | Nur Anzeige, keine Auto-Block | By design |

---

## Smoke-Ampel ZEIT (Referenz)

| Smoke | Ergebnis | Datum |
|-------|----------|-------|
| ZEIT.1 Production | Grün (Hydration gelb) | 2026-07-03 |
| ZEIT.2 Local `:8090` | 6 grün / 1 gelb / 0 rot | 2026-07-04 |
| S1 Vitest zeit1+zeit2 | 22/22 grün | 2026-07-04 |

---

## Empfohlene Follow-up-Reihenfolge

1. **ZEIT.2.1** — Team-Liste: alle aktiven MA (optional Query)
2. **ZEIT.4** — MP Zeitkorrektur-UX
3. **ZEIT.5** — Office Retro-Buchung (nur mit Approval-Workflow)
4. **CONSOLE.2 / HYDRATION.1** — Querschnitt MP/Office

**S1-Entscheidung:** Nur Dokumentation — **kein Code**.

---

## Deploy-Hinweis

ZEIT.2-Commit bereits lokal (`feat(wfm): complete office team timekeeping`). ZEIT.1 früher deployed. ZEIT.3-Gaps blockieren **kein** OFFLINE.3-Deploy.
