# WFM P2.3 Re-Export Finalize Smoke Gate

**Datum:** 2026-07-08  
**Branch:** `cursor/wfm-p23-reexport-supersede`  
**HEAD:** `6c8ec96b` — feat(wfm): complete p23 correction export UI  
**Staging:** `shwpweerzsfkqaivmaoc`  
**Production:** `euagyyztvmemuaiumvxm` — **nicht verwendet**

---

## Gate-Ergebnis

| Kriterium | Status |
|-----------|--------|
| Re-Export-Finalize-Smoke GO | **NEIN — BLOCKED** |
| P2.3 vollständig staging-verifiziert | **NEIN** (Service/UI grün; echter Finalize fehlgeschlagen) |
| Push-Freigabe | **NEIN** (Finalize-Smoke offen) |
| Deploy-Freigabe | **NEIN** |
| Production-Apply | **NEIN** |

**Grund:** Der designed Flow (Service-INSERT aktiver Correction-Items vor RPC `wfm_finalize_correction_export`) kollidiert auf Staging mit dem Partial-Unique-Index `uq_wfm_export_items_one_active_per_logical_key`. Correction-Item-INSERT schlägt fehl → RPC antwortet mit HTTP 400 / `no active correction items on job`.

---

## A) Git

| Feld | Wert |
|------|------|
| Branch | `cursor/wfm-p23-reexport-supersede` |
| HEAD | `6c8ec96b` |
| Working Tree | Sauber (keine staged/modified tracked files) |
| Untracked | `scripts/audit/_wfm-p23-staging-smoke-temp.mjs`, `scripts/audit/_platform-1-5-staging-smoke-temp.mjs` |
| Push | **Nein** |
| Deploy | **Nein** |
| `[deploy]` | **Nein** |

Precheck: Branch und HEAD korrekt; keine Platform-Dateien geändert; Gate-Artefakte (`.gate-0252-*`, `.gate-apply-args.json`, `.gate-sql.b64`) unangetastet.

---

## B) Testkontext

| Feld | Wert |
|------|------|
| Staging Ref | `shwpweerzsfkqaivmaoc` |
| Production ausgeschlossen | **Ja** |
| tenant_id | `b2222222-2222-4222-8222-222222222201` |
| original export_job_id | `356fe767-b8fd-4a2f-952c-cb4916c198da` (reviewed_time, finalized) |
| original export_item_id | `b0c84b09-cd7d-4600-8bb4-c8fe2e26b1ac` |
| review_id | `b2222222-2222-4222-8222-222222222281` |
| logical_reference_key | `review:b2222222-2222-4222-8222-222222222281` |
| original export_sequence | `1` |
| original payload_hash | `fnv1a-5c273ce4` (exported_payload `minutesTotal=480`) |
| Review-Drift (metadata) | `minutes_total=510` vs. Export 480 |

Dedizierter Staging-Testmandant vorhanden — **JA**.

---

## C) Pre-Finalize (Staging read-only)

### Globale Counts (nach fehlgeschlagenem Smoke-Versuch, Zustand unverändert ggü. Post-Failure)

| Metrik | Wert |
|--------|------|
| workforce_export_jobs | 5 |
| workforce_time_export_items | 1 |
| workforce_time_entry_reviews | 9 |
| correction jobs (`reviewed_time_correction`) | 2 |
| active items | 1 |
| superseded items | 0 |
| voided items | 0 |
| changed_after_export reviews | 1 |
| pending_reexport_job_id gesetzt | 1 |
| reviews export_version > 1 | 0 |

### Partial Unique Check

```sql
SELECT tenant_id, logical_reference_key, count(*)
FROM workforce_time_export_items
WHERE item_status = 'active'
GROUP BY tenant_id, logical_reference_key
HAVING count(*) > 1;
```

**Ergebnis:** 0 Treffer — **grün** (kein Finalize durchgeführt).

### Payload-Stichprobe

| Item | payload_hash | item_status | exported_payload minutesTotal |
|------|--------------|-------------|-------------------------------|
| `b0c84b09-…` | `fnv1a-5c273ce4` | active | 480 (unverändert) |

### Review-Stichprobe

