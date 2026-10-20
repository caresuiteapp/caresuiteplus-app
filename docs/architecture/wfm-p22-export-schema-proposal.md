# WFM P2.2 — Export-Schema & Architektur (Proposal)

**Datum:** 2026-07-08  
**Status:** Schema **freigegeben** (F1–F7) — Migration/Code noch ausstehend  
**Basis:** P2.1 FINAL GO (`docs/audit/wfm-p21-abschlussbericht.md`)  
**Verwandte Dokumente:** `docs/architecture/wfm-phase2-schema-approval.md` (Option B, Post-Export-Regeln)

---

## 1. Executive Summary

WFM P2.2 baut auf der P2.1-Persistenz (`workforce_time_entry_reviews`, `workforce_time_review_actions`) auf und macht **geprüfte Arbeitszeitdaten exportierbar** — mit nachvollziehbaren Exportläufen, Exportpositionen und Audit.

**Ziel P2.2:**

- Office kann für einen Zeitraum exportfähige Reviews identifizieren, einen Export-**Draft** erstellen, validieren und **finalisieren**.
- Jede final exportierte Position wird als **Snapshot** in `workforce_time_export_items` persistiert.
- Export-Historie und interner CSV-Download aus dem Snapshot — **kein** DATEV-Vollausbau.

**Explizit nicht in P2.2:**

| Ausgeschlossen | Phase / Grund |
|----------------|---------------|
| DATEV-Vollausbau / Lohnabrechnung | Gesonderter Scope |
| Nachträge persistent | P2.4 |
| Fahrzeitregeln | P2.6 |
| Team-Meeting-Zeitlogik | P2.7 |
| Automatische Re-Export-/Drift-Pipeline | P2.3 |
| Korrekturexport-Workflow | P2.3 |
| Production-Apply / Deploy | Gesperrt bis Implementierungsgate |

**Abgrenzung zu fremdem Scope:** Migration `0246_platform_console_foundation_live.sql` und `platformConsole`-Code sind **nicht** Teil von P2.2.

---

## 2. P2.1 Ausgangspunkt

### Tabellen (Production angewendet via 0240)

| Tabelle | Zweck |
|---------|--------|
| `workforce_time_entry_reviews` | Persistenter Office-Prüfstatus pro Zeitblock |
| `workforce_time_review_actions` | Append-only Review-Lifecycle |

### Review-Status (P2.1 CHECK-Constraint)

| Status | Bedeutung |
|--------|-----------|
| `open` | Kein offener Prüfzwang |
| `pending_review` | Prüfpflichtig |
| `needs_clarification` | Rückfrage offen |
| `approved` | Office-Freigabe |
| `rejected` | Abgelehnt |
| `corrected` | Korrektur durchgeführt |
| `locked` | Terminal / gesperrt |
| `superseded` | Ersetzt |

### Review-Actions (append-only)

Bereits in P2.1: `created`, `status_changed`, `review_approved`, `review_rejected`, `review_corrected`, `clarification_requested`, `comment_added`, `review_reopened`, `locked`, `superseded`, `justification_updated`.

**Kein** `export_marked` in P2.1 (bewusst ausgeschlossen).

### `export_blocking` (Review-Flag)

Bereits vorhanden auf `workforce_time_entry_reviews.export_blocking` (BOOLEAN).  
Service-Logik P2.1: `deriveExportBlocking()` — blockiert Export auf Review-Ebene außer bei `approved`, `locked`, `superseded`.

### Bewusst fehlend in P2.1

- Keine `export_status`-Spalte auf Reviews
- Keine `workforce_time_export_items`
- Kein Export-Snapshot / Item-Protokoll
- `wfmExportService` exportiert weiterhin **Sessions** ohne Review-Join
- UI-`exportStatus` (`not_exported` / `export_ready` / `exported`) nur Overlay, nicht DB-persistent
- `getWfmOfficeExportWarnings` ohne DB-Export-Items

### Bestehende Export-Infrastruktur (0193)

`workforce_export_jobs` — Job-Header mit `period_year`, `period_month`, `status` (`pending` | `processing` | `completed` | `failed`), RLS mit `time.tracking.admin.export`.

P2.2 **erweitert** diese Tabelle; keine parallele Batch-Wahrheit.

---

## 3. Verbindliche P2.2 Fachregeln

### A) Exportfähigkeit nach Review-Status

