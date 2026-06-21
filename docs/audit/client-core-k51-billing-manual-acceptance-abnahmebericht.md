# Client Core K.5.1 — Billing Manual Acceptance Abnahmebericht

**Datum:** 2026-06-21  
**Branch:** `main` · **HEAD:** `1fc854b`  
**Supabase Project:** `euagyyztvmemuaiumvxm`  
**Scope:** Sichtbare Abnahme K.5 Billing-Handoff (Preview, Kandidaten, Budget, Sperrgründe, Portal-Leaks). **Keine** finale Rechnung, **kein** K.6.

---

## 1. Executive Summary

| Kriterium | Status |
|-----------|--------|
| K.5.1 Master (sichtbar) | ⛔ **PARTIAL — BLOCKED** |
| K.6 freigegeben | ❌ **NEIN** |
| Code + Regression (K.5) | ✅ 33/33 |
| Migration 0160 remote | ✅ applied |
| Interne Texte (K.5 UI) | ✅ bereinigt (dieser Lauf) |
| Demo-Abrechnungsdaten | ❌ fehlen (0 Proofs/Kandidaten) |
| Browser-Abnahme | ❌ nicht ausführbar (s. §4) |

**Ergebnis:** K.5 Code-Gate bleibt grün; **K.5.1 sichtbares Gate nicht bestanden** — K.6 blockiert bis Operator Demo-Nachweise + Business-Login + vollständiger UI-Walkthrough.

---

## 2. Git / Abort-Gates (Phase 1)

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ✅ |
| HEAD enthält `1fc854b` | ✅ |
| Sync `origin/main` | ✅ |
| Staged at start | ✅ leer |
| 0154–0160 modified | ✅ nein |
| `staticRolePermissions` modified | ✅ nein |
| Finale Rechnungen erzeugt (Lauf) | ✅ nein |
| Produktive Budget-/Proof-Änderungen | ✅ nein |

Log: `.audit-migration-list-client-core-k51-precheck.log`

---

## 3. Handoff-Matrix (K.5 + U.1.2 + Portal)

| Bereich | Quelle | K.5.1 Prüfpunkt | Code | Sichtbar |
|---------|--------|-----------------|------|----------|
| Billing Candidates | 0160 + `clientBillingCandidateService` | Kandidaten aus Proofs | ✅ | ⏳ leer (keine Proofs) |
| Blocking Reasons | `BILLING_BLOCKING_REASON_LABELS` | Deutsche Labels | ✅ | ⏳ nicht prüfbar ohne Daten |
| Budget Ledger | 0159 + `clientBudgetConsumptionService` | Reservierung/Vorschau | ✅ | ⏳ leer |
| Akte UI | `ClientBillingPrepPanel` in `ClientBudgetCorePanel` | Vorschau sichtbar | ✅ | ⏳ Empty-State erwartet |
| Nachweise Tab | `ClientProofBillingStatusPanel` | Status + Sperrgründe | ✅ | ⏳ |
| Office | `app/office/billing-preparation.tsx` | Keine Final-Invoice-Actions | ✅ | ⏳ |
| Mandant | `client-service-types.tsx` | Abrechnungsregeln | ✅ | ⏳ |
| Portal | `portalVisibilityService` | Kein Billing-Leak | ✅ (Tests) | ⏳ Login-Seiten nicht gerendert |
| Modal Scroll | U.1.2 `PlatformModal` | Scroll/Close | ✅ (U.1.2 manuell) | ⏳ Billing-Modals ohne Daten |

Referenzen: `client-core-k5-budget-billing-handoff-abschlussbericht.md`, `visible-ui-u12-modal-scroll-assist-card-fix-abnahmebericht.md`, `portal-system-p51-real-login-abnahmebericht.md`

---

## 4. Demo-Kontext (Supabase read-only)

**Test Pflege GmbH** (`a4ba83bd-…`):

| Signal | Anzahl |
|--------|--------|
| Klient:innen | 2 (Erika Mustermann, BodyMap Test) |
| Freigegebene Nachweise | 0 |
| `assist_visits` gesamt | 0 |
| `client_budget_settings` | 0 |
| `client_billing_candidates` | 0 |
| K.5 Budgetbewegungen | 0 |

**Folge:** Vorschau/Kandidaten/Reservierung können in der UI nur als Empty-State erscheinen — kein End-to-End-Demo-Flow ohne Assist-Nachweise + Budget-Vorlage.

---

## 5. Browser / UI Acceptance (Phase 4)

| Kanal | Ergebnis |
|-------|----------|
| Browser MCP | ❌ Kein Tab verfügbar (`browser_navigate` / `browser_tabs` leer) |
| Playwright (`.audit-client-core-k51-browser.mjs`) | ❌ Chromium nicht installierbar (Sandbox-Cache / Dir-Lock) |
| `.env` Business-Credentials | ❌ Kein `AUDIT_BUSINESS_EMAIL` / `TEST_BUSINESS_EMAIL` gesetzt |
| Expo Web | ✅ läuft auf `localhost:8082` |