| Feld | Wert |
|------|------|
| export_status | `changed_after_export` |
| export_version | `1` |
| changed_after_export | `true` |
| changed_after_export_reason | `p23_staging_smoke_drift` |
| pending_reexport_job_id | `5c3dc0fc-9bb2-458c-a28b-95815342f5fc` |
| latest_export_item_id | `b0c84b09-cd7d-4600-8bb4-c8fe2e26b1ac` |

---

## D) Draft / Preview / Validate

Ausgeführt über temporäres Staging-Smoke-Skript (`scripts/audit/_wfm-p23-staging-smoke-temp.mjs`, **nicht committed**), Office-Auth `office.staging@example.test`.

| Schritt | Ergebnis |
|---------|----------|
| Drift erkannt | **Ja** — Review-Version-Hash ≠ Item `source_review_version_hash` |
| changed_after_export gesetzt | **Ja** |
| Reason auf Correction-Job | **Ja** — `p23_staging_smoke_correction` |
| Correction-Job erstellt | **Ja** — `5c3dc0fc-9bb2-458c-a28b-95815342f5fc` (status `validated`) |
| Preview / Delta | **Ja** — `deltaMinutes=30`, `changedFields=['minutesTotal']` |
| previous_payload_hash | **Ja** — `fnv1a-5c273ce4` |
| source_review_version_hash | **Ja** — berechnet aus Review 510 min |
| Validate (Job status) | **Ja** — manuell `validated` |
| Keine neuen active Items vor Finalize-INSERT | **Ja** — INSERT scheitert |
| Idempotente export_change_detected Actions | **Nein** — Duplikat-Action aus Smoke-Retry (4× `export_change_detected`) |

---

## E) Finalize

| Feld | Wert |
|------|------|
| Ausgeführt | **Ja (Versuch)** |
| Methode | REST INSERT Item + RPC `wfm_finalize_correction_export` |
| RPC Erfolg | **NEIN** — HTTP 400 |
| Fehler (Postgres) | `duplicate key value violates unique constraint "uq_wfm_export_items_one_active_per_logical_key"` beim Item-INSERT; danach RPC: `wfm_finalize_correction_export: no active correction items on job` |

### Ursache (Schema/Flow-Inkompatibilität)

Migration `0252` definiert:

- Partial Unique Index: max. **1 active Item** je `(tenant_id, logical_reference_key)`
- RPC erwartet **bereits eingefügte active Correction-Items** auf dem Job, superseded dann das alte active Item **in derselben RPC-Transaktion**
- Service/Facade/Smoke führen Item-INSERT als **separate REST-Transaktion** mit `item_status='active'` aus, **bevor** das Original-Item superseded wird → Unique-Verletzung

**Folge:** Kein Correction-Item persistiert; Original-Item bleibt `active`; `export_version` bleibt `1`.

### Offene Correction-Jobs (Smoke-Nebenwirkung, nicht gelöscht)

| Job ID | Status | Items |
|--------|--------|-------|
| `7260e15d-0637-47d5-9e86-6fa57fcd5183` | validated | 0 |
| `5c3dc0fc-9bb2-458c-a28b-95815342f5fc` | validated | 0 |

---

## F) Post-Finalize

Finalize **nicht erfolgreich** — Post-Checks gegen Erwartung:

| Check | Erwartung | Ist |
|-------|-----------|-----|
| Jobs +1 finalisiert | correction job finalized | **NEIN** — beide correction jobs `validated`, nicht `finalized` |
| Items +1 | neues active Correction-Item | **NEIN** — weiterhin 1 Item |
| Original Item superseded | superseded | **NEIN** — `active` |
| New Item active | active seq=2 | **NEIN** — INSERT fehlgeschlagen |
| export_sequence +1 | 2 | **NEIN** — 1 |
| latest_export_item_id aktualisiert | neues Item | **NEIN** — Original |
| export_version +1 | 2 | **NEIN** — 1 |
| payload_hash Original stabil | fnv1a-5c273ce4 | **JA** |
| partial unique | 0 violations | **JA** |
| P2.3 Actions (reexport_*, superseded, correction_export_finalized) | geschrieben | **NEIN** |

---

## G) Security

