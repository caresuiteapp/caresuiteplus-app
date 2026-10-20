# WFM P2.3 — Re-Export / Supersede — Discovery & Architektur-Gate

**Datum:** 2026-07-08  
**Status:** F1–F12 **final freigegeben** — **APPROVED FOR SCHEMA PROPOSAL**  
**Basis:** WFM P2.2 FINAL GO (Production Deploy `f8da14d7`, Migration `0248_wfm_time_exports_p22`)  
**Freigegeben durch:** Kevin Reinhardt (F1–F12 Entscheidungsreview 2026-07-08)  
**Schema-Proposal:** `docs/architecture/wfm-p23-schema-proposal-0252.md`  
**Verwandte Dokumente:** `wfm-p22-export-schema-proposal.md`, `wfm-phase2-schema-approval.md`, Migration `0248_wfm_time_exports_p22.sql`

---

## 1. Executive Summary

WFM P2.2 liefert **Draft → Validate → Finalize** für `reviewed_time`-Exporte mit immutable Snapshots in `workforce_time_export_items`. Ein finalisierter Export pro `reference_key` ist durch **`UNIQUE (tenant_id, reference_key)`** erzwungen; Re-Export und Supersede-Ketten sind vorbereitet (`superseded_by_export_item_id`), aber **nicht aktiv**.

**P2.3-Ziel:** Fachlich und technisch klären, wie nach Finalisierung geänderte Arbeitszeiten **erkannt**, **auditierbar markiert**, **korrigierend re-exportiert** und **historisch superseded** werden — ohne DATEV, Lohnlauf oder Employee-Exportzugriff.

**Empfohlener Kernansatz (vorläufig):**

1. **Drift-Erkennung** service-basiert über `payload_hash`-Vergleich (exportrelevante Felder); optional manueller Trigger „Änderung prüfen“ in UI.
2. **Korrektur-Export** als neuer `workforce_export_jobs`-Lauf mit `export_type = 'reviewed_time_correction'` und `correction_of_export_job_id`.
3. **Supersede auf Item-Ebene:** altes Item bleibt immutable, erhält `superseded_by_export_item_id`; neues Item wird INSERT; **Partial Unique Index** ersetzt globales `UNIQUE (tenant_id, reference_key)`.
4. **Supersede-UPDATE** nur über **SECURITY DEFINER RPC** (Service Role), da P2.2 `UPDATE` auf Items für `authenticated` widerrufen hat.
5. **Review-`reference_key` bleibt stabil**; Versionierung über `export_sequence` auf Items, nicht über Review-Key-Änderung.

**Gate-Urteil:** F1–F12 final freigegeben. **Schema Proposal: GO PREPARED.** **Implementation / Migration SQL / Apply / Deploy: NO-GO** bis Implementierungsgate.

---

## 2. Scope / Non-Scope

### Im Scope P2.3 (Discovery + spätere Implementierung)

| Thema | Beschreibung |
|-------|--------------|
| Drift-Erkennung | `changed_after_export` auf Review + optional Item-Flag |
| Korrektur-Export | Neuer Job-Typ / Korrektur-Metadaten, Draft → Validate → Finalize |
| Supersede-Kette | `superseded_by_export_item_id`, Item-Historie |
| Audit | Erweiterte `workforce_time_review_actions`, Job-/Item-Historie |
| Policy | Exportierbarkeit für `changed_after_export`-Reviews |
| UI | Bereiche „Nach Export geändert“, Korrektur-Export, Historie |
| CSV | Korrektur-CSV aus `exported_payload` (Delta oder Vollersatz — F11 offen) |
| Tests | Unit, Service, RLS, UI, Migrations-Backfill-Sicherheit |

### Explizit Non-Scope P2.3

| Ausgeschlossen | Phase / Grund |
|----------------|---------------|
| DATEV-Schnittstelle | Gesonderter Scope |
| Lohnlauf / Payroll-Bridge | Legacy `payroll_export_*` |
| Automatische Abrechnung | — |
| Mitarbeiter-Exportansicht | F3/F7 P2.2 |
| Produktive Datenkorrektur ohne Freigabe | Nur Staging-Gates |
| Platform Console (0246–0251) | Fremder Scope |
| DB-Trigger-only Drift (ohne Service) | Optional P2.3.1 |
| Nachträge persistent (P2.4) | Eigenes Datenmodell |
| `export_voided` / Job-Storno als Default | Nur Einzelfall-Admin (F5) |

---

## 3. P2.2 Ist-Zustand

### 3.1 Migration 0248 — Kerntabellen

**`workforce_export_jobs`** (Erweiterung 0193):

