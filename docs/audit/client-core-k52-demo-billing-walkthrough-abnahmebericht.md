# Client Core K.5.2 — Demo Billing Walkthrough Abnahmebericht

**Datum:** 2026-06-21  
**Branch:** `main` · **HEAD:** `7ba1c61`  
**Supabase Project:** `euagyyztvmemuaiumvxm`  
**Scope:** K.5.2 Master — sichere Demo-Abrechnungskette (Test Pflege GmbH only) + sichtbarer Office-Walkthrough. **Keine** finale Rechnung, **kein** K.6.

---

## 1. Executive Summary

| Kriterium | Status |
|-----------|--------|
| K.5.2 Master (sichtbar) | ⛔ **BLOCKED** |
| K.6 freigegeben | ❌ **NEIN** |
| ENV-Gate (Office-Login) | ❌ **BLOCKER** |
| Code + Regression (K.5) | ✅ 33/33 |
| Migration 0154–0160 remote | ✅ applied |
| Demo-Abrechnungsdaten | ❌ fehlen (0 Proofs/Kandidaten) |
| Browser-Walkthrough | ❌ nicht gestartet (ENV-Gate) |

**Ergebnis:** K.5.2 wurde am **ENV-Gate (Phase 2)** gestoppt. `AUDIT_BUSINESS_EMAIL` und `AUDIT_BUSINESS_PASSWORD` sind in `.env` **nicht gesetzt**. Ohne Office-Login ist keine sichtbare Abnahme möglich — K.6 bleibt blockiert.

---

## 2. Git / Abort-Gates (Phase 1)

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ✅ |
| HEAD enthält `7ba1c61` | ✅ |
| Sync `origin/main` | ✅ (HEAD = `7ba1c61`) |
| Staged at start | ✅ leer |
| 0154–0160 modified | ✅ nein |
| `staticRolePermissions` modified | ✅ nein |
| Finale Rechnungen erzeugt (Lauf) | ✅ nein |
| Produktive Budget-/Proof-Änderungen | ✅ nein |

Log: `.audit-migration-list-client-core-k52-precheck.log`

---

## 3. ENV-Gate (Phase 2) — BLOCKER

| Variable | In `.env` vorhanden |
|----------|---------------------|
| `AUDIT_BUSINESS_EMAIL` | ❌ nein |
| `AUDIT_BUSINESS_PASSWORD` | ❌ nein |
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ ja |
| Supabase Publishable/Anon Key | ✅ ja |

**Office-Login-Versuch:** nicht durchgeführt (Credentials fehlen — kein Auth-Bypass).

**Operator-Aktion:** In `.env` setzen (Werte **nicht** committen):

```env
AUDIT_BUSINESS_EMAIL=<office-user@test-pflege>
AUDIT_BUSINESS_PASSWORD=<secret>
```

Referenz: `.env.example` (keine Audit-Variablen dokumentiert — optional ergänzen).

---

## 4. Test Pflege GmbH — Mandantenidentifikation (Phase 3)

Supabase read-only Abfrage:

| Mandant | tenant_id | Hinweis |
|---------|-----------|---------|
| **Test Pflege GmbH** | `a4ba83bd-65db-46cf-8cf7-61492cc78315` | ✅ Zielmandant (eindeutig für K.5.2) |
| Test Pflege Live GmbH | `6e8a5c3b-03fd-423d-acd9-00edf9b24f99` | ⚠️ separater Mandant — **nicht** anfassen |

### Demo-Kontext (Test Pflege GmbH only)

| Signal | Anzahl |
|--------|--------|
| Klient:innen | 2 (Erika Mustermann, BodyMap Test) |
| Freigegebene Nachweise (`assist_visit_proofs.status=approved`) | 0 |
| `assist_visits` | 0 |
| `client_budget_settings` | 0 |
| `client_billing_candidates` | 0 |
| `client_budget_movements` | 0 |
| `tenant_budget_years` | 1 |
| `tenant_budget_types` | 2 |

**Folge:** Demo-Kette (Proof → Kandidat → Vorschau → Reservierung) kann nicht sichtbar verifiziert werden. Phase 4–6 wurden **nicht** ausgeführt (ENV-Gate + fehlende Demo-Daten).

---

## 5. Demo-Daten / K.5 Services (Phasen 4–5)

| Schritt | Status | Grund |
|---------|--------|-------|
| Demo client/employee/visit/proof | ⏭️ übersprungen | ENV-Gate; Walkthrough nicht möglich |
| Proof → billing candidate | ⏭️ | 0 approved proofs |
| Readiness / blocking reasons | ⏭️ | keine Kandidaten |
| Budget reserve / idempotency | ⏭️ | 0 client_budget_settings |

