# Abnahmebericht — Klientenakte Pflegegrad & Budgets (Phase 2)

**Datum:** 2026-06-29  
**Scope:** Phase 2 — funktionale Modals, Business-Logik, Mobile-Ansicht, Tests  
**Basis-Commit:** `5914e46e` (lokal, unpushed)  
**Deploy:** Nein — kein `[deploy]`, kein Push

---

## Ergebnis

| Bereich | Status | Anmerkung |
|---------|--------|-----------|
| Pflegegrad bearbeiten | ✅ | Modal + Service `changeClientCareGrade` |
| Pflegekasse bearbeiten | ✅ | Modal + Service `updateClientCareFund` |
| Bescheid gültig ab | ✅ | Modal + Service `updateCareEntitlementValidFrom` |
| Umwandlung §45a Toggle | ✅ | Modal + Service `setClientConversionEnabled` |
| Budgetmodus VP/Kurzzeit | ✅ | Bestehend `BudgetModeSwitch` (Audit-Pflicht) |
| Budget bearbeiten | ✅ | Bestehend `BudgetAccountEditModal` |
| Korrektur buchen | ✅ | Modal + `bookBudgetCorrection` (adjustment-TX) |
| Budgetkonto neu berechnen | ✅ | Modal mit Diff-Vorschau + `applyBudgetRecalculation` |
| Budget deaktivieren | ✅ | Modal + `deactivateClientBudgetAccount` (Switch → Modal) |
| Business-Logik | ✅ | Historie erhalten, Reservierungs-Check, Audit |
| Mobile Budget-Karten | ✅ | `<768px` Card-Liste statt Tabelle |
| Unit-Tests | ✅ | 10/10 Konsolidierung + 35/35 Billing |
| E2E Browser | ⏭️ | Browser MCP nicht verfügbar; Production ohne lokalen Stand |

**Freigabefähig:** Ja (Code + Tests)  
**Deployfähig:** Nein (bewusst — Phase 2 erst nach manueller Browser-Abnahme deployen)

---

## Geänderte / neue Dateien

| Datei | Änderung |
|-------|----------|
| `src/lib/assist/clientCareGradeBudgetsService.ts` | **Neu** — PG/Pflegekasse/Datum/Umwandlung/Korrektur/Neuberechnung/Deaktivierung |
| `src/lib/assist/clientCareGradeBudgetsViewModel.ts` | Validierung, PG-Optionen, Recalc-Helper |
| `src/components/office/ClientCareGradeBudgetsModals.tsx` | **Neu** — 7 Modals (PG, Kasse, Datum, Umwandlung, Korrektur, Recalc, Deaktivieren) |
| `src/components/office/ClientCareGradeBudgetsPanel.tsx` | Aktions-Buttons, Modal-Wiring, Korrektur/Recalc-Toolbar |
| `src/components/office/ClientBudgetAccountsGrid.tsx` | Mobile Card-Liste, Deaktivieren-Modal via Switch |
| `src/__tests__/assist/clientCareGradeBudgetsConsolidation.test.ts` | +5 Tests Phase 2 |

**Unverändert genutzt:**

- `getClientAssistBillingProfile`, `clientBudgetAccountService`, `clientBudgetTransactionService`
- `BudgetModeSwitch`, `BudgetAccountEditModal`
- `client_billing_audit_log` für alle Mutationen

---

## Modals & Datenfluss