- Neue Spalten: `period_start`, `period_end`, `export_type`, `finalized_at/by`, `canceled_at/by`, `notes`, `content_hash`
- Status CHECK: `pending`, `processing`, `completed`, `failed`, `draft`, `validated`, `finalized`, `canceled`
- `export_type`: `reviewed_time` | `session_legacy`

**`workforce_time_export_items`** (neu):

| Constraint / Feld | Wirkung für P2.3 |
|-------------------|------------------|
| `UNIQUE (tenant_id, reference_key)` | **Blockiert Re-Export** mit gleichem Key |
| `UNIQUE (tenant_id, export_job_id, review_id)` | Ein Review pro Job — OK für Korrektur-Job |
| `superseded_by_export_item_id` | Self-FK vorbereitet, P2.2 ungenutzt |
| `changed_after_export` | Item-Flag, initial `false` |
| `review_status_at_export` CHECK `= 'approved'` | Nur approved-Snapshots |
| Kein UPDATE/DELETE für `authenticated` | Supersede braucht RPC/Service Role |

**`workforce_time_entry_reviews`** (Denormalisierung F1):

- `export_status`: `not_exported`, `export_ready`, `exported`, `changed_after_export`, `export_blocked`
- `last_export_job_id`, `last_exported_at`, `changed_after_export`

**`workforce_time_review_actions`** — Export-Actions in CHECK:

- P2.2 aktiv: `export_marked`, `export_finalized`, `changed_after_export_detected`
- P2.3 vorbereitet im CHECK, **nicht implementiert**: `export_voided`, `export_reopened`

### 3.2 Service-Layer (implementiert)

| Modul | Funktionen |
|-------|------------|
| `wfmTimeExportPolicy.ts` | `isReviewExportable`, `getReviewExportBlockReason`, `deriveReviewExportStatus` — blockiert `exported`, `changed_after_export`, `hasFinalizedExportItem` |
| `wfmTimeExportPayloadBuilder.ts` | `buildExportPayloadForReview`, `calculateExportPayloadHash` (FNV-1a über stabilen JSON) |
| `wfmTimeExportService.ts` | `createExportDraft`, `validateExportBatch`, `finalizeExportBatch`, `detectChangedAfterExport`, `buildInternalCsv`, `cancelExportBatch` |

**P2.2-Lücke `detectChangedAfterExport`:** Vergleicht aktuellen Payload mit gespeichertem `payload_hash`, setzt Review auf `changed_after_export` — aber **nutzt gespeicherte Item-Minuten**, nicht live Review-Metadaten; **kein automatischer Hook** bei Review-/Event-Änderung.

### 3.3 UI (`WfmExportScreen.tsx`)

- P2.2-Flow: Zeitraum → Export vorbereiten → Validierung → Finalisieren → CSV
- Blockierte Einträge mit `reasonLabel`
- Export-Historie finalisierter Jobs
- **Kein** UI für `changed_after_export`, Korrektur-Export, Supersede-Historie

### 3.4 Tests (bestehend)

| Datei | Abdeckung |
|-------|-----------|
| `wfmTimeExportPolicy.test.ts` | Statusmatrix, duplicate `reference_key`, Period |
| `wfmTimeExportService.test.ts` | Draft, Finalize, Duplicate-Block, Cancel, CSV |
| `wfmTimeExportPayloadBuilder.test.ts` | Payload/Hash |
| `wfmExportScreen.test.ts` | testIDs, Handler-Namen |

### 3.5 RLS (P2.2)

- **Export-Items:** SELECT/INSERT nur `time.tracking.admin.export` oder `is_tenant_admin()`
- **Kein UPDATE/DELETE** auf Items für `authenticated`
- **Export-Jobs SELECT:** `reviewed_time` nur Admin-Export; `session_legacy` + Self-Read
- **Reviews UPDATE:** `admin.correct` + `admin.export` + tenant_admin

### 3.6 CSV

Intern aus `exported_payload` via `buildInternalCsv`:

```text
reference_key;employee_id;entry_kind;period_date;minutes_total;review_status;payload_hash
```

Semikolon-getrennt, kein DATEV.

---

## 4. Fachliche Entscheidungen F1–F12

### 4.1 Entscheidungstabelle — **FINAL** (Kevin 2026-07-08)

