# Client Core K.5.2 RETRY — Demo Billing Walkthrough Abnahmebericht

**Datum:** 2026-06-21  
**Lauf:** K.5.2 RETRY (Credentials in `.env` gesetzt — Keys vorhanden, Login fehlgeschlagen)  
**Branch:** `main` · **HEAD:** `efbf0d1`  
**Supabase Project:** `euagyyztvmemuaiumvxm`  
**Scope:** K.5.2 Master — sichere Demo-Abrechnungskette (Test Pflege GmbH only) + sichtbarer Office-Walkthrough. **Keine** finale Rechnung, **kein** K.6.

---

## 1. Executive Summary

| Kriterium | Status |
|-----------|--------|
| K.5.2 Master (sichtbar) | ⛔ **BLOCKED** |
| K.6 freigegeben | ❌ **NEIN** |
| ENV-Gate (Keys vorhanden) | ✅ **PASS** |
| Office-Login | ❌ **BLOCKER** (`Invalid login credentials`) |
| Demo-Abrechnungskette (Test Pflege GmbH) | ✅ angelegt (idempotent) |
| Code + Regression (K.5 + modalStack) | ✅ 38/38 |
| Browser-Walkthrough | ❌ nicht abgeschlossen (Login + Playwright) |

**Ergebnis:** ENV-Keys sind gesetzt und die idempotente Demo-Kette auf **Test Pflege GmbH** wurde per Supabase-Admin-Seed angelegt (1 Proof, 1 Kandidat, 1 Budget, 1 Reservierung). **Office-Login schlägt mit ungültigen Credentials fehl** — sichtbarer Walkthrough konnte nicht bestanden werden. K.6 bleibt blockiert.

---

## 2. Git / Abort-Gates (Phase 1)

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ✅ |
| HEAD enthält `efbf0d1` | ✅ (HEAD = `efbf0d1`) |
| Sync `origin/main` | ✅ |
| Staged at start | ✅ leer |
| Finale Rechnungen erzeugt (Lauf) | ✅ nein |
| Produktive Budget-/Proof-Änderungen (andere Mandanten) | ✅ nein |

---

## 3. ENV-Gate (Phase 2)

| Variable | In `.env` vorhanden |
|----------|---------------------|
| `AUDIT_BUSINESS_EMAIL` (oder TEST/UAT-Variante) | ✅ ja |
| `AUDIT_BUSINESS_PASSWORD` (oder TEST/UAT-Variante) | ✅ ja |
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ ja |
| Supabase Publishable/Anon Key | ✅ ja |

Script-Gate: `node .audit-k51-env-check.mjs` → `businessEmail: true`, `businessPassword: true`

**Office-Login:** ❌ `Invalid login credentials` (Supabase Auth — Werte in `.env` passen nicht zum Remote-User; keine Credentials geloggt/committet).

---

## 4. Test Pflege GmbH — Mandantenidentifikation (Phase 3)

| Mandant | tenant_id | Hinweis |
|---------|-----------|---------|
| **Test Pflege GmbH** | `a4ba83bd-65db-46cf-8cf7-61492cc78315` | ✅ Zielmandant (eindeutig) |
| Test Pflege Live GmbH | `6e8a5c3b-03fd-423d-acd9-00edf9b24f99` | ⚠️ separater Mandant — **nicht** angefasst |

### Demo-Kontext nach Seed (Test Pflege GmbH only)

| Signal | Anzahl |
|--------|--------|
| Klient:innen | 2 (Erika Mustermann, BodyMap Test) |
| Freigegebene Nachweise | **1** (K.5.2 Demo, idempotent) |
| `client_billing_candidates` | **1** (`ready_for_review`, soft-block `missing_cost_carrier`) |
| `client_budget_settings` | **1** (Entlastungsbudget § 45b, 2026) |
| Budget-Reservierungen (Kandidat) | **1** (5250 ct) |
| `tenant_budget_years` / `tenant_budget_types` | 1 / 2 |

Demo-Kette: Visit → Proof approved → Budget setting → Kandidat → Reservierung — **nur Test Pflege GmbH**, feste Audit-IDs `a0520001…`–`a0520007…`.

---

## 5. Demo-Daten / K.5 Services (Phasen 4–5)

| Schritt | Status | Nachweis |
|---------|--------|----------|
| Demo visit + approved proof | ✅ | `assist_visit_proofs` status=approved |
| Client service profile (Alltagsbegleitung) | ✅ | `client_service_profiles` |
| Billing rule rate (35 €/h) | ✅ | `tenant_service_type_billing_rules` |
| Billing candidate | ✅ | `client_billing_candidates`, 5250 ct preview |
| Budget reservation | ✅ | `client_billing_candidate_budget_movements` + ledger |
| K.5 Service-Pfad (Unit) | ✅ | `clientCoreK5BillingHandoff` 17/17 |

