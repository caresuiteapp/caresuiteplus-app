# ZEIT.3 — Office-Arbeitszeiterfassung: Vollsystem-Plan

**Datum:** 2026-07-04  
**Basis-HEAD (Start):** `72b51e0a`  
**Scope:** Office Team-Arbeitszeit → vollständiges Historie-/Prüf-/Export-System mit Start-/End-Ampel

---

## 1. Ausgangslage (ZEIT.1 / ZEIT.2)

| Bereich | Ist (vor ZEIT.3) |
|---------|-------------------|
| MP Arbeitszeit (`/portal/employee/arbeitszeit`) | Stempeln, Tagesstatus, Zeitblöcke — **live** |
| Office Team (`/business/office/time-tracking/team`) | KPIs **nur heute**, Live-MA-Karten, Detail ohne Historie |
| Export (`/export`) | CSV/PDF/DATEV Monats-Export Sessions |
| Korrekturen | Approval-Queue `time_correction`, kein Office-Freitext-Nachtrag |
| Execute | Start/Ende ohne Planabweichungs-Ampel |
| DB | `workforce_*` Tabellen (0190) inkl. `metadata`, `workforce_audit_log` |

Referenz: `zeit2-office-team-timekeeping.md`, `zeit3-gap-review.md`

---

## 2. ZEIT.2-Gaps → ZEIT.3-Ziele

| Gap ZEIT.2 | ZEIT.3-Lösung |
|------------|---------------|
| Nur Tages-KPIs | Zeitraum-Presets + KPIs pro Periode |
| Keine Historie | `getWfmOfficeTimeOverview` + Tabelle |
| Kein Office-Nachtrag | `WfmOfficeManualEntryPanel` + `createWfmOfficeManualEntry` |
| Korrektur nur via Antrag | `applyWfmOfficeTimeCorrection` mit Audit |
| Keine Plan-Ampel Execute | `wfmVisitDeviationAmpelService` + Gate in start/endService |
| Kein Prüfstatus Office | `reviewWfmOfficeTimeEntry` (genehmigt/abgelehnt/exportiert/gesperrt) |

---

## 3. Daten-/UI-Konzept (ohne Migration)

**Keine neue Migration.** Wiederverwendung:

- `workforce_work_sessions` / `workforce_time_events` — Quelle Ist-Zeiten
- `workforce_audit_log` — Audit-Trail (via `writeWfmOfficeAudit`)
- In-Memory-Overlay `wfmOfficeTimekeepingStore` — Prüfstatus, Korrektur-Overlays, Office-Meldungen, Begründungen (Demo + Supabase-Fallback)

**Neue Typen:** `src/types/modules/wfmOfficeTimekeeping.ts`

**Kern-Services:**

| Service | Rolle |
|---------|-------|
| `wfmVisitDeviationAmpelService` | Start/End/Gesamt-Ampel (grün/gelb/rot/blau) |
| `wfmOfficeDateRange` | Zeitraum-Presets |
| `wfmOfficeTimekeepingService` | Historie, KPIs, Korrektur, Prüfung, Export-Warnungen |
| `wfmOfficeAuditService` | Revisionssichere Einträge |

**UI:**

| Komponente | Route |
|------------|-------|
| `WfmOfficeTimeHistoryPanel` | `/business/office/time-tracking/team` |
| `WfmOfficeManualEntryPanel` | `/business/office/time-tracking` (Eigene Erfassung Office) |
| `WfmVisitDeviationJustificationModal` | Execute `/portal/employee/assignments/{id}/execute` |
| Export-Warnungen | `/business/office/time-tracking/export` |

---

## 4. Ampelsystem (verbindlich)

### Schwellen (Start & Ende identisch)

| Ampel | Abweichung | Aktion MP |
|-------|------------|-----------|
| Grün | 0–5 Min. | Erlauben |
| Gelb | >5–10 Min. | Erlauben + Warnung |
| Rot | >10–20 Min. | Pflicht-Pop-up + Begründung ≥10 Zeichen |
| Blau | >20 Min. | Block bis Begründung, dann Office-Meldung |

**Gesamt-Ampel:** max(Start, Ende) — Priorität Blau > Rot > Gelb > Grün

**Execute-Gate:** `startService` / `endService` prüfen `checkVisitDeviationGate`; Rot/Blau ohne abgesendete Begründung → Fehler.

---

## 5. Prüf-/Freigabeprozess

Status: `open` → `pending_review` → `approved` | `rejected` | `corrected` → `exported` | `locked`

- Rot/Blau automatisch `pending_review` + Office-Meldung
- Ablehnung nur mit Grund
- Exportierte/gesperrte Einträge: Korrektur blockiert (Warnung)

---

## 6. Export

- Bestehender CSV/PDF/DATEV-Export **unverändert** (Regression ZEIT.2)
- Neu: `getWfmOfficeExportWarnings` — Hinweis bei offenen/Rot-Blau-Einträgen vor Export

---

## 7. Tests (Vitest)

Datei: `src/__tests__/wfm/zeit3OfficeTimekeeping.test.ts` — 39 Tests (Ampel 31–71 abgedeckt, Workflow, Historie)

Regression: `zeit2OfficeTeamTimekeeping.test.ts` — 18/18 grün

---

## 8. Bewusst ausgelagert (Follow-up)

| Track | Inhalt |
|-------|--------|
| ZEIT.3.1 | Vollständige Assignment-Planzeit-Anbindung live (Supabase JOIN) |
| ZEIT.3.2 | Mitarbeiter-Dropdown Office-Nachtrag aus Team-Query |
| ZEIT.3.3 | Persistente Overlays in Session/Event-`metadata` (ohne Migration optional JSONB-Patch) |
| ZEIT.3.4 | DATEV-Export nur genehmigte Einträge (Filter in `wfmExportService`) |

---

## 9. Deploy

**Kein Deploy in ZEIT.3.** Push nur nach expliziter Freigabe.