| ID | Entscheidung | **Finaler Status** | Risiko | Migration | Service | UI | CSV | RLS |
|----|--------------|-------------------|--------|-----------|---------|-----|-----|-----|
| **F1** | Drift-Definition | **APPROVE mit CHANGE** | Mittel | — | Hoch | Mittel | Mittel | — |
| **F2** | Berechtigungen | **APPROVE** | Mittel | — | Mittel | Mittel | — | Hoch |
| **F3** | Auto vs. manuell | **APPROVE mit CHANGE** | Mittel | — | Hoch | Niedrig | — | — |
| **F4** | Re-Export-Mechanik | **APPROVE** | Hoch | Hoch | Hoch | Hoch | Mittel | Mittel |
| **F5** | Storno vs. Supersede | **APPROVE** | Mittel | Mittel | Mittel | Mittel | Niedrig | — |
| **F6** | Audit | **APPROVE** | Niedrig | Niedrig | Mittel | Mittel | Mittel | — |
| **F7** | Non-Scope | **APPROVE** | Niedrig | — | — | — | — | — |
| **F8** | reference_key / Sequenz | **APPROVE mit CHANGE** | Hoch | Hoch | Hoch | Niedrig | Mittel | — |
| **F9** | item_status | **APPROVE** | Mittel | Mittel | Mittel | Mittel | Niedrig | Mittel |
| **F10** | export_type | **APPROVE** | Niedrig | Mittel | Mittel | Mittel | Niedrig | Mittel |
| **F11** | Korrektur-CSV | **APPROVE: DELTA** | Mittel | Niedrig | Mittel | Mittel | Hoch | — |
| **F12** | Trigger vs. Service | **APPROVE** | Mittel | Niedrig | Hoch | — | — | — |

**Legende:** `APPROVE mit CHANGE` = freigegeben mit verbindlichen Präzisierungen (kein OPEN mehr)

### 4.2 Freigabevorlagen F1–F12

#### F1 — Definition „nach Export geändert“

**Final: APPROVE mit CHANGE**

**Entscheidungstext:** Drift-Erkennung über **Live-Daten-Hash/Feldmatrix**, nicht über gespeicherte Item-Minuten allein. Exportrelevante Felder: `minutes_total`, `period_date`, `employee_id`, `entry_kind`, `reference_id`, `logical_reference_key`. Nicht exportrelevant allein: Display-Labels, reine Kommentare/Begründungen ohne exportrelevante Feldänderung.

**Pflicht:** explizite Feldmatrix in Unit-Tests; Refactor `detectChangedAfterExport` auf Live-Review/Event-Daten; **keine** Drift-Erkennung nur aus P2.2 Item-Snapshot-Minuten.

---

#### F2 — Berechtigungen

**Final: APPROVE**

**Entscheidungstext:** Drift/Correction markieren: `tenant_admin`, `time.tracking.admin.correct`, `time.tracking.admin.export`. Korrektur-Finalize: `tenant_admin`, `time.tracking.admin.export`. Employee: kein Export, kein Drift-Finalize, kein Exportdatenzugriff.

---

#### F3 — Automatisch vs. manuell Drift

**Final: APPROVE mit CHANGE**

**Entscheidungstext:** Kein DB-Trigger in 0252. MVP: Service-Hooks bei Review-Transition/Korrektur; manueller Button „Änderung nach Export prüfen“; keine automatische Produktivdatenkorrektur.

---

#### F4 — Re-Export-Mechanik

**Final: APPROVE**

**Entscheidungstext:** Korrektur-Job `export_type = reviewed_time_correction`, `correction_of_export_job_id`, Supersede-RPC, eigene Policy `isReviewCorrectionExportable`. Draft → Validate → Finalize analog P2.2.

---

#### F5 — Storno vs. Supersede

**Final: APPROVE**

**Entscheidungstext:** Standard Item-Supersede; kein kompletter Job-Void im MVP. Review bleibt `exported`; Drift setzt `changed_after_export`; nach Korrektur neuer aktiver Item-Stand.

---

#### F6 — Audit

**Final: APPROVE**

**Entscheidungstext:** Review Actions, UI-Badges, Export-Historie, CSV-Metadaten, Korrekturgrund (Pflicht).

---

#### F7 — Non-Scope

**Final: APPROVE** (verbindlich)

**Entscheidungstext:** Kein DATEV, kein Lohnexport, keine Employee Export View, kein Platform-Scope, keine automatische Abrechnung, keine produktive Datenkorrektur ohne explizite Office-Aktion.

---

#### F8 — reference_key / Sequenz

**Final: APPROVE mit CHANGE**

**Entscheidungstext:** 0252 löst P2.2 UNIQUE-Blocker. `logical_reference_key` stabil (z. B. `review:<review_id>`). `export_sequence` (1 = Initial, 2+ = Korrektur). **Physical `reference_key`** versioniert (z. B. `review:<review_id>:v2` oder `review:<review_id>:correction:2`). Partial Unique: max. **1 active Item** je `(tenant_id, logical_reference_key)`. Alte Items immutable; neue Items referenzieren alte via `supersedes_export_item_id` / `superseded_by_export_item_id`.

