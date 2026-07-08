# WFM P2.3 — Schema-Proposal Migration 0252

**Datum:** 2026-07-08  
**Status:** **Proposal + SQL-Entwurf** — `0252_wfm_time_exports_p23.sql` erstellt, **nicht angewendet**  
**Basis:** WFM P2.2 FINAL GO (Deploy `f8da14d7`, Migration `0248_wfm_time_exports_p22` applied on Production)  
**Architektur-Gate:** `docs/architecture/wfm-p23-reexport-supersede-architecture-gate.md` (F1–F12 final freigegeben)  
**Geplante Migration:** `0252_wfm_time_exports_p23.sql` — **noch nicht erstellen**

---

## 1. Executive Summary

WFM P2.3 ermöglicht **auditierbare Korrektur-Exports** nach finalisiertem P2.2-Initial-Export: Drift-Erkennung (F1/F3), Korrektur-Jobs (F4/F10), Item-Supersede (F5/F8/F9), Delta-CSV (F11), Service-only (F12).

Migration **0252** erweitert das P2.2-Schema (0248) **rückwärtskompatibel** und löst den zentralen Blocker **`UNIQUE (tenant_id, reference_key)`** durch versionierte Keys + `export_sequence` + Partial Unique auf `logical_reference_key`.

**Gate dieses Dokuments:**

| Gate | Status |
|------|--------|
| Schema Proposal | **GO PREPARED** |
| SQL Migration erstellen | **NO-GO** bis Freigabe |
| Implementation | **NO-GO** |
| Migration Apply | **NO-GO** |
| Deploy | **NO-GO** |
| Production Apply | **NO-GO** |

---

## 2. Scope / Non-Scope

### Im Scope (0252 Proposal)

- Schema-Erweiterungen für Korrektur-Export, Supersede, Drift-Denormalisierung
- RPC-Proposal für atomares Finalize + Supersede
- RLS/Permission-Erweiterungen für `reviewed_time_correction`
- Backfill bestehender P2.2-Items (`export_sequence=1`, `item_status=active`, `logical_reference_key` aus Review-Key)

### Non-Scope (F7, verbindlich)

| Ausgeschlossen |
|----------------|
| DATEV-Integration |
| Lohnexport / Payroll-Bridge |
| Employee Export View |
| Platform Console / Migrationen 0249–0251 |
| Automatische Abrechnung |
| Produktive Datenkorrektur ohne explizite Office-Aktion |
| DB-Trigger für Drift (F12) |
| DELETE auf Export-Items |
| Payload-Overwrite auf alten Items |
| Re-Export-Daten beim Migration-Apply |
| Seeds |

---

## 3. Bezug zu P2.2 / Migration 0248

### P2.2 liefert (Production)

| Objekt | Stand 0248 |
|--------|------------|
| `workforce_export_jobs` | `export_type`: `reviewed_time` \| `session_legacy`; Status-Lifecycle draft→finalized |
| `workforce_time_export_items` | Snapshots; **`UNIQUE (tenant_id, reference_key)`** |
| `workforce_time_entry_reviews` | `export_status`, `last_export_job_id`, `changed_after_export` |
| `workforce_time_review_actions` | Export-Actions in CHECK (teilweise ungenutzt) |
| RLS | Items admin.export only; kein UPDATE/DELETE für authenticated |

### P2.3 baut darauf auf

- **Erweitert**, ersetzt nicht: Initial Draft→Validate→Finalize bleibt regressionsfrei (F4, Stop S4)
- **0252** ist additive Migration; P2.2 Production-Daten (aktuell Counts 0/0) bleiben gültig nach Backfill-Defaults

---

## 4. Warum 0252

| Nummer | Inhalt | P2.3-Relevanz |
|--------|--------|---------------|
| 0248 | WFM P2.2 Export | Basis — bereits auf Production |
| 0249 | Platform RPC revoke | **Nicht vermischen** |
| 0250 | Platform list tenants | **Nicht vermischen** |
| 0251 | Platform RLS helper grants | **Nicht vermischen** |
| **0252** | **WFM P2.3 Re-Export / Supersede** | **Nächste freie WFM-Nummer** |

**Regel:** P2.3-Arbeit nur auf WFM-Branch; keine Platform-Migrationen übernehmen oder mischen.

---

## 5. Tabellenänderungen Proposal

### 5.A) `workforce_export_jobs`

