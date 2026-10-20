# CareSuite+ — Abrechnung (Arbeitspaket 016)

## Ziel

Demo-Budgets und Rechnungsliste im Office-Modul.

## Route

`/office/invoices` — `InvoicesListScreen`

## Service

```typescript
import { fetchInvoiceList, fetchBudgetSummary, formatCurrency } from '@/lib/office';
import { useInvoiceList } from '@/hooks/useInvoiceList';
```

## Demo-Daten

- `src/data/demo/invoices.ts` — 6 Rechnungen (bestehend)
- `src/data/demo/budgets.ts` — 4 Klient:innen-Budgets

## Berechtigung

Neue Permission `office.invoices.view` — für alle Office-Rollen freigegeben.

## Features

Suche, Statusfilter, Sortierung, Pagination — analog zur Klient:innen-Liste.
