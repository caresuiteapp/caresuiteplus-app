# Abnahmebericht — Klient:innenakte Budget-Korrektur 2026 (Umwandlung monatlich)

**Datum:** 2026-06-25  
**Projekt:** CareSuite+ (`euagyyztvmemuaiumvxm`)  
**Scope:** Migration 0180, Services, Budget-Tab UI, Einsatz-Budget-Panel, Tests 1–23

---

## Root Cause

**Warum zeigte die UI „Umwandlung PG2 — jährlich“?**

Migration **0175** seedete `budget_template_catalog` für `umwandlung_pg2`–`umwandlung_pg5` mit `period = 'yearly'` und der Beschreibung „Jährlicher Umwandlungsanspruch“. Die UI (`ClientAssistBillingPanels`, `AssignmentBillingBudgetPanel`) rendert den Zeitraum **direkt aus dem Katalog/Profil** (`t.period` / `a.period`) — kein hardcodierter UI-String.

Datenfluss:

```
0175 Seed (period: yearly)
  → budget_template_catalog
  → ensureClientBudgetAccountsForDate (kopiert template.period)
  → client_budget_accounts.period = yearly
  → getClientAssistBillingProfile → UI: „jährlich“
```

**Korrektur:** Datenquelle (Katalog + bestehende Klientenkonten) auf `monthly` umgestellt; Label-Helfer erzwingt für `umwandlung_*` immer „monatlich“ als Defense-in-Depth.

---

## Ergebnis

| Phase | Status | Anmerkung |
|-------|--------|-----------|
| A — Migration 0180 | ✅ Angewendet | Remote via Supabase MCP |
| B — Services | ✅ | Period-Labels, CRUD, Budget-Modus, Audit |
| C — Budget-Tab UI | ✅ | Editable Grid, Modal, Modus-Switch, Banner |
| D — Einsatz-Panel | ✅ | Monatliche Umwandlung, Modus-Warnungen |
| E — Tests | ✅ 54/54 | clientAssistBilling + assignmentBudgetAllocation |
| F — Abnahmebericht | ✅ | Dieses Dokument |

---

## Migration angewendet?

**Ja** — `0180_budget_catalog_umwandlung_monthly_fix` auf `euagyyztvmemuaiumvxm`.

Verifikation (Live):

```sql
SELECT catalog_key, period, default_amount_cents
FROM budget_template_catalog
WHERE budget_year = 2026 AND catalog_key LIKE 'umwandlung_%';
-- Erwartung: period = monthly, PG2 31800, PG3 59800, PG4 74300, PG5 91900
```

Neue Strukturen:

- `client_budget_mode` (VP/Kurzzeit vs. gemeinsames Jahresbudget)
- `client_budget_accounts`: `standard_amount_cents`, `locked`, `lock_reason`, `is_enabled`

---

## Geänderte Dateien

### Migration
- `supabase/migrations/0180_budget_catalog_umwandlung_monthly_fix.sql`

### Types & Services
- `src/types/assist/clientAssistBilling.ts` — `ClientBudgetMode`, erweiterte `ClientBudgetAccount`, `carePreventionMode` auf Profil
- `src/lib/assist/budgetPeriodLabels.ts` **neu**
- `src/lib/assist/budgetTemplateCatalogService.ts` — Period-Label-Re-Exports
- `src/lib/assist/clientBudgetAccountService.ts` — `getClientBudgetAccounts`, `updateClientBudgetAccount`, `setClientBudgetEnabled`, `setClientCarePreventionBudgetMode`, `recalculateClientBudgetAvailability`
- `src/lib/assist/clientAssistBillingMappers.ts` — neue Spalten + `mapBudgetModeRow`
- `src/lib/assist/clientAssistBillingProfileService.ts` — lädt Budget-Modus
- `src/lib/assist/clientBudgetTransactionService.ts` — `isEnabled`/`locked` in `canUse`
- `src/lib/assist/calculateAssistBudgetAllocation.ts` — respektiert gesperrte/deaktivierte Konten

### UI
- `src/components/office/ClientBudgetAccountsGrid.tsx` **neu** — Grid, Edit-Modal, Modus-Switch, Info-Banner
- `src/components/office/ClientAssistBillingPanels.tsx` — Budget-Tab Overhaul
- `src/components/assist/AssignmentBillingBudgetPanel.tsx` — monatliche Umwandlung, Modus-Hinweise

### Tests
- `src/__tests__/assist/clientAssistBilling.test.ts` — Umwandlung monthly + Test 23 Period-Labels
- `src/__tests__/assist/assignmentBudgetAllocation.test.ts` — erweiterte Account-Felder

---

## Verify-Checkliste

- [x] Katalog: `umwandlung_pg2`–`pg5` → `period = monthly`, Cent-Werte korrekt
- [x] Bestehende `client_budget_accounts` mit `umwandlung_*` → `period = monthly`, Monatsgrenzen
- [x] UI Budget-Tab: Spalten Aktiv, Budget, Zeitraum, Standard, Individuell, Zugewiesen, Reserviert, Verbraucht, Verfügbar, Automatik, Status, Aktionen
- [x] Edit-Modal für individuelle Beträge
- [x] Budget-Modus-Switch mit Pflichtbegründung + Audit
- [x] „Geltende Vorlagen 2026“ zeigt „monatlich“ für Umwandlung
- [x] Einsatz-Budget-Panel: monatliche Umwandlung, keine „Jährlich“-Anzeige
- [x] Tests grün: `npx vitest run src/__tests__/assist/clientAssistBilling.test.ts src/__tests__/assist/assignmentBudgetAllocation.test.ts`

---

## Tests

```
Test Files  2 passed (2)
Tests       54 passed (54)
```

---

## Abnahme-Empfehlung

**Abnahmefähig** für Pilotierung. Nach Deploy: Klient:innen mit bestehenden Umwandlungskonten in der App öffnen (Budget-Tab) und Zeitraum „Monatlich“ verifizieren.