| Spalte | Typ | Nullable | Default | Zweck |
|--------|-----|----------|---------|-------|
| `correction_of_export_job_id` | UUID | YES | — | FK → `workforce_export_jobs(id)` ON DELETE RESTRICT |
| `correction_reason` | TEXT | YES | — | Pflicht bei Korrektur (F6/F11), max 500 Zeichen |
| `correction_sequence` | INTEGER | YES | — | Laufende Korrektur-Nr. pro Ursprungs-Job (optional, ≥1) |
| `export_scope` | TEXT | YES | — | CHECK: `delta_correction` \| `full_replacement` — **P2.3 MVP nur `delta_correction`** |

**CHECK `export_type` erweitern:**

```text
reviewed_time | reviewed_time_correction | session_legacy
```

**Constraints (Proposal):**

| Constraint | Regel |
|------------|-------|
| `correction_job_requires_parent` | IF `export_type = 'reviewed_time_correction'` THEN `correction_of_export_job_id IS NOT NULL` |
| `correction_job_requires_reason` | IF `export_type = 'reviewed_time_correction'` THEN `correction_reason IS NOT NULL AND length(trim(correction_reason)) >= 10` |
| `correction_scope_delta_mvp` | IF `export_type = 'reviewed_time_correction'` THEN `export_scope = 'delta_correction'` |
| `no_self_reference` | `correction_of_export_job_id <> id` |
| `initial_job_no_correction_meta` | IF `export_type = 'reviewed_time'` THEN `correction_of_export_job_id IS NULL` |

**RLS:** SELECT/INSERT/UPDATE für `reviewed_time_correction` analog `reviewed_time` — nur `time.tracking.admin.export` / `is_tenant_admin()`.

---

### 5.B) `workforce_time_export_items`

| Spalte | Typ | Nullable | Default | Zweck |
|--------|-----|----------|---------|-------|
| `logical_reference_key` | TEXT | NO* | — | Stabiler Ursprung, z. B. `review:<uuid>` |
| `export_sequence` | INTEGER | NO | 1 | 1 = Initial, 2+ = Korrektur |
| `supersedes_export_item_id` | UUID | YES | — | FK → self; neues Item → altes Item |
| `item_status` | TEXT | NO | `'active'` | `active` \| `superseded` \| `voided` |
| `correction_reason` | TEXT | YES | — | Denormalisiert aus Job |
| `source_review_version_hash` | TEXT | YES | — | Optional: Hash des Review-Standes bei Export |
| `previous_payload_hash` | TEXT | YES | — | Hash des superseded Items |
| `correction_payload_delta` | JSONB | YES | — | `{ changedFields, oldValues, newValues, deltaMinutes }` |
| `superseded_at` | TIMESTAMPTZ | YES | — | Zeitpunkt Supersede (RPC) |
| `superseded_by` | UUID | YES | — | FK → `auth.users(id)`; wer Supersede ausgelöst hat |

\* Backfill: aus bestehendem `reference_key` / Review ableiten; NOT NULL nach Backfill.

**Bestehend P2.2:** `superseded_by_export_item_id` auf **altem** Item (alt zeigt auf neu) — **beibehalten**; bidirektionale Kette mit `supersedes_export_item_id` auf neuem Item.

**Constraint-Änderung (kritisch, F8):**

```sql
-- ENTFERNEN (0248):
UNIQUE (tenant_id, reference_key)

-- NEU:
UNIQUE (tenant_id, reference_key)              -- physical key bleibt global eindeutig
UNIQUE (tenant_id, export_job_id, review_id)  -- unverändert P2.2

-- Partial Unique (max. 1 active Item pro logischem Ursprung):
CREATE UNIQUE INDEX uq_wfm_export_items_one_active_per_logical_key
  ON workforce_time_export_items (tenant_id, logical_reference_key)
  WHERE item_status = 'active';
```

**Physical `reference_key`-Strategie (F8):**

| Sequenz | Beispiel physical `reference_key` |
|---------|-----------------------------------|
| 1 (Initial) | `review:<review_id>` |
| 2 | `review:<review_id>:v2` oder `review:<review_id>:correction:2` |
| n | `review:<review_id>:correction:<n>` |

**Immutability (F5/F7):**

- Kein UPDATE auf `exported_payload`, `payload_hash`, `minutes_total`, … für authenticated
- Erlaubtes UPDATE **nur via SECURITY DEFINER RPC** auf: `item_status`, `superseded_by_export_item_id`, `superseded_at`, `superseded_by`
- Kein DELETE

**Backfill Apply (0252):**

```text
logical_reference_key = reference_key (oder aus review_id abgeleitet)
export_sequence = 1
item_status = 'active'
```