```
ClientCareGradeBudgetsPanel
  ├─ Pflegegrad-Sektion
  │    ├─ EditCareGradeModal → changeClientCareGrade
  │    │     → client_care_entitlement (close + insert)
  │    │     → client_care_levels + clients (Legacy-Sync)
  │    │     → ensureClientBudgetAccountsForDate (ab Änderungsdatum)
  │    │     → client_billing_audit_log
  │    ├─ EditCareFundModal → updateClientCareFund
  │    ├─ EditValidFromModal → updateCareEntitlementValidFrom
  │    └─ ConversionToggleModal → setClientConversionEnabled
  │          → Umwandlungskonten sperren/entsperren, Katalog-Konten erzeugen
  ├─ Budgetmodus → BudgetModeSwitch (bestehend)
  ├─ Budgets → BudgetAccountsEditableGrid
  │    ├─ Desktop: PremiumDataTable
  │    ├─ Mobile: PremiumCard-Liste (<768px)
  │    ├─ BudgetAccountEditModal (bestehend)
  │    └─ BudgetDeactivateModal (Switch off)
  ├─ Korrektur buchen → BudgetCorrectionModal → bookBudgetCorrection
  │     → client_budget_transactions (adjustment) + allocated_cents
  └─ Neu berechnen → BudgetRecalcModal
        → computeBudgetRecalculationDiffs (Vorschau)
        → applyBudgetRecalculation (nach Bestätigung)
```

### Business-Regeln (implementiert)

1. **Pflegegrad-Wechsel:** Schließt alten Entitlement-Eintrag (`valid_until`), legt neuen an; **keine** Löschung historischer Budgetbewegungen.
2. **Neue Budgetwerte** ab Änderungsdatum via `ensureClientBudgetAccountsForDate`.
3. **Offene Reservierungen** blockieren PG-Wechsel (`countOpenBudgetReservations`).
4. **Jede Änderung** → `client_billing_audit_log`.
5. **Umwandlung aus:** Historische §45a-Bewegungen bleiben; Umwandlungskonten gesperrt; `conversionEnabled=false`.
6. **Umwandlung an:** Monatliche Konten aus Katalog 2026.
7. **Anspruchsübersicht:** `hasAnspruchsData` — nie leer wenn Budgetkonten/Vorlagen existieren.

---

## Mobile-Akzeptanz

| Viewport | Verhalten |
|----------|-----------|
| Desktop (≥768px) | Horizontale `PremiumDataTable` mit allen Spalten |
| Mobile (<768px) | Card-Liste: Name, Zeitraum, Zugewiesen, Reserviert, Verbraucht, Verfügbar, Status, Switch + Bearbeiten |
| Tablet | Tabelle mit horizontalem Scroll (bestehend) |

Implementierung: `useWindowDimensions()` + Breakpoint 768px in `ClientBudgetAccountsGrid`.

---

## Testergebnisse

```
clientCareGradeBudgetsConsolidation.test.ts  10/10 ✅
clientAssistBilling.test.ts                  35/35 ✅
```

Neue Phase-2-Tests:

- Korrektur-Formularvalidierung (+/- Betrag, Pflichtfelder)
- Recalc-Diffs (Individual-Override skip, Umwandlung bei conversion off)
- `hasRecalculationChanges`

---

## E2E Browser

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Browser MCP Tab öffnen | ❌ Nicht verfügbar („No browser tab available“) |
| localhost:8081 | Port belegt, kein automatisierter Zugriff |
| caresuiteplus.app | Nicht getestet — Production hat weder `5914e46e` noch Phase 2 |

**Empfehlung:** Nach lokalem `npx expo start --web` manuell oder per Browser-Automation:

1. Klient öffnen → Tab „Pflegegrad & Budgets“ (kein Duplikat-Tab)
2. PG bearbeiten, Umwandlung togglen, Budgetmodus wechseln
3. Korrektur buchen, Neu berechnen (Diff bestätigen)
4. Budgetverlauf prüfen
5. Mobile Viewport 375px — Card-Liste sichtbar

---

## Verbleibende Punkte

| Punkt | Priorität |
|-------|-----------|
| Manueller Browser-E2E nach lokalem Start | Hoch (vor Deploy) |
| Production-Deploy mit `[deploy]` | Nach User-Freigabe |
| `ClientBudgetCorePanel` (K.4) | Parallel unter `leistungsbereiche` — unverändert |

---

## Commits

| Commit | Message |
|--------|---------|
| `5914e46e` | Phase 1 Konsolidierung (unpushed) |
| *(lokal)* | `feat klientenakte pflegegrad budgets phase 2 modals mobile e2e` |

**Kein Push. Kein Deploy.**
