# CareSuite+ — Office Abrechnung (WP 221–240)

## Status: Abgeschlossen

## Umsetzung

| Feature | Route / Screen |
|---------|----------------|
| Abrechnungs-Hub mit KPIs | `/office/invoices` → `OfficeBillingScreen` |
| Rechnungsliste | Tab „Rechnungen“ |
| Budgetliste | Tab „Budgets“ |
| Rechnungsdetail + Positionen + Audit | `/office/invoices/[id]` |
| Budgetdetail + Verknüpfung | `/office/budgets/[id]` |
| Statuswechsel Rechnung | `office.invoices.status_change` |

## Services

- `budgetListService.ts`, `budgetDetailService.ts`
- `invoiceDetailService.ts` — erweitert um `updateInvoiceStatus`, Line Items, Audit
- Demo: `invoiceExtras.ts` (mutable Store)

## Berechtigungen

- `office.budgets.view` — alle Office-Rollen
- `office.invoices.status_change` — Admin, Manager, Billing