---

#### F9 — item_status

**Final: APPROVE**

**Entscheidungstext:** `active` | `superseded` | `voided`, Default `active`.

---

#### F10 — export_type

**Final: APPROVE**

**Entscheidungstext:** Neuer Typ `reviewed_time_correction`. Bestehend: `reviewed_time`, Legacy: `session_legacy`.

---

#### F11 — Korrektur-CSV

**Final: APPROVE — DELTA**

**Entscheidungstext:** Korrektur-CSV enthält **nur betroffene/geänderte Positionen**, kein Vollersatz der Periode. Delta muss vollständig auditierbar sein mit Pflichtfeldern:

- `original_export_job_id`, `correction_export_job_id`
- `original_export_item_id`, `new_export_item_id`
- `logical_reference_key`, `export_sequence`
- `correction_reason`, `changed_fields`
- `old_values`, `new_values`, `delta_minutes`
- `employee_id` / Name falls vorhanden, `period_date`
- `finalized_at`, `finalized_by`

**Kein Vollersatz im P2.3 MVP.**

---

#### F12 — Trigger vs. Service

**Final: APPROVE**

**Entscheidungstext:** Service-only MVP. Kein DB-Trigger in 0252. Optionaler Trigger erst spätere Phase.

---

### 4.3 P2.2-Abweichungen (Review-Befund)

| Befund | P2.3-Konsequenz |
|--------|-----------------|
| `getReviewExportBlockReason` blockiert `changed_after_export` für **alle** Exporte | Separate Policy `isReviewCorrectionExportable` für Korrektur-Jobs (F4) |
| `detectChangedAfterExport` nutzt Item-Minuten statt Live-Review | F1/F3 CHANGE — Refactor vor Implementation |
| `UNIQUE (tenant_id, reference_key)` in 0248 | F8 CHANGE — Migration 0252 zwingend vor Re-Export |
| Kein UPDATE auf Items für authenticated | Supersede-RPC zwingend (F4/F5) |
| `export_voided`/`export_reopened` im CHECK, nicht im Service | Optional P2.3 Admin-only, nicht Default (F5) |

### 4.4 Finaler Entscheidungsstatus (Kevin 2026-07-08)

| # | Finaler Status |
|---|----------------|
| F1 | **APPROVE mit CHANGE** |
| F2 | **APPROVE** |
| F3 | **APPROVE mit CHANGE** |
| F4 | **APPROVE** |
| F5 | **APPROVE** |
| F6 | **APPROVE** |
| F7 | **APPROVE** |
| F8 | **APPROVE mit CHANGE** |
| F9 | **APPROVE** |
| F10 | **APPROVE** |
| F11 | **APPROVE: DELTA** |
| F12 | **APPROVE** |

**Offene Entscheidungen:** keine — alle F1–F12 final.

---

## 5. Datenmodell-Vorschlag

### 5.A) `workforce_export_jobs` — Erweiterungen

| Feld | Typ | Zweck |
|------|-----|--------|
| `correction_of_export_job_id` | UUID NULL FK → self | Ursprungs-Export bei Korrektur |
| `export_reason` | TEXT NULL | Pflicht bei Korrektur (UI, max 500 Zeichen) |
| `export_scope` | TEXT NULL CHECK | `full_replacement` \| `delta_correction` (F11) |
| `is_correction` | BOOLEAN GENERATED / DEFAULT | Derived aus `export_type` |

**CHECK-Erweiterung `export_type`:**

```sql
'reviewed_time', 'reviewed_time_correction', 'session_legacy'
```

Kein `parent_export_job_id` + `supersedes_export_job_id` parallel — **`correction_of_export_job_id` reicht**.

### 5.B) `workforce_time_export_items` — Erweiterungen

| Feld | Typ | Zweck |
|------|-----|--------|
| `export_sequence` | INTEGER NOT NULL DEFAULT 1 | Version pro Review-Key |
| `item_status` | TEXT NOT NULL DEFAULT 'active' | `active`, `superseded`, `voided` |
| `supersedes_export_item_id` | UUID NULL FK → self | Neues Item zeigt auf ersetztes Item |
| `correction_reason` | TEXT NULL | Denormalisiert aus Job |
| `source_payload_hash` | TEXT NULL | Hash des superseded Items |

**Constraint-Änderung (kritisch):**