| Review-Status | Exportfähig in P2.2? |
|---------------|----------------------|
| `open` | **Nein** |
| `pending_review` | **Nein** |
| `needs_clarification` | **Nein** |
| `approved` | **Ja** (wenn weitere Bedingungen erfüllt) |
| `rejected` | **Nein** |
| `corrected` | **Nein** (direkt) — siehe B |
| `locked` | **Nein** (neu exportieren) — historischer/gesperrter Zustand |
| `superseded` | **Nein** |

#### Kernregel (verbindlich)

Ein Review ist **exportfähig**, wenn **alle** Bedingungen gelten:

1. `review_status = 'approved'`
2. `export_blocking = false`
3. **Keine** bereits **finalisierte** Exportposition für denselben `reference_key` existiert (über `workforce_time_export_items` + finalized Job)
4. **Keine** fachlichen Blocker aus Policy/Warnungen (z. B. offene Rot/Blau-Abweichung, fehlende Pflichtdaten — Warnliste, kein stilles Exportieren)

### B) `corrected`-Regel

- `corrected` bedeutet: Korrektur wurde durchgeführt.
- `corrected` ist **keine** Exportfreigabe.
- Nach Korrektur muss erneut **`approved`** folgen (approved-after-correction).
- Erst **`approved`** nach Korrektur darf exportiert werden.

**Konsequenz für P2.1-Code:** `deriveExportBlocking('corrected')` muss in P2.2-Implementierung `true` bleiben (blockiert), bis Status wieder `approved` ist.

### C) `open`-Regel

- `open` wird in P2.2 **nicht** exportiert.
- Grüne Ampel allein reicht **nicht**.
- **Ziel:** Export nur mit expliziter Office-Freigabe (`approved`).

---

## 4. Datenmodell-Vorschlag

### A) Erweiterung: `workforce_export_jobs` (0193)

**Begründung:** Tabelle existiert; keine zweite Batch-Wahrheit.

#### Vorgeschlagene neue / zu prüfende Felder

| Feld | Typ | Zweck |
|------|-----|--------|
| `period_start` | `DATE` | Flexibler Zeitraum (Start) |
| `period_end` | `DATE` | Flexibler Zeitraum (Ende) |
| `export_type` | `TEXT` + CHECK | z. B. `reviewed_time` (P2.2), `session_legacy` (Übergang) |
| `status` | `TEXT` + CHECK | siehe unten |
| `finalized_at` | `TIMESTAMPTZ` | Finalisierungszeitpunkt |
| `finalized_by` | `UUID` → `auth.users` | Actor |
| `canceled_at` | `TIMESTAMPTZ` | Abbruch |
| `canceled_by` | `UUID` → `auth.users` | Actor |
| `notes` | `TEXT` | Office-Notiz |
| `content_hash` | `TEXT` | Hash über aggregierte Item-Payloads (optional) |

Bestehende Felder `period_year`, `period_month` können parallel bleiben (Abwärtskompatibilität) oder aus `period_start`/`period_end` abgeleitet werden.

#### Status-Vorschlag P2.2

| Neuer Status | Bedeutung |
|--------------|-----------|
| `draft` | Vorbereitung, Items noch nicht final |
| `validated` | Validierung OK, bereit zur Finalisierung |
| `finalized` | Export abgeschlossen, Items immutable |
| `canceled` | Abgebrochen |

#### Mapping zu 0193-Stati (Migration/Service)

| 0193 (legacy) | P2.2 |
|---------------|------|
| `pending` | `draft` |
| `processing` | `validated` oder legacy `processing` während Übergang |
| `completed` | `finalized` |
| `failed` | `canceled` oder separates `failed` beibehalten |

**Empfehlung:** CHECK-Constraint erweitern; Service mappt legacy reads.

---

### B) Neue Tabelle: `workforce_time_export_items`

**Zweck:** Eine Exportposition je final exportiertem Review-Snapshot.

| Feld | Typ | Constraints / Hinweise |
|------|-----|------------------------|
| `id` | `UUID` PK | `gen_random_uuid()` |
| `tenant_id` | `UUID` NOT NULL | FK → `tenants`, RLS |
| `export_job_id` | `UUID` NOT NULL | FK → `workforce_export_jobs(id)` |
| `review_id` | `UUID` NOT NULL | FK → `workforce_time_entry_reviews(id)` |
| `employee_id` | `UUID` NOT NULL | FK → `employees` |
| `reference_id` | `UUID` | Polymorphe Referenz (nullable wenn nicht UUID) |
| `reference_key` | `TEXT` NOT NULL | Idempotenz-Key (Denormalisierung) |
| `entry_kind` | `TEXT` NOT NULL | CHECK wie Reviews |
| `period_date` | `DATE` NOT NULL | `work_date` zum Exportzeitpunkt |
| `minutes_total` | `INTEGER` NOT NULL | `>= 0` |
| `review_status_at_export` | `TEXT` NOT NULL | Snapshot (erwartet `approved`) |
| `exported_payload` | `JSONB` NOT NULL | Normalisierter Export-Snapshot |
| `payload_hash` | `TEXT` NOT NULL | SHA/Checksum für Drift (P2.3) |
| `changed_after_export` | `BOOLEAN` NOT NULL DEFAULT `false` | Initial `false` in P2.2 |
| `superseded_by_export_item_id` | `UUID` NULL | FK → self, Re-Export-Kette (P2.3) |
| `created_at` | `TIMESTAMPTZ` NOT NULL DEFAULT `now()` | Append-only |