| Check | Ergebnis |
|-------|----------|
| Production nicht verwendet | **Ja** |
| Secrets im Bericht | **Keine** |
| Employee RPC Negativcheck | **NICHT GETESTET** — `employee.staging@example.test` Login auf Staging nicht verfügbar |
| RLS (Office-Auth Finalize-Versuch) | Office-User authentifiziert; RPC erreicht, scheitert an fehlenden Items |
| Keine manuelle SQL-Reparatur | **Ja** |
| Keine Payload-Überschreibung | **Ja** |

---

## H) Tests / Build

| Suite | Ergebnis |
|-------|----------|
| `wfmExportScreen.test.ts` | **8/8 grün** |
| `wfmTimeExportP23.test.ts` | **9/9 grün** |
| `wfmTimeCorrectionExportService.test.ts` | **7/7 grün** |
| `wfmTimeExportService.test.ts` | **6/6 grün** |
| `wfmTimeExportPolicy.test.ts` | **7/7 grün** |
| `wfmTimeExportPayloadBuilder.test.ts` | **8/8 grün** |
| **Summe (P2.3-Kern)** | **45/45 grün** |
| P2.3 Typecheck | **Altlasten** in `wfmTimeCorrectionExportService.ts` / `wfmTimeExportService.ts` (RPC-Typen, `reason` vs. `comment`) — Demo/Unit-Tests grün |
| `EXPO_PUBLIC_DEMO_MODE=false npx expo export --platform web` | **OK** (`dist/`) |

---

## I) Gate / Nächste Schritte

### Akzeptanzkriterien (Auszug)

| # | Kriterium | Erfüllt |
|---|-----------|---------|
| 1 | Sicherer Staging-Testkontext | **Ja** |
| 2 | Production nicht verwendet | **Ja** |
| 3 | Draft/Preview/Validate grün | **Teilweise** (Validate ok; Item-INSERT blockiert) |
| 4 | Finalize über RPC erfolgreich | **Nein** |
| 5–13 | Supersede / Review / Actions | **Nein** (Finalize nicht durchgelaufen) |
| 16 | Tests grün | **Ja** |
| 17 | Expo Export OK | **Ja** |
| 18–21 | Bericht / kein Push / kein Deploy / kein Prod | **Ja** |

### Empfohlener Fix (separates Ticket, nicht in diesem Gate)

1. **Schema/ RPC:** Correction-Items erst in derselben Transaktion wie Supersede aktivieren — z. B. neuer Item-Status `draft`/`pending` (aus Partial Unique ausgenommen) **oder** Item-INSERT in `wfm_finalize_correction_export` integrieren.
2. **Service/Facade:** Kein REST-INSERT mit `item_status='active'` vor RPC außerhalb atomarer DB-Transaktion.
3. **Staging Re-Smoke:** Nach Fix erneut Finalize-Gate auf `b222…` Testmandant.

---

## Abschluss (Phase 14)

| # | Feld | Wert |
|---|------|------|
| 1 | Branch | `cursor/wfm-p23-reexport-supersede` |
| 2 | HEAD vorher | `6c8ec96b` |
| 3 | HEAD nachher | *(nach Report-Commit)* |
| 4 | Testkontext vorhanden | **JA** |
| 5 | Finalize ausgeführt | **JA (fehlgeschlagen)** |
| 6 | Jobs vorher/nachher | 5 / 5 |
| 7 | Items vorher/nachher | 1 / 1 |
| 8 | Reviews vorher/nachher | 9 / 9 |
| 9 | Original Item superseded | **NEIN** |
| 10 | New Item active | **NEIN** |
| 11 | export_sequence korrekt | **NEIN** |
| 12 | payload_hash original stabil | **JA** |
| 13 | partial unique grün | **JA** |
| 14 | Review aktualisiert | **NEIN** |
| 15 | Actions geschrieben | **NEIN** (P2.3 Finalize-Actions) |
| 16 | Employee denied | **NICHT GETESTET** |
| 17 | Tests | **45/45 grün** |
| 18 | Export | **OK** |
| 19 | Bericht | `docs/audit/wfm-p23-finalize-smoke-gate.md` |
| 20 | Push | **NEIN** |
| 21 | Deploy | **NEIN** |
| 22 | Production Apply | **NEIN** |
