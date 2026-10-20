# Client Core K.5 — Budget, Billing Handoff Abschlussbericht

**Datum:** 2026-06-21  
**Supabase Project:** `euagyyztvmemuaiumvxm`  
**Basis-HEAD:** `d4bf3ba` · **Branch:** `main`  
**Scope:** Klient:innen Core K.5 — Budgetverbrauch, Nachweis-Zuordnung, Abrechnungsvorbereitung. **Keine** finale Rechnung, **kein** K.6, **kein** Mitarbeiter:innen Core, **kein** B.2/B.3.

---

## 1. Executive Summary

K.5 baut die Brücke von freigegebenen Assist-Nachweisen zu Budgetverbrauch und Abrechnungsvorbereitung: **Billing Candidates**, **Blocking Reasons**, **Budgetbewegungen (Ledger)**, **Abrechnungsvorschau** in der Akte, Office-Vorbereitungsseite und Mandanten-Abrechnungsregeln je Leistungsart.

| Kriterium | Status |
|-----------|--------|
| Budgetverbrauch vorbereitet | ✅ |
| Nachweis → Budget Zuordnung | ✅ |
| Abrechnungsvorschau | ✅ |
| Billing Candidates | ✅ |
| Finale Rechnungen erzeugt | ❌ **NEIN** (by design) |
| Rechnungsnummern verbraucht | ❌ **NEIN** |
| Migration 0160 erstellt | ✅ |
| Migration 0160 applied | ⏳ nach Commit/Push |
| Portal-Leaks verhindert | ✅ |
| Typecheck K.5-Dateien | ✅ keine neuen Fehler |
| Tests K.5 + Regression | ✅ 39/39 |

**Ergebnis:** ✅ **SUCCESS**

---

## 2. Ausgangslage

- Assist Phase 4–4.6 + Proof → Portal E2E abgeschlossen
- Client Core K.0–K.4 (Migration 0159, Akte, Budget, Portal UI)
- Portal P.5.1 (`d4bf3ba`) — Edge Login E2E grün
- K.5 Ziel: Vorbereitung ohne Finalisierung

---

## 3. Git / Abort-Gates (Phase 1)

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ✅ |
| HEAD ≥ `d4bf3ba` | ✅ (`d4bf3ba`) |
| Sync `origin/main` | ✅ |
| Staged at start | ✅ leer |
| 0154–0159 modified | ✅ nicht geändert |
| staticRolePermissions | ✅ nicht geändert |
| 0154–0159 remote applied | ✅ |

Log: `.audit-migration-list-client-core-k5-precheck.log`

---

## 4. Inventar-Matrix (Auszug)

| Bereich | Quelle | K.5 Nutzung |
|---------|--------|-------------|
| assist_visit_proofs | 0156 | Proof → Candidate |
| client_budget_settings / movements | 0159 | Ledger reserve/consume/release |
| tenant_client_service_types | 0159 | Leistungsart → Regel |
| client_billing_candidates | **0160** | Idempotenter Kandidat je proof_id |
| tenant_service_type_billing_rules | **0160** | Rate, Pflichten |
| care invoice_drafts (0050) | bestehend | **nicht** angebunden — K.6 |

---

## 5. Domain Modell

- **Billing Candidate:** 1:1 je `proof_id`, Status `not_ready | ready_for_review | blocked | draftable`
- **Budgetbewegung:** `reserved | consumed | released | adjusted` → `client_budget_movements` + Link-Tabelle
- **Blocking Reasons:** 19 Keys (tenant-konfigurierbar via Regeln)
- **Preview:** Summen, Sperrgründe, Restbudget — **kein** `final_invoice`
- **neverFinalizeInvoice():** Guard in Readiness/Preview/Consumption

---

## 6. Budgetverbrauch

- `calculateBudgetConsumptionForCandidate` — Betrag aus Vorschau
- `reserveBudgetForCandidate` / `consumeBudgetForCandidate` / `releaseBudgetReservation`
- Idempotenz: UNIQUE `(tenant_id, proof_id)` + Ledger-Check `reference_type=billing_candidate`
- Keine stillen Überschreibungen — separate Bewegungen

---

## 7. Nachweis-Zuordnung

- `mapApprovedProofToBillingCandidate` — Proof + Visit → Draft
- `getProofBillingSourceSnapshot` — Tasks, Zeiten, Signatur, Freigabe
- Leistungsprofil/Budget via `resolveBillingContext`
- Kostenträger: Soft-Block → `ready_for_review` (nicht draftable)

---

## 8. Abrechnungsvorschau UI

| Bereich | Komponente / Route |
|---------|-------------------|
| Akte Budget & Abrechnung | `ClientBillingPrepPanel` in `ClientBudgetCorePanel` |
| Einsätze & Nachweise | `ClientProofBillingStatusPanel` |
| Office | `app/office/billing-preparation.tsx` |
| Mandant | Abrechnungsregeln in `client-service-types.tsx` |

Kein Button „Rechnung final erstellen“ / „Rechnung senden“.

---

## 9. Portal-Sicherheit

- `sanitizeClientPortalPayload` / `sanitizeEmployeePortalPayload` — strip `billing*`, `candidate*`, `blocking*`, `draft*`
- `clientPortalProjectionService` importiert keine Billing-Services
- Tests: `clientCoreK5BillingHandoff.test.ts` + `portalProjectionServices.test.ts`

---

## 10. Migration 0160

**Datei:** `supabase/migrations/0160_client_billing_handoff_foundation.sql`

Tabellen: `client_billing_candidates`, `client_billing_candidate_budget_movements`, `tenant_billing_settings`, `tenant_service_type_billing_rules`

- CREATE IF NOT EXISTS, RLS office.clients, idempotent seed
- **Applied:** nach Commit/Push (Phase 14)

---

## 11. Tests / Typecheck

```text
npm run typecheck > .audit-typecheck-client-core-k5-precommit.log
npx vitest run … clientCoreK5BillingHandoff … assistProofToPortalFlow … portalProjectionServices
```

- K.5: 17/17 grün
- Regression: 39/39 grün
- Typecheck: Repo-Baseline rot; **keine** Fehler in K.5-Dateien

Logs: `.audit-typecheck-client-core-k5-precommit.log`, `.audit-test-client-core-k5-precommit.log`

---

## 12. Bestandsschutz

| Aktion | Status |
|--------|--------|
| Mandanten/Klient:innen/Mitarbeiter gelöscht | ❌ nicht |
| Einsätze/Nachweise gelöscht | ❌ nicht |
| Budgets überschrieben | ❌ nicht |
| Rechnungen erzeugt | ❌ nicht |
| Rechnungsnummern verbraucht | ❌ nicht |
| Permission-Matrix geändert | ❌ nicht |
| 0154–0159 geändert | ❌ nicht |

---

## 13. Nicht ausgeführt

- Finale Rechnung, Versand, Mahnung, Inkasso
- Lohnabrechnung, Mitarbeiter:innen Core, B.2, B.3, K.6

---

## 14. Offene Risiken

- Produktive Abrechnungsdaten noch nicht live getestet
- Kostenträger/Abtretung — Soft-Blocks, K.6 Finalisierung
- DATEV/GoBD/Pflegekassenprüfung — später

---

## 15. Nächste Empfehlung

**Option C zuerst:** Manuelle Abrechnungsabnahme mit Demo-Daten (Akte → Vorschau → Kandidat prüfen), danach **K.6 Rechnungsdrafts/Dokumentenlayout**.

---

## Commits

Message: `feat(billing): prepare proof budget handoff`