#### Constraints

- `UNIQUE (tenant_id, export_job_id, review_id)`
- `minutes_total >= 0`
- `tenant_id` immer gesetzt; alle FKs tenant-konsistent
- **Finalized `reference_key` (F6 — freigegeben):** Items werden **erst beim Finalisieren** geschrieben; Draft-/Preview-Daten werden **nicht** als Export-Items persistiert. DB-seitige Unique-Sicherung auf `(tenant_id, reference_key)` für finalisierte Exportpositionen (partial unique index über Join/Filter auf Job-Status `finalized`). Re-Export/Supersede-Logik erst P2.3.

#### Source of Truth

**Export-Snapshot = `workforce_time_export_items.exported_payload`.**  
Review-Felder (Abschnitt C) sind denormalisierte UI-/Filterfelder.

---

### C) Erweiterung: `workforce_time_entry_reviews` (F1 — freigegeben)

| Feld | Typ | Default | Zweck |
|------|-----|---------|--------|
| `export_status` | `TEXT` NOT NULL | `'not_exported'` | UI/Filter (denormalisiert) |
| `last_export_job_id` | `UUID` NULL | — | Letzter finalized Job |
| `last_exported_at` | `TIMESTAMPTZ` NULL | — | Zeitpunkt Finalisierung |
| `changed_after_export` | `BOOLEAN` NOT NULL | `false` | Drift-Flag (denormalisiert) |

**Freigabe F1:** Ja — Reviews erhalten diese denormalisierten Exportfelder in P2.2. Source of Truth für Export-Snapshots bleibt `workforce_time_export_items`.

#### `export_status` CHECK-Werte (P2.2)

| Wert | Bedeutung |
|------|-----------|
| `not_exported` | Noch nie final exportiert |
| `export_ready` | Freigegeben, exportfähig (optional UI-Alias zu approved) |
| `exported` | Mindestens ein finalized Item |
| `changed_after_export` | Snapshot veraltet (P2.2: service-basiert via `detectChangedAfterExport()`) |
| `export_blocked` | Policy blockiert trotz approved |

**Wichtig:** `export_status` auf Reviews **ersetzt nicht** `review_status`. Orthogonale Schichten (schema-approval Option B).

**Freigabe F5:** Export-Finalisierung setzt Reviews **nicht** auf `locked`. `review_status` bleibt `approved`; zusätzlich `export_status = 'exported'`. `locked` bleibt separater manueller/administrativer Terminalstatus.

---

## 5. Export-Actions

**Empfehlung:** `workforce_time_review_actions` erweitern — **keine** eigene Export-Actions-Tabelle in P2.2.

### Neue Action-Typen (CHECK erweitern)

| Action | Wann |
|--------|------|
| `export_marked` | Review in Draft-Batch aufgenommen |
| `export_finalized` | Batch finalisiert, Item erstellt |
| `export_voided` | Exportposition storniert (P2.3+) |
| `export_reopened` | Admin-Reopen (P2.3+) |
| `changed_after_export_detected` | Drift erkannt via `detectChangedAfterExport()` (P2.2 service-basiert; P2.3 auto) |

**Begründung:** Ein Audit-Trail pro Review; append-only bleibt; keine zweite Audit-Wahrheit.

---

## 6. RLS / Permission-Modell

### Office / Admin (`time.tracking.admin.export`)

| Ressource | Rechte |
|-----------|--------|
| `workforce_export_jobs` | SELECT, INSERT (draft), UPDATE (validate/finalize/cancel) |
| `workforce_time_export_items` | SELECT; INSERT nur via finalize (Service) |

### Office Team View (`time.tracking.team.view`) — F7: nicht in P2.2

- **Kein** Lesezugriff auf Export-Jobs oder Export-Items in P2.2
- Read-only optional erst in **P2.2.1**