```sql
-- Entfernen:
-- UNIQUE (tenant_id, reference_key)

-- Neu:
UNIQUE (tenant_id, reference_key, export_sequence)
-- Optional zusätzlich:
CREATE UNIQUE INDEX ... ON (tenant_id, reference_key)
  WHERE item_status = 'active' AND superseded_by_export_item_id IS NULL;
```

**Immutability:** Weiterhin kein UPDATE auf Payload-Felder. **Erlaubtes UPDATE** (nur via RPC): `superseded_by_export_item_id`, `item_status`.

### 5.C) `workforce_time_entry_reviews` — Erweiterungen

| Feld | Typ | Zweck |
|------|-----|--------|
| `changed_after_export_detected_at` | TIMESTAMPTZ NULL | Zeitpunkt Drift |
| `changed_after_export_reason` | TEXT NULL | z. B. `minutes_changed`, `manual_detect` |
| `pending_reexport_job_id` | UUID NULL FK | Offener Korrektur-Draft |
| `latest_export_item_id` | UUID NULL FK | Zeiger auf aktives Item |
| `export_version` | INTEGER NOT NULL DEFAULT 0 | Inkrement bei Korrektur-Finalize |

Denormalisierung — **SoT bleibt Items**.

### 5.D) `workforce_time_review_actions` — Erweiterungen

Neue Action-Typen (CHECK erweitern):

| Action | Wann |
|--------|------|
| `export_change_detected` | Alias/Ergänzung zu `changed_after_export_detected` |
| `reexport_requested` | Admin startet Korrektur-Vorbereitung |
| `reexport_drafted` | Korrektur-Job angelegt |
| `reexport_finalized` | Korrektur-Job finalisiert |
| `export_item_superseded` | Item-Kette geschrieben |
| `correction_export_finalized` | Aggregat pro Job |

Bestehend `export_voided`, `export_reopened` — nur Admin, P2.3 optional.

### 5.E) Constraints — Zusammenfassung

| Regel | Umsetzung |
|-------|-----------|
| Kein Doppel-Active-Export | Partial Unique oder `export_sequence` |
| Alte Items immutable | Kein Payload-UPDATE |
| Supersede-Kette | `superseded_by_export_item_id` + `supersedes_export_item_id` bidirektional optional |
| Review-Key stabil | Kein Suffix am Review-`reference_key` |
| Korrektur-INSERT | Neues Item, `export_sequence = MAX+1` |

### 5.F) RLS P2.3

| Ressource | Regel |
|-----------|--------|
| Korrektur-Jobs | Gleich wie P2.2: `admin.export` / tenant_admin |
| Item-Supersede RPC | `SECURITY DEFINER`, prüft Permission intern |
| Employee | Kein Zugriff |
| Team View | Weiterhin kein Export-Read (F7 P2.2) |
| Historie | Admin-only; Korrektur-Jobs sichtbar mit `export_type`-Filter |

---

## 6. Service-Design

### Flow 1: `detectChangedAfterExport(reviewId?)`

| Aspekt | Detail |
|--------|--------|
| Input | `tenantId`, optional `reviewId` / `exportJobId` |
| Permission | `time.tracking.admin.export` |
| DB | SELECT Items + Reviews; berechne aktuellen Payload aus **live** Review/Metadaten |
| Audit | Bei Drift: `changed_after_export_detected` |
| Fehler | Kein Item → no-op; Review nicht exported → skip |
| Idempotenz | Mehrfachaufruf: Status bleibt `changed_after_export` |
| Tests | Hash gleich → kein Update; Hash ungleich → Flag |

### Flow 2: `markChangedAfterExport(reviewId, reason)`

| Aspekt | Detail |
|--------|--------|
| Input | Review-ID, Reason-Code |
| Permission | `admin.export` oder `admin.correct` |
| DB | UPDATE Review: `export_status`, `changed_after_export`, `changed_after_export_detected_at`, `reason` |
| Audit | `export_change_detected` |
| Fehler | Review nie exportiert → 400 |
| Hook | Aufgerufen aus Review-Transition wenn vorher `exported` |

### Flow 3: `listReexportCandidates(tenantId, period?)`

| Aspekt | Detail |
|--------|--------|
| Input | Zeitraum optional |
| Permission | `admin.export` |
| DB | Reviews mit `export_status IN ('changed_after_export')` AND `review_status = 'approved'` |
| Output | Liste inkl. `latest_export_item_id`, Blockgründe |
| Tests | `exported` ohne Drift → nicht enthalten |

### Flow 4: `createCorrectionDraft(period, reviewIds, reason)`