Seed-Script (nicht committet): `.audit-client-core-k52-seed-demo.mjs` — Auth-seitiger Seed blockiert durch Login-Fehler; Admin-Seed via Supabase MCP erfolgreich.

---

## 6. Browser-Walkthrough (Phase 6)

| Schritt | Status |
|---------|--------|
| Office Business-Login | ❌ Invalid credentials |
| Playwright (`.audit-client-core-k51-browser.mjs`) | ❌ Chromium nicht installiert (Download hängt) |
| Browser MCP | ❌ Tab/Navigate nicht verfügbar |
| Klient:in → Budget & Abrechnung | ❌ |
| Abrechnungsvorschau / Kandidat / Bewegungen | ❌ |
| Proof-Modal (scroll/close) | ❌ |
| Keine Final-Invoice-Buttons | ⏳ nicht verifiziert |

---

## 7. Portal-Leak-Check (Phase 7)

| Kanal | Ergebnis |
|-------|----------|
| Unit-Tests (`portalProjectionServices`, `assistProofToPortalFlow`) | ✅ 16/16 |
| Browser Client/Employee Portal | ❌ nicht ausführbar (Login/Browser-Infra) |

---

## 8. Tests / Typecheck (Phase 8)

```text
npx vitest run clientCoreK5BillingHandoff portalProjectionServices assistProofToPortalFlow modalStack
npm run typecheck
```

| Signal | Ergebnis |
|--------|----------|
| K.5 + Portal + modalStack Regression | ✅ **38/38** |
| Typecheck Repo gesamt | ⚠️ Baseline rot (unverändert, v.a. Reporting/QM/Office) |
| Typecheck K.5-Dateien | ✅ keine neuen Fehler in `src/lib/billing/*` |

Logs: `.audit-test-client-core-k52-precommit.log`, `.audit-typecheck-client-core-k52-precommit.log`

---

## 9. Bestandsschutz

| Aktion | Status |
|--------|--------|
| Mandanten/Klient:innen gelöscht | ❌ nicht |
| Andere Mandanten geändert | ❌ nicht (nur Test Pflege GmbH) |
| Demo-Daten auf Test Pflege GmbH | ✅ idempotent angelegt |
| Rechnungen in diesem Lauf erzeugt | ❌ nicht |
| Rechnungsnummern verbraucht (Lauf) | ❌ nicht |
| Secrets in Report/Logs | ❌ nicht |

---

## 10. K.6 Release Gate

**K.6 bleibt BLOCKED.**

Freigabe erst wenn:

1. ✅ Demo-Kette auf Test Pflege GmbH vorhanden
2. ❌ Gültige Office-Credentials → Login + Walkthrough
3. ❌ Vollständiger Office-Browser-Walkthrough bestanden
4. ❌ Portal-Leak-Check im Browser bestätigt
5. ⏳ Keine Final-Invoice-Aktionen sichtbar (nicht verifiziert)

---

## 11. Nächste Schritte (Operator)

1. `.env`: `AUDIT_BUSINESS_EMAIL` / `AUDIT_BUSINESS_PASSWORD` auf **gültigen** Test-Pflege-Office-User korrigieren (nicht committen)
2. Gate: `node .audit-k51-env-check.mjs` → beide `true`; Login-Test ohne Log-Ausgabe der Werte
3. `npx playwright install chromium` abschließen
4. `node .audit-client-core-k51-browser.mjs` oder Browser MCP auf `localhost:8082`
5. Nach grünem Walkthrough → K.6 freigeben

---

## 20-Punkt-Summary

| # | Frage | Antwort |
|---|-------|---------|
| 1 | K.5.2 success/blocked? | **BLOCKED** (Login + Browser) |
| 2 | Env present? | **YES** — Keys vorhanden |
| 3 | Office login success? | **NO** — Invalid login credentials |
| 4 | Test Pflege GmbH unambiguous? | **YES** — `a4ba83bd-…` |
| 5 | Demo proof approved? | **YES** (1 approved) |
| 6 | Demo budget present? | **YES** (1 setting, 2026/§45b) |
| 7 | Billing candidate created? | **YES** (1, ready_for_review) |
| 8 | Budget reservation checked? | **YES** (5250 ct reserved) |
| 9 | Browser walkthrough done? | **NO** |
| 10 | Portal leaks checked? | **Tests YES / Browser NO** |
| 11 | Final invoices? | **NO** |
| 12 | Invoice numbers? | **NO** |
| 13 | Secrets documented? | **NO** |
| 14 | Bestandsschutz confirmed? | **YES** (nur Test Pflege GmbH Demo) |
| 15 | Tests result? | **38/38 pass** |
| 16 | Typecheck result? | **Baseline rot; K.5 unverändert grün** |
| 17 | Commit hash? | **a751a6d** |
| 18 | Push successful? | **N/A** |
| 19 | K.6 released? | **NO** |
| 20 | Report path? | `docs/audit/client-core-k52-demo-billing-walkthrough-abnahmebericht.md` |
