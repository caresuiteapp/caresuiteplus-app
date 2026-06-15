# MEGA Masterprompt v2 — Sprint 85 Report

**Datum:** 2026-06-14  
**Scope:** Office Klient:innen / Rechnung / Budget Detail Premium Heroes  
**Verdict:** ClientDetailHero + InvoiceDetailHero + BudgetDetailHero — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 85 schloss die **CareSuite+ Office Detail-Lücken** (flache `PremiumCard`-Header):

- `/office/clients/[id]` — digitale Klient:innen-Akte ohne Hero
- `/office/invoices/[id]` — Rechnungsdetail nur Betrag-Badge
- `/office/budgets/[id]` — Budgetdetail nur Auslastungs-Card

InsightCenter übersprungen (keine Screens). Portal-Detail-Heroes bereits in Sprint 80–83.

---

## 2. Implementiert

| Artefakt | Änderung |
|----------|----------|
| `ClientDetailHero.tsx` | PremiumListHeroFrame, Kontext-KPIs (Dokumente, Termine, Rechnungen, Einsätze) |
| `clientDetailStats.ts` | `buildClientDetailKpis`, `ClientDetailHeroInput` |
| `InvoiceDetailHero.tsx` | Betrag/Fällig/Rechnungsdatum/Audit-KPIs, `DATEV preparedOnly`-Badge |
| `invoiceDetailStats.ts` | `buildInvoiceDetailKpis` |
| `BudgetDetailHero.tsx` | Auslastung/Verbraucht/Verbleibend/Rechnungen-KPIs, Limit-Badge |
| `budgetDetailStats.ts` | `buildBudgetDetailKpis` |
| `ClientDetailScreen.tsx` | Hero ersetzt flaches Header-Card |
| `InvoiceDetailScreen.tsx` | Hero ersetzt PremiumCard |
| `BudgetDetailScreen.tsx` | Hero ersetzt PremiumCard |
| `officeDetailHeroes.test.ts` | +7 Tests |

---

## 3. Quality Gates (Sprint 85)

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **922** passed (+7 Sprint 85) |
| `npm run smoke` | ✅ 259 routes |
| `npm run platform:audit` | ✅ PASS |
| `npm run store:audit` | ✅ PASS (3 erwartete Warnungen) |

---

## 4. Verdict

Office Klient:innen-Akte, Rechnungs- und Budget-Detail premium — konsistent mit EmployeeDetailHero (Sprint 69) und AppointmentDetailHero (Sprint 82). DATEV-Export bleibt preparedOnly.