| Aspekt | Detail |
|--------|--------|
| Input | Review-IDs, Pflicht-`reason` |
| Permission | `admin.export` |
| DB | INSERT Job `draft`, `export_type = reviewed_time_correction`, `correction_of_export_job_id` aus Item |
| Audit | `reexport_drafted` pro Review |
| Fehler | Review nicht Drift/approved → blockiert |
| Idempotenz | Pro Review max ein offener Draft (`pending_reexport_job_id`) |

### Flow 5: `validateCorrectionDraft(jobId)`

| Aspekt | Detail |
|--------|--------|
| Input | Korrektur-Job-ID |
| Permission | `admin.export` |
| DB | Partition wie P2.2, Policy: **nur** `changed_after_export`-Reviews |
| Audit | — |
| Fehler | Enthält nicht-Drift → `valid=false` |

### Flow 6: `finalizeCorrectionExport(jobId)`

| Aspekt | Detail |
|--------|--------|
| Input | Validierter Korrektur-Job |
| Permission | `admin.export` |
| DB | INSERT neue Items (`export_sequence+1`); RPC `supersede_export_items`; UPDATE Reviews; Job `finalized` |
| Audit | `reexport_finalized`, `export_item_superseded`, `correction_export_finalized` |
| Fehler | UNIQUE-Verletzung → Transaktion rollback |
| Idempotenz | Job-Status-Guard `finalized` |

### Flow 7: `supersedeExportItems(oldItemIds, newItemIds)`

| Aspekt | Detail |
|--------|--------|
| Input | Paare old→new |
| Permission | Intern (RPC) |
| DB | UPDATE old: `superseded_by_export_item_id`, `item_status=superseded`; new: `supersedes_export_item_id` |
| Audit | Pro Paar `export_item_superseded` |
| RLS | Bypass via SECURITY DEFINER |

### Flow 8: `generateCorrectionCsv(jobId)`

| Aspekt | Detail |
|--------|--------|
| Input | Korrektur-Job-ID |
| Permission | `admin.export` |
| Output | Delta-CSV mit Supersede-Metadaten |
| Tests | Spalten, Reihenfolge, leerer Job |

### Flow 9: `reloadExportHistory(tenantId, filters)`

| Aspekt | Detail |
|--------|--------|
| Input | Filter: Job-Typ, Status, Zeitraum |
| Permission | `admin.export` |
| DB | Jobs + Items inkl. Item-Kette |
| UI | Historie-Panel Refresh |

---

## 7. UI-Konzept

**Ort:** `WfmExportScreen` — neuer Abschnitt „Korrektur & Re-Export (P2.3)“ unter P2.2-Panel.

| Bereich | Inhalt |
|---------|--------|
| Exportbereit | Bestehend P2.2 (nur `export_ready`) |
| Bereits exportiert | Read-only Liste `exported`, ohne Drift |
| Nach Export geändert | Badge rot/gelb; Button „Änderung prüfen“; Kandidaten für Korrektur |
| Korrektur-Export offen | Draft-Korrektur-Job, Validierung, Pflichtfeld „Grund“ |
| Korrektur finalisiert | Erfolg + Link Historie |
| Export-Historie | Jobs mit Typ-Badge (`Initial` / `Korrektur`), Item-Version |

**Aktionen:**

- Änderung prüfen → `detectChangedAfterExport`
- Korrektur vorbereiten → `createCorrectionDraft` (Multi-Select Drift-Reviews)
- Validieren / Finalisieren → analog P2.2
- CSV herunterladen → Initial vs. Korrektur
- Historie → Item-Kette expandable

**Schutz:**

- Bestätigungsdialog vor Finalize Korrektur
- Grund-Pflicht (min. 10 Zeichen)
- `LockedActionBanner` ohne Permission
- Keine Employee-Route

---

## 8. RLS-/Permission-Konzept

| Aktion | Permission |
|--------|------------|
| Drift erkennen / markieren | `time.tracking.admin.export` OR `admin.correct` OR tenant_admin |
| Korrektur-Export erstellen/finalisieren | `time.tracking.admin.export` OR tenant_admin |
| Item-Supersede (RPC) | Intern — Caller muss export permission haben |
| Export-Historie lesen | `admin.export` OR tenant_admin |
| Employee / Team View | **Verweigert** |

**Keine Leaks:** Korrektur-Jobs unterliegen gleicher SELECT-Policy wie `reviewed_time`.

---

## 9. CSV-/Payload-Konzept

### Initial-Export (P2.2, unverändert)

Header: `reference_key;employee_id;entry_kind;period_date;minutes_total;review_status;payload_hash`

### Korrektur-Export (P2.3 — F11 DELTA, final)

Header (Semikolon-getrennt):