### Mitarbeitende (Portal) — F3: freigegeben

- **Keine Exportdaten in P2.2**
- Kein Erstellen, Finalisieren, Lesen von Export-Jobs oder Export-Items
- RLS blockiert Employee-Zugriff vollständig

### Mandantentrennung

- `tenant_id = current_tenant_id()` auf allen Policies
- Kein Cross-Tenant

### Immutability

- Export-Items nach Job-Status `finalized`: **kein UPDATE/DELETE** für `authenticated`
- Batch-Statusänderungen nur Office/Admin
- Review-Actions: weiterhin append-only only

---

## 7. Service-Architektur

### A) `src/lib/wfm/wfmTimeExportPolicy.ts`

| Funktion | Zweck |
|----------|--------|
| `isReviewExportable(review, context)` | Kernregel §3 |
| `getExportBlockReason(review, context)` | UI: blockierte Einträge mit Grund |
| `isFinalizedExportStatus(jobStatus)` | Guard |
| `isChangedAfterExport(review, item?)` | Drift-Hilfe |

### B) `src/lib/wfm/wfmTimeExportPayloadBuilder.ts`

| Funktion | Zweck |
|----------|--------|
| `buildExportPayloadForReview(review, entryJoin)` | JSONB-Snapshot |
| `calculatePayloadHash(payload)` | Stabiler Hash |
| `normalizeMinutes(...)` | >= 0, Rundung |
| `normalizeEmployeeSnapshot(...)` | MA-Stammdaten minimal |
| `normalizeEntrySnapshot(...)` | Visit/Session/Manual-Felder |

### C) `src/lib/wfm/wfmTimeExportService.ts`

| Funktion | Zweck |
|----------|--------|
| `listExportableReviews(period)` | Policy + `wfmTimeReviewService` |
| `createExportDraft(period)` | Job INSERT `draft` |
| `validateExportBatch(id)` | Blocker, Warnungen, Item-Preview |
| `finalizeExportBatch(id)` | Items INSERT, Review-Felder, Actions |
| `listExportBatches(filters)` | Historie |
| `listExportItems(batchId)` | Detail |
| `detectChangedAfterExport(reviewId?)` | P2.2: service-basiert/manuell; **keine DB-Trigger** (F2) |
| `cancelExportBatch(id)` | Status `canceled` |

**Legacy:** `wfmExportService` (Session-Export) bleibt bis Cutover; Export-Tab schaltet auf P2.2-Service.

---

## 8. UI-Scope

**Bestehend:** Export-Tab (`WfmExportScreen`, Route `/business/office/time-tracking/export`).

### P2.2 UI (Erweiterung)

| Feature | Enthalten |
|---------|-----------|
| Zeitraum wählen | Ja |
| Export vorbereiten (Draft) | Ja |
| Exportfähige Einträge | Ja |
| Blockierte Einträge mit Gründen | Ja |
| Draft anzeigen | Ja |
| Finalisieren | Ja |
| Exporthistorie | Ja |
| Interner CSV-Download aus `exported_payload` | Ja (F4 — freigegeben) |

**Freigabe F4:** CSV wird intern aus `exported_payload` erzeugt. Kein DATEV-Finalexport, kein Lohnabrechnungsformat, kein PDF-Vollausbau.

### Nicht enthalten

- DATEV-Finalexport
- Lohnabrechnung
- PDF-Vollausbau
- Korrekturexport-Automatik
- Re-Export-Workflow
- Nachträge
- Fahrzeitregeln

---

## 9. Testplan

### Unit

- Statusmatrix §3 (alle Review-Status)
- `corrected` blockiert bis erneutes `approved`
- `open` blockiert
- `approved` exportfähig (mit/ohne Blocker)
- `pending_review` / `needs_clarification` / `rejected` blockiert
- Duplicate prevention (`reference_key` + finalized)
- `payload_hash` stabil bei gleichem Input
- `changed_after_export` initial `false`

### Service

- `createExportDraft` → `validateExportBatch` → `finalizeExportBatch`
- `cancelExportBatch`
- `listExportItems`
- Item immutable after finalized
- Review `export_status` / `last_export_job_id` gesetzt

### RLS / JWT

- Office darf Batch erstellen und finalisieren
- Employee darf nicht erstellen
- Employee sieht keine Export-Items
- Cross-Tenant blockiert

### Smoke (Staging only)

- Seed Exportdaten → Draft → Finalize → Reload → Historie sichtbar
- **Kein** Production-Smoke in P2.2-Implementierungstests ohne Freigabe