---

### 5.C) `workforce_time_entry_reviews`

| Spalte | Typ | Nullable | Default | Zweck |
|--------|-----|----------|---------|-------|
| `changed_after_export_detected_at` | TIMESTAMPTZ | YES | — | F1/F3 |
| `changed_after_export_reason` | TEXT | YES | — | z. B. `minutes_changed`, `manual_detect` |
| `latest_export_item_id` | UUID | YES | — | FK → Items; aktives Item |
| `pending_reexport_job_id` | UUID | YES | — | FK → Jobs; offener Korrektur-Draft |
| `export_version` | INTEGER | NO | 1 | Inkrement bei Korrektur-Finalize |

Bestehende P2.2-Spalten unverändert: `export_status`, `last_export_job_id`, `last_exported_at`, `changed_after_export`.

---

### 5.D) `workforce_time_review_actions`

**CHECK `action` erweitern um:**

| Action | Wann |
|--------|------|
| `export_change_detected` | Drift erkannt (F1) |
| `reexport_requested` | Admin startet Korrektur-Vorbereitung |
| `reexport_drafted` | Korrektur-Job angelegt |
| `reexport_finalized` | Korrektur-Job finalisiert |
| `export_item_superseded` | Item-Kette geschrieben |
| `correction_export_finalized` | Aggregat pro Korrektur-Job |

Bestehend P2.2/P2.3-vorbereitet: `changed_after_export_detected`, `export_voided`, `export_reopened` — void/reopen nur Admin-Einzelfall, nicht MVP-Default.

---

### 5.E) RPC Proposal

**Name:** `wfm_finalize_correction_export(p_tenant_id, p_job_id, p_actor_id)`

**Aufgabe (atomar, SECURITY DEFINER):**

1. Permission prüfen (`time.tracking.admin.export` oder tenant_admin)
2. Job validieren: `export_type = reviewed_time_correction`, Status `validated`, `correction_of_export_job_id` + `correction_reason` gesetzt
3. Pro Review-Kandidat:
   - INSERT neues Item (`export_sequence = max+1`, neuer physical `reference_key`, `item_status = active`)
   - UPDATE altes Item: `item_status = superseded`, `superseded_by_export_item_id`, `superseded_at`, `superseded_by`
   - UPDATE Review: `export_status = exported`, `changed_after_export = false`, `latest_export_item_id`, `export_version + 1`
   - INSERT Review Actions (`export_item_superseded`, …)
4. Job → `finalized`, `finalized_at/by`
5. Action `correction_export_finalized`

**Alternative RPC:** `wfm_supersede_export_items(p_pairs jsonb)` — nur Supersede-Teil; Finalize-RPC bevorzugt (weniger Roundtrips, F4).

**GRANT:** `EXECUTE` an `authenticated`; interne Permission-Prüfung im RPC.

---

### 5.F) RLS / Permissions (F2/F7)

| Ressource | Regel |
|-----------|-------|
| `reviewed_time_correction` Jobs | SELECT/INSERT/UPDATE wie `reviewed_time` — admin.export / tenant_admin |
| Items SELECT/INSERT | unverändert admin.export / tenant_admin |
| Items UPDATE | **kein** authenticated — nur RPC |
| Drift markieren | admin.export OR admin.correct OR tenant_admin |
| Korrektur-Finalize | admin.export OR tenant_admin |
| Employee / Team | **denied** — keine Policy-Erweiterung |
| RPC | SECURITY DEFINER; tenant_id + permission check |

**Keine Leaks:** Korrektur-Jobs erscheinen nicht in Employee-Self-Read; `session_legacy` Self-Read unverändert.

---

### 5.G) CSV Delta Payload (F11 — DELTA, final)

**Nur Korrektur-Jobs** (`export_type = reviewed_time_correction`). Kein Vollersatz der Periode.

**Header (Semikolon):**

```text
export_kind;logical_reference_key;reference_key;export_sequence;original_export_job_id;correction_export_job_id;original_export_item_id;new_export_item_id;employee_id;employee_name;entry_kind;period_date;changed_fields;old_values;new_values;delta_minutes;correction_reason;finalized_at;finalized_by;payload_hash;previous_payload_hash
```

| Feld | Quelle |
|------|--------|
| `export_kind` | Konstant `correction_delta` |
| `changed_fields` | JSON-Array in CSV escaped oder `;`-joined |
| `old_values` / `new_values` | aus `correction_payload_delta` |
| `delta_minutes` | new.minutes - old.minutes |
| Audit-IDs | Job/Item-FKs |