```text
export_kind;logical_reference_key;reference_key;export_sequence;original_export_job_id;correction_export_job_id;original_export_item_id;new_export_item_id;employee_id;employee_name;entry_kind;period_date;changed_fields;old_values;new_values;delta_minutes;correction_reason;finalized_at;finalized_by;payload_hash;previous_payload_hash
```

- Nur Zeilen für betroffene/geänderte Positionen (`export_kind=correction_delta`)
- Kein Vollersatz der Periode im P2.3 MVP
- Datenquelle: `exported_payload` JSONB + `correction_payload_delta` JSONB

---

## 10. Teststrategie

### Unit

- Policy: `changed_after_export` → exportierbar für Korrektur, nicht für Initial
- Payload Builder: `schemaVersion` 2, Hash mit Sequence
- Reference Key: Review-Key stabil, Sequence increment
- Changed Detection: Feld-Matrix F1
- Supersede Rules: genau ein `active` Item pro Key
- CSV Correction: Spalten, Delta-only

### Service

- mark changed → finalize correction → old superseded
- duplicate prevention (zwei aktive Items)
- immutable old items (UPDATE payload fails)
- RLS: employee denied, cross-tenant denied
- idempotent finalize

### UI

- Badges, Kandidatenliste, Grund-Pflicht, empty states, permission denied

### Migration

- P2.2-Daten: `export_sequence = 1`, `item_status = active`
- Altes UNIQUE drop + neues UNIQUE — **kein** automatisches Re-Export
- Backfill `latest_export_item_id` optional, nullable

### Smoke (Staging only)

1. Initial Export finalisieren  
2. Review-Minuten ändern + re-approve  
3. Drift erscheint  
4. Korrektur-Draft → Finalize  
5. CSV Korrektur + Historie  
6. Employee 403  

---

## 11. Risiko-Matrix

| # | Kategorie | Stufe | Begründung | Gegenmaßnahme | Stop-Kriterium | Test/Smoke |
|---|-----------|-------|------------|---------------|----------------|------------|
| 1 | Doppel-Export | Hoch | UNIQUE P2.2 | Partial Unique / export_sequence | Zwei active Items | Service-Test |
| 2 | Korrektur falsch verstanden | Mittel | UX | Schulungstext, Pflicht-Grund | User Acceptance | UX-Review |
| 3 | Alte Items mutiert | Hoch | Immutability | RPC-only Supersede-Felder | Payload UPDATE | DB-Test |
| 4 | UNIQUE blockiert Re-Export | Hoch | 0248 Constraint | Migration 0252 | INSERT fail Staging | Migration-Test |
| 5 | RLS-Leak | Hoch | Sensitive Exportdaten | Policy-Review | Employee SELECT | JWT-Test |
| 6 | Employee sieht Export | Hoch | F3 | Keine Policy-Erweiterung | Portal-Zugriff | RLS negativ |
| 7 | Tenant-Isolation | Hoch | Multi-Tenant | `tenant_id` in RPC | Cross-Tenant | RLS-Test |
| 8 | CSV uneindeutig | Mittel | Delta vs Full | F11 klären, Metadaten-Spalten | Payroll-Fehler | CSV-Golden-File |
| 9 | Audit unvollständig | Mittel | Compliance | Actions pro Schritt | Fehlende Action | Action-Assert |
| 10 | Drift zu früh/spät | Mittel | F1/F3 unklar | Feld-Matrix, Service-Hooks | Falscher Status | Unit-Matrix |
| 11 | Trigger vs Service | Mittel | Inkonsistenz | Service-first F12 | Doppel-Flags | Integrations-Test |
| 12 | Storno vs Supersede | Mittel | F5 offen | Item-Supersede Default | Job voided irrtümlich | Policy-Doc |
| 13 | UI-Mutationsrisiko | Mittel | Fehlklick | Confirm-Dialog | Finalize ohne Grund | UI-Test |
| 14 | Produktive Altdaten | Mittel | 0248 live | Backfill seq=1 | Migration fail | Staging-Apply |
| 15 | Performance | Niedrig | Große Perioden | Pagination, Batch-Limits | >30s Validate | Load-Test |
| 16 | Rollback | Mittel | Constraint drop | Forward-only Migration | Rollback nötig | Restore-Plan |
| 17 | DATEV-Verwechslung | Niedrig | Labels | „Interner CSV“ | DATEV-Button | UI-Review |
| 18 | P2.2 Regression | Hoch | Shared Service | Regression-Suite P2.2 | Initial Export bricht | CI P2.2 Tests |
| 19 | P2.3 Migration Apply | Hoch | Production | Staging first | Apply ohne Gate | Staging-Gate |
| 20 | Deploy-Reihenfolge | Hoch | Code vor DB | Migrations-Gate | Deploy ohne 0252 | Checkliste |