---

## 10. Migrationsstrategie

| Regel | Inhalt |
|-------|--------|
| `0246` | Platform Console — **fremder Scope**, nicht mischen |
| P2.2 Migration | Voraussichtlich **`0247_wfm_time_exports_p22.sql`** |
| Erstellung | **Nächster Schritt** nach Schema-Freigabe (dieses Dokument) — **noch nicht in diesem Lauf** |
| Apply | Staging first; Production gesperrt bis eigenes Gate |

### Voraussichtlicher Migrationsinhalt (0247 — Entwurf, nicht erstellen)

1. ALTER `workforce_export_jobs` — neue Spalten + erweiterter status CHECK  
2. CREATE `workforce_time_export_items` + Indexes + RLS  
3. ALTER `workforce_time_entry_reviews` — `export_status`, `last_export_*`, `changed_after_export`  
4. ALTER CHECK auf `workforce_time_review_actions.action` — Export-Action-Typen  
5. GRANTs analog 0193/0240  

**Kein** DATEV-Schema, **kein** `workforce_manual_time_entries`.

---

## 11. Risiken

| Risiko | Stufe | Gegenmaßnahme |
|--------|-------|---------------|
| Scope Creep DATEV | Hoch | DATEV explizit out of scope |
| `corrected` vs `approved` | Mittel | Regel §3B verbindlich; Tests |
| Doppelwahrheit Review/Items | Mittel | Items = SoT; Review denormalisiert |
| RLS-Leak Export-Items | Hoch | Policies + JWT-Smoke |
| Export ungeprüfter Einträge | Hoch | Policy vor finalize; All-or-nothing |
| `changed_after_export` falsch | Hoch | payload_hash; P2.2 manuell, P2.3 auto |
| Legacy `wfmExportService` parallel | Mittel | Tab-Umschaltung / Deprecation-Hinweis |
| Performance große Zeiträume | Mittel | Pagination, Batch-Limits |
| Vermischung P2.3/P2.4 | Mittel | Scope-Freeze in Gate |
| Vermischung 0246 Platform Console | Hoch | Separate Migration 0247; kein gemischter Push |

---

## 12. Freigegebene Entscheidungen (F1–F7)

Alle Freigabepunkte sind **entschieden** (2026-07-08).

| # | Entscheidung | Freigabe |
|---|--------------|----------|
| F1 | Review-Exportfelder auf Reviews | **Ja** — `export_status`, `last_export_job_id`, `last_exported_at`, `changed_after_export` denormalisiert; SoT bleibt `workforce_time_export_items` |
| F2 | `changed_after_export` | **P2.2 service-basiert/manuell** via `detectChangedAfterExport()`; keine automatischen DB-Trigger; Auto-Drift/Re-Export erst P2.3 |
| F3 | Employee Portal Exportdaten | **Nein** — keine Export-Jobs, keine Export-Items für Mitarbeitende |
| F4 | Interner CSV | **Ja** — aus `exported_payload`; kein DATEV, kein Lohnabrechnungsformat, kein PDF-Vollausbau |
| F5 | `locked` bei Finalisierung | **Nein** — Review bleibt `approved`, zusätzlich `export_status = exported`; `locked` separater Admin-Terminalstatus |
| F6 | Unique finalized `reference_key` | **Ja, DB-seitig** — Items erst beim Finalisieren; kein Draft-Persist; `UNIQUE (tenant_id, reference_key)` für finalisierte Positionen; Re-Export/Supersede P2.3 |
| F7 | Team View read-only | **Nicht in P2.2** — nur Office/Admin mit `time.tracking.admin.export`; optional P2.2.1 |

---

## 13. Gate

| Check | Status |
|-------|--------|
| Schema-Dokument erstellt | **Ja** |
| Schema freigegeben (F1–F7) | **Ja** |
| Migration erstellen | **Nächster Schritt** — noch **nicht** in diesem Lauf |
| Code implementieren | **Nein** |
| Production gesperrt | **Ja** |
| Deploy gesperrt | **Ja** |
| 0246 / platformConsole unberührt | **Ja** |

### Nächste Schritte

1. Migration `0247_wfm_time_exports_p22.sql` **entwerfen** (Staging only, separater Lauf)  
2. Services + Tests gemäß §7/§9  
3. UI-Erweiterung Export-Tab  
4. Staging Gate → Production Gate (separater Lauf)

---

*Freigegebenes Schema — WFM P2.2 Export. Keine Secrets. Keine Production-Aktion.*
