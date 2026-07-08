# WFM P2.3.1 Atomic Finalize Fix Gate

**Datum:** 2026-07-08  
**Branch:** `cursor/wfm-p23-reexport-supersede`  
**Staging:** `shwpweerzsfkqaivmaoc`  
**Production:** `euagyyztvmemuaiumvxm` — **nicht verwendet**

---

## Gate-Ergebnis

| Kriterium | Status |
|-----------|--------|
| P2.3 Finalize Smoke GO | **JA** |
| P2.3 staging-verifiziert | **JA** |
| Push-Freigabe | **JA** (Code + Migration + Smoke) |
| Deploy-Freigabe | **NEIN** |
| Production-Apply | **NEIN** |

---

## A) Root Cause

1. Partial Unique Index `uq_wfm_export_items_one_active_per_logical_key` erlaubt max. 1 `active` Item je `(tenant_id, logical_reference_key)`.
2. Service/Facade/Smoke führten vor RPC ein REST-INSERT mit `item_status='active'` aus, während das Original noch `active` war.
3. Insert scheiterte mit `duplicate key value violates unique constraint`.
4. RPC `wfm_finalize_correction_export(UUID)` erwartete bereits vorhandene active Correction-Items → `no active correction items on job`.

Delta/Preview war korrekt; Finalize war nicht atomar.

---

## B) Fix (Option B — RPC übernimmt Insert)

| Änderung | Status |
|----------|--------|
| Migration `0253_wfm_time_exports_p23_finalize_rpc_fix.sql` | **Erstellt** — neue Signatur `(p_export_job_id UUID, p_items JSONB)` |
| Staging Apply | **JA** — `wfm_time_exports_p23_finalize_rpc_fix` + `wfm_time_exports_p23_finalize_rpc_fk_order_fix` |
| RPC atomar (supersede → insert → review → actions → job) | **JA** |
| Service: kein pre-RPC active Item INSERT | **JA** — `finalizeCorrectionExport` ruft nur RPC mit `mapCorrectionItemsToRpcPayload` |
| Facade Draft: keine Item-Persistenz | **JA** — nur Job + pending_reexport_job_id |
| Partial Unique unverändert | **JA** |

Commit: `f492accd` — fix(wfm): finalize p23 corrections atomically  
Lokale FK-Reihenfolge: `superseded_by_export_item_id` nach INSERT (align mit Staging-FK-Fix).

---

## C) Staging Re-Smoke

**Testmandant:** `b2222222-2222-4222-8222-222222222201`

### Erster erfolgreicher Finalize (nach 0253 Apply, vor Re-Smoke-Script-Update)

| Feld | Wert |
|------|------|
| correction_job_id | `70dffd50-809f-4bcd-87fb-fe12ab57469c` |
| original_item | `b0c84b09-…` → superseded |
| new_item | `7bd8bdd6-…` → active, seq=2 |
| export_version | 2 |
| Actions | export_item_superseded, reexport_finalized, correction_export_finalized |

### Re-Smoke (seq 3, dynamisches active Item)

| Metrik | Vorher | Nachher |
|--------|--------|---------|
| Jobs (Tenant) | 9 | 10 |
| Items (Tenant) | 2 | 3 |
| Reviews | 9 | 9 |
| export_version | 2 | **3** |

| Check | Ergebnis |
|-------|----------|
| RPC success | **JA** (HTTP 200) |
| pre-RPC active items | **0** |
| Original P2.2 Item superseded | **JA** (payload `fnv1a-5c273ce4` stabil) |
| Vorheriges active Item superseded | **JA** (`7bd8bdd6-…`) |
| New Item active | **JA** (`733504ba-…`, seq=3) |
| export_sequence korrekt | **JA** (2 → 3) |
| partial unique | **JA** (0 Violations) |
| Review aktualisiert | **JA** |
| Actions geschrieben | **JA** |
| deltaMinutes | 30 |

---

## D) Security

| Check | Ergebnis |
|-------|----------|
| Employee RPC Negativcheck | **NICHT GETESTET** — employee.staging Login unavailable |
| Admin-only RPC | **JA** — Office-Auth erfolgreich |
| Production | **Nicht verwendet** |
| Secrets im Bericht | **Keine** |

---

## E) Tests / Build

| Suite | Ergebnis |
|-------|----------|
| P2.3 Kern (6 Dateien) | **47/47 grün** |
| Expo Export DEMO=false | **OK** |

---

## F) Referenzen

- Blocked Smoke: `docs/audit/wfm-p23-finalize-smoke-gate.md`
- Migration: `supabase/migrations/0253_wfm_time_exports_p23_finalize_rpc_fix.sql`
- Service: `finalizeCorrectionExport`, `mapCorrectionItemsToRpcPayload`
