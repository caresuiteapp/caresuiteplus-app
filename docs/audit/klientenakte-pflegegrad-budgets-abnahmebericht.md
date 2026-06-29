# Abnahmebericht — Klientenakte Pflegegrad & Budgets (Konsolidierung)

**Datum:** 2026-06-29  
**Scope:** Navigation, konsolidierte Ansicht „Pflegegrad & Budgets“, Anspruchslogik, Tests  
**Branch:** lokal (kein Deploy)

---

## Ergebnis

| Bereich | Status | Anmerkung |
|---------|--------|-----------|
| A — Navigation | ✅ | Ein Tab `pflegegrad_budgets` statt 5 separater Tabs |
| B — Konsolidierte Ansicht (A–F) | ✅ | `ClientCareGradeBudgetsPanel` |
| C — Anspruchsübersicht-Fix | ✅ | Budgetkonten/Vorlagen statt fälschlichem Leerzustand |
| D — Budgettabelle | ✅ | Eine Tabelle, bestehende Modals/Aktionen |
| E — Abrechnungslogik | ✅ | Kompakt, dedupliziert |
| F — Budgetverlauf | ✅ | Integriert mit Filtern |
| G — Deep-Link-Aliase | ✅ | `?tab=budget` etc. → konsolidierter Tab |
| H — Migration | ⏭️ | Nicht nötig (bestehendes Assist-2026-Schema) |
| I — E2E Browser | ⏭️ | Nicht in dieser Session |
| J — Tests | ✅ | 5/5 neue Konsolidierungs-Tests grün; 34/34 Assist-Billing unverändert grün |

---

## Geänderte / neue Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/office/ClientCareGradeBudgetsPanel.tsx` | **Neu** — Hauptansicht Sektionen A–F |
| `src/lib/assist/clientCareGradeBudgetsViewModel.ts` | **Neu** — Anspruchsableitung, kompakte Abrechnungslogik, Tab-Aliase |
| `src/lib/clients/clientIntakeFieldRules.ts` | Tab-Key `pflegegrad_budgets`, Navigation normalisiert, `resolveClientRecordTabKey` |
| `src/screens/business/office/ClientRecordTabPanels.tsx` | Routing aller Budget-Tabs → konsolidiertes Panel |
| `src/screens/business/office/ClientRecordScreen.tsx` | Deep-Link-Alias-Auflösung |
| `src/__tests__/assist/clientCareGradeBudgetsConsolidation.test.ts` | **Neu** — Navigation, Anspruch, Abrechnungslogik |

**Unverändert genutzt (kein Rewrite):**

- `getClientAssistBillingProfile` — zentrale Datenquelle
- `BudgetAccountsEditableGrid`, `BudgetModeSwitch`, `BudgetAccountEditModal`
- `clientBudgetAccountService`, `clientBudgetTransactionService`
- Einsatz-Reservierung / Nachweis-Verbrauch (bestehende Lifecycle-Services)

---

## Sektionen der konsolidierten Ansicht

| Sektion | Inhalt | Status |
|---------|--------|--------|
| **A** Pflegegrad-Statuskarte | PG, Gültigkeit, Kostenträger, Umwandlung-Badge | ✅ |
| **B** Anspruchsübersicht | Leistungen → Budgetkonten → Vorlagen (Fallback-Kette) | ✅ |
| **C** Budgetmodus VP/Kurzzeit | `BudgetModeSwitch` + Audit-Modal mit Pflichtbegründung | ✅ |
| **D** Budgettabelle | `PremiumDataTable`, Bearbeiten, Aktiv-Toggle, Generate | ✅ |
| **E** Abrechnungslogik | Prioritätsliste (dedupliziert), Links Einsätze/Nachweise/Rechnungen | ✅ |
| **F** Budgetverlauf | Filterchips, Bewegungsdetails inkl. Referenz | ✅ |
| Warnungen | Inline statt eigener Tab | ✅ |

---

## Behobene Probleme

1. **Fünf parallele Tabs** → **ein Tab** „Pflegegrad & Budgets“
2. **Doppelte Budgettabelle** → **eine Tabelle**
3. **„Keine Leistungsansprüche“ trotz Budgetkonten** → Anzeige aus Budgetkonten oder Katalog-Vorlagen
4. **Rohe PG2–PG5-Prioritätsliste** → kompakte deduplizierte Verbrauchsreihenfolge
5. **Legacy-Deep-Links** funktionieren weiter

---

## Bewusste Lücken / Folge-Phasen

| Bereich | Gap |
|---------|-----|
| Pflegegrad bearbeiten (eigenes Modal) | Weiterhin über Stammdaten-Modal / Aufnahme |
| Umwandlung-Toggle (eigenes Modal) | Badge sichtbar; dediziertes Toggle-Modal noch nicht extrahiert |
| Korrektur / Neuberechnung / Deaktivieren | Teilweise über Budget-Bearbeiten + Aktiv-Switch |
| Client Core K.4 (`ClientBudgetCorePanel`) | Parallel unter verstecktem Tab `leistungsbereiche` |
| E2E Browser-Test | Ausstehend |

---

## Testergebnisse

```
clientCareGradeBudgetsConsolidation.test.ts  5/5 ✅
clientAssistBilling.test.ts                 34/34 ✅
```

---

## Deploy

**Nicht deployed** — kein `[deploy]`, kein Push.