Ergebnis-JSON: `.audit-client-core-k51-browser-results.json`

**Operator-Checkliste (noch offen):**

1. Business-Login (Office) — Credentials in `.env` als `AUDIT_BUSINESS_EMAIL` / `AUDIT_BUSINESS_PASSWORD`
2. Klient:in Erika Mustermann → Tab Budget & Abrechnung → „Abrechnungsvorschau“
3. Mind. 1 freigegebener Assist-Nachweis → „Vorschau aktualisieren“ → Kandidat sichtbar
4. Budget aus Mandanten-Vorlage → „Budget reservieren“ (Demo)
5. `/office/billing-preparation` — keine Final-Invoice-Buttons
6. Portal Client/Employee — keine Billing-Keys
7. Modals scrollen + schließen

---

## 6. K.5.1 UI-Fixes (dieser Lauf)

| Datei | Änderung |
|-------|----------|
| `ClientBillingPrepPanel.tsx` | Subtitle ohne „K.5“ |
| `billing-preparation.tsx` | Keine K.5/K.6-Referenzen in Mandanten-Text |
| `client-service-types.tsx` | Titel/Empty-State ohne Migrations-Jargon |
| `ClientBudgetCorePanel.tsx` | Budgetbewegungen mit deutschen Labels (`CLIENT_BUDGET_MOVEMENT_LABELS`) |
| `clientCore.ts` | Label-Map für Bewegungstypen |

Blocking-Reason-Keys (`proof_not_approved`, `missing_budget_setting`, …) waren bereits über `BILLING_BLOCKING_REASON_LABELS` gemappt.

---

## 7. Tests / Typecheck

```text
npx vitest run clientCoreK5BillingHandoff portalProjectionServices assistProofToPortalFlow
npm run typecheck
```

| Signal | Ergebnis |
|--------|----------|
| K.5 + Portal Regression | ✅ **33/33** |
| Typecheck K.5-Dateien | ✅ keine neuen Fehler in geänderten Dateien |
| Typecheck Repo gesamt | ⚠️ Baseline rot (unverändert, v.a. Reporting/QM) |

Logs: `.audit-test-client-core-k51-precommit.log`, `.audit-typecheck-client-core-k51-precommit.log`

---

## 8. Bestandsschutz

| Aktion | Status |
|--------|--------|
| Mandanten/Klient:innen gelöscht | ❌ nicht |
| Nachweise/Budgets produktiv geändert | ❌ nicht |
| Rechnungen in diesem Lauf erzeugt | ❌ nicht |
| Rechnungsnummern verbraucht (Lauf) | ❌ nicht |
| Remote `invoices` Count | 1 (Bestand, nicht durch K.5.1) |

---

## 9. K.6 Release Gate

**K.6 bleibt BLOCKED.**

Freigabe erst wenn:

- Sichtbarer Walkthrough mit Demo-Daten (Proof → Kandidat → Vorschau → Reservierung)
- Keine internen Keys in Mandanten-UI
- Keine Final-Invoice-Aktionen sichtbar

---

## 10. Nächste Schritte (Operator)

1. `.env`: `AUDIT_BUSINESS_EMAIL` + `AUDIT_BUSINESS_PASSWORD` setzen
2. Test Pflege GmbH: Assist-Einsatz + Nachweis freigeben (Demo)
3. Budget-Vorlage 2026 + Klient:innen-Budget initialisieren
4. `node .audit-client-core-k51-browser.mjs` nach `npx playwright install chromium`
5. K.5.1 Re-Run oder manuelle Abnahme bestätigen → dann K.6

---

## 18-Punkt-Summary

| # | Frage | Antwort |
|---|-------|---------|
| 1 | K.5.1 success/blocked? | **PARTIAL / BLOCKED** (sichtbar) |
| 2 | Browser/UI acceptance done? | **NO** (MCP + Playwright + Credentials) |
| 3 | Demo data present? | **NO** (0 Proofs, 0 Kandidaten) |
| 4 | Billing preview visible? | **Not verified** (Empty-State erwartet) |
| 5 | Candidates visible? | **NO** (keine Daten) |
| 6 | Budget reservation checked? | **NO** |
| 7 | Blocking reasons checked? | **Code yes / UI not verified** |
| 8 | Internal texts removed? | **YES** (K.5 UI fixes) |
| 9 | Portal leaks checked? | **Tests yes / Browser NO** |
| 10 | Final invoices created? | **NO** |
| 11 | Invoice numbers consumed? | **NO** (Lauf) |
| 12 | Bestandsschutz confirmed? | **YES** |
| 13 | Tests result? | **33/33 pass** |
| 14 | Typecheck result? | **Baseline rot; K.5-Änderungen clean** |
| 15 | Commit hash? | *(nach Commit)* |
| 16 | Push successful? | *(nach Push)* |
| 17 | K.6 released? | **NO** |
| 18 | Report path? | `docs/audit/client-core-k51-billing-manual-acceptance-abnahmebericht.md` |