Code-Pfad weiterhin grün via Unit-Tests (`clientCoreK5BillingHandoff`).

---

## 6. Browser-Walkthrough (Phase 6)

| Schritt | Status |
|---------|--------|
| Office Business-Login | ❌ nicht ausführbar (Credentials) |
| Klient:in → Budget & Abrechnung | ❌ |
| Abrechnungsvorschau / Kandidat | ❌ |
| Budgetbewegungen / Sperrgründe | ❌ |
| Proof-Modal (scroll/close) | ❌ |
| Keine Final-Invoice-Buttons | ⏳ nicht verifiziert |

---

## 7. Portal-Leak-Check (Phase 7)

| Kanal | Ergebnis |
|-------|----------|
| Unit-Tests (`portalProjectionServices`, `assistProofToPortalFlow`) | ✅ 33/33 |
| Browser Client/Employee Portal | ❌ nicht ausführbar (Login) |

---

## 8. Tests / Typecheck (Phase 8)

```text
npx vitest run clientCoreK5BillingHandoff portalProjectionServices assistProofToPortalFlow
npm run typecheck
```

| Signal | Ergebnis |
|--------|----------|
| K.5 + Portal Regression | ✅ **33/33** |
| Typecheck Repo gesamt | ⚠️ Baseline rot (unverändert, v.a. Reporting/QM/Office) |
| Typecheck K.5-Dateien | ✅ keine neuen Fehler in diesem Lauf |

Logs: `.audit-test-client-core-k52-precommit.log`, `.audit-typecheck-client-core-k52-precommit.log`

---

## 9. Bestandsschutz

| Aktion | Status |
|--------|--------|
| Mandanten/Klient:innen gelöscht | ❌ nicht |
| Nachweise/Budgets produktiv geändert | ❌ nicht |
| Demo-Daten auf Test Pflege GmbH angelegt | ❌ nicht (ENV-Gate) |
| Rechnungen in diesem Lauf erzeugt | ❌ nicht |
| Rechnungsnummern verbraucht (Lauf) | ❌ nicht |
| Migrationen 0154–0160 geändert | ❌ nicht |
| Secrets in Report/Logs | ❌ nicht |

---

## 10. K.6 Release Gate

**K.6 bleibt BLOCKED.**

Freigabe erst wenn:

1. `.env`: `AUDIT_BUSINESS_EMAIL` + `AUDIT_BUSINESS_PASSWORD` gesetzt
2. Test Pflege GmbH: idempotente Demo-Kette (Visit → Proof approved → Budget setting → Kandidat)
3. Vollständiger Office-Browser-Walkthrough bestanden
4. Portal-Leak-Check im Browser bestätigt
5. Keine Final-Invoice-Aktionen sichtbar

---

## 11. Nächste Schritte (Operator)

1. `.env`: Audit-Credentials setzen (boolean gate bestanden)
2. K.5.2 Re-Run: Demo-Daten nur auf `a4ba83bd-…` (Test Pflege GmbH)
3. `node .audit-client-core-k51-browser.mjs` oder Browser MCP auf Expo 8081–8083
4. Nach grünem Walkthrough → K.6 freigeben

---

## 19-Punkt-Summary

| # | Frage | Antwort |
|---|-------|---------|
| 1 | K.5.2 success/blocked? | **BLOCKED** (ENV-Gate + keine Demo-Daten) |
| 2 | Office login checked? | **NO** — Credentials fehlen in `.env` |
| 3 | Test Pflege GmbH unambiguous? | **YES** — `a4ba83bd-…` vs. Live GmbH getrennt |
| 4 | Demo proof approved? | **NO** (0 approved proofs) |
| 5 | Demo budget present? | **NO** (0 client_budget_settings; 1 year / 2 types on tenant) |
| 6 | Billing candidate created? | **NO** |
| 7 | Budget reservation checked? | **NO** |
| 8 | Browser walkthrough done? | **NO** |
| 9 | Portal leaks checked? | **Tests YES / Browser NO** |
| 10 | Final invoices? | **NO** |
| 11 | Invoice numbers? | **NO** |
| 12 | Secrets documented? | **NO** |
| 13 | Bestandsschutz confirmed? | **YES** |
| 14 | Tests result? | **33/33 pass** |
| 15 | Typecheck result? | **Baseline rot; K.5 unverändert grün** |
| 16 | Commit hash? | *(nach Commit)* |
| 17 | Push successful? | *(nach Push)* |
| 18 | K.6 released? | **NO** |
| 19 | Report path? | `docs/audit/client-core-k52-demo-billing-walkthrough-abnahmebericht.md` |