**Initial-Export CSV (P2.2):** unverändert.

**Payload JSONB:** `schemaVersion: 2` mit `exportSequence`, `logicalReferenceKey`, `supersedesItemId`, `correctionDelta`.

---

### 5.H) Migration Safety

| Regel | Umsetzung |
|-------|-----------|
| Idempotent | `IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` |
| Rückwärtskompatibel | Nullable neue Spalten; Defaults; P2.2 Code läuft weiter bis Deploy |
| Keine Re-Export-Daten beim Apply | Nur Schema + Backfill metadata |
| Keine Seeds | — |
| Keine Production-Mutation außer Schema | Backfill: seq=1, status=active, logical_key |
| P2.2 Items gültig | Backfill aus bestehenden Zeilen |
| Kein Trigger | F12 |
| Forward-only | Rollback via PITR, nicht via down migration |

**Erwarteter Production-Apply-Impact (aktuell):** 0 Items → Backfill no-op auf Daten, Schema-Änderungen only.

---

### 5.I) Tests (Proposal)

| Ebene | Fokus |
|-------|-------|
| Migration | Constraint drop/add; Backfill; idempotent re-apply |
| Policy | `isReviewCorrectionExportable`; Initial-Policy unverändert |
| Service | Drift live hash; correction draft/finalize; duplicate prevention |
| CSV | Delta-Spalten; golden file; kein Vollersatz |
| UI | Badges, Grund-Pflicht, permission denied |
| RLS negativ | Employee 403; cross-tenant denied |
| Staging Smoke | Initial → change → drift → correction → CSV → supersede chain |

---

### 5.J) Stop-Kriterien

| # | Stop |
|---|------|
| 1 | P2.2 Initial Export bricht (Regression) |
| 2 | Employee sieht Exportdaten |
| 3 | Mehr als ein `active` Item pro `logical_reference_key` |
| 4 | Alte Payloads werden verändert |
| 5 | Korrektur ohne Grund (< 10 Zeichen) |
| 6 | Korrektur ohne Permission |
| 7 | `reviewed_time_correction` ohne `correction_of_export_job_id` |
| 8 | Korrektur-CSV enthält Vollersatz statt Delta |
| 9 | Migration Apply erzeugt Export-Items/Re-Exports |
| 10 | Platform-Migrationen in 0252 enthalten |

---

### 5.K) Gate Urteil (dieses Proposal)

| Gate | Status |
|------|--------|
| **Schema Proposal** | **GO PREPARED** |
| **SQL Migration erstellen** | **GO PREPARED** | Entwurf: `supabase/migrations/0252_wfm_time_exports_p23.sql` |
| **Implementation** | **NO-GO** |
| **Deploy** | **NO-GO** |
| **Production Apply** | **NO-GO** |

---

## 6. Konsistenz mit Architektur-Gate

| Thema | Gate F# | Proposal § |
|-------|---------|------------|
| Live-Hash Drift | F1 | Service-Design (Implementation); keine DB-Trigger |
| Permissions | F2 | 5.F |
| Service-only | F3/F12 | 5.H — kein Trigger in 0252 |
| Korrektur-Job | F4/F10 | 5.A |
| Item-Supersede | F5 | 5.B, 5.E |
| Audit | F6 | 5.D, 5.G |
| Non-Scope | F7 | §2 |
| Key-Strategie | F8 | 5.B Partial Unique + physical key |
| item_status | F9 | 5.B |
| Delta CSV | F11 | 5.G |
| Migration 0252 | — | §4, 5.H |

**Keine Widersprüche** zwischen Gate-Dokument und diesem Proposal.

---

## 7. Empfohlener nächster Schritt

1. **SQL-Entwurf review** — `supabase/migrations/0252_wfm_time_exports_p23.sql` (erstellt, nicht angewendet)  
2. **Staging Apply Gate** — explizite Freigabe für MCP/db push auf Staging only  
3. **Implementation** Service + Policy + UI + Tests  
4. **Staging Smoke** — kein Production Apply / Deploy ohne Gate  

---

## 8. SQL-Entwurf (Referenz)

**Datei:** `supabase/migrations/0252_wfm_time_exports_p23.sql`  
**Status:** Entwurf — **nicht angewendet**, kein db push  
**Inhalt:** Abschnitte A–G entsprechend §5; RPC `wfm_finalize_correction_export(UUID)`  

---

*Proposal only — keine SQL-Datei, kein Apply, kein Deploy, keine Secrets.*