---

## 12. Migrationsstrategie

| Regel | Wert |
|-------|------|
| **Dateiname** | `0252_wfm_time_exports_p23.sql` |
| **Begründung** | 0248 = P2.2 WFM; 0249–0251 = Platform — **nicht vermischen** |
| Idempotent | `IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` |
| Rückwärtskompatibel | Nullable neue Spalten; Defaults `export_sequence=1`, `item_status=active` |
| Production Apply | **NO-GO** bis Staging-Gate |
| Datenmutation Apply | Backfill Sequenz/Status only — **kein** Re-Export, **keine** Seeds |
| RPC | `supersede_wfm_export_items(...)` SECURITY DEFINER |

**Voraussichtlicher Inhalt 0252:**

1. ALTER `workforce_export_jobs` — `correction_of_export_job_id`, `export_reason`, `export_scope`; CHECK `export_type` + `reviewed_time_correction`  
2. ALTER `workforce_time_export_items` — `export_sequence`, `item_status`, `supersedes_export_item_id`, `correction_reason`; DROP/ADD UNIQUE  
3. ALTER `workforce_time_entry_reviews` — Drift-/Reexport-Felder  
4. ALTER CHECK `workforce_time_review_actions`  
5. CREATE RPC + GRANT EXECUTE  
6. Indexe für `item_status`, `export_sequence`  

---

## 13. Offene Fragen (nach F1–F12-Finalisierung)

1. **Implementation:** Exakte Hook-Liste für F3 (Review-Transition, Assist-Sync, Manual Entry) — in Implementierungsplan, nicht Architektur-Blocker  
2. **F5 optional:** Kriterien für seltenes Job-level `export_voided` (Admin-Einzelfall)  
3. **F6 UX:** Badge-Farben/Copy für „Korrektur exportiert (v{n})“  
4. **F8 SQL:** Exakte Partial-Unique-Index-Formulierung in 0252 — Review im Schema-Proposal  
5. **Process:** Staging-Gate-Kriterien für Migration 0252 Apply nach Implementation  

### 13.1 Stop-Kriterien (Implementation / Migration)

| Stop | Bedingung |
|------|-----------|
| S1 | F1/F3 ohne Live-Review-Hash — False Negatives |
| S2 | F8 ohne Partial Unique — zwei active Items |
| S3 | F11 Vollersatz statt Delta in Korrektur-CSV |
| S4 | Korrektur-Export nutzt Initial-Policy — P2.2 Regression |
| S5 | Platform-Migration 0249–0251 in WFM-Branch |
| S6 | Migration 0252 erzeugt Re-Export-Daten beim Apply |
| S7 | Employee erhält Export-Read via RLS |

---

## 14. Gate-Urteil

| Gate | Status | Begründung |
|------|--------|------------|
| Discovery / Architektur-Dokument | **GO** | F1–F12 final (Kevin 2026-07-08) |
| **Architektur-Freigabe F1–F12** | **APPROVED FOR SCHEMA PROPOSAL** | Alle 12 Entscheidungen final |
| **Schema Proposal 0252** | **GO PREPARED** | `wfm-p23-schema-proposal-0252.md` |
| **SQL Migration erstellen** | **GO PREPARED** | `supabase/migrations/0252_wfm_time_exports_p23.sql` (Entwurf, nicht angewendet) |
| **Implementation** | **NO-GO** | Nach SQL-Migration + Implementierungsgate |
| **Migration Apply (Staging)** | **NO-GO** | — |
| **Migration Apply (Production)** | **NO-GO** | — |
| **Deploy** | **NO-GO** | — |
| **Production Apply / Mutation** | **NO-GO** | — |

**F1–F12 Freigabe-Checkliste:** alle 12 ✓ (siehe §4.4)

---

## 15. Empfohlener nächster Schritt

1. **Schema-Proposal prüfen:** `docs/architecture/wfm-p23-schema-proposal-0252.md`  
2. **SQL-Migration 0252 entwerfen** (Datei `supabase/migrations/0252_wfm_time_exports_p23.sql`) — erst nach Freigabe „SQL Migration erstellen“  
3. **Implementation** Service + Policy + UI + Tests gemäß Gate + Proposal  
4. **Staging Apply + Smoke** — kein Production Apply / Deploy ohne Gate  

---

*Discovery-Gate — WFM P2.3 Re-Export / Supersede. Keine Secrets. Keine Production-Aktion. Dokument nicht committed.*
