# CareSuite+ Preise & Pakete

**Stand:** 13.06.2026  
**Modell:** SaaS-Abonnement, monatliche Nettopreise in EUR, Demo-Warenkorb ohne Stripe.

---

## 1. Modulpreise (netto/Monat)

| Modul | Preis | Hinweis |
| ----- | ----- | ------- |
| CareSuite+ Office | 79 € | Standalone „Office Solo“ |
| CareSuite+ Assist | 149 € | inkl. Office |
| CareSuite+ Pflege | 229 € | einzeln; Paket „Pflege Pro“ 299 € |
| CareSuite+ Beratung | 129 € | |
| CareSuite+ Akademie | 129 € | |
| CareSuite+ Stationär | 299 € | |
| TI-ready (Add-on) | 49 € | Integrations-Add-on, kein Fachmodul |

Implementierung: `src/lib/billing/pricingCatalog.ts` → `MODULE_PRICES`, `ADD_ONS`.

---

## 2. Öffentliche Pakete (Marktstart)

| Paket | Preis | Module |
| ----- | ----- | ------ |
| Office Solo | 79 € | Office |
| Assist | 149 € | Assist + Office inklusive |
| Pflege Pro | 299 € | Office + Assist + Pflege |
| Management | 399 € | Office + Assist + Pflege + Beratung + Akademie |
| Enterprise | auf Anfrage | alle Module |

UI: `SubscriptionScreen`, Onboarding `CompanySetupScreen`.

---

## 3. Interner Katalog (Bundles)

| Bundle | Preis | Entspricht |
| ------ | ----- | ---------- |
| Starter | 79 € | Office Solo |
| Betreuung | 149 € | Assist |
| Pflege Pro | 299 € | Pflege Pro |
| Management | 399 € | Management |
| Enterprise | ab 599 € | Vollpaket (Vertrieb) |

`PACKAGE_CATALOG` enthält `label` (intern) und `publicLabel` (Markt).

---

## 4. Abrechnungsregeln

1. **Office allein** → 79 € billable (`access_source: purchased`).
2. **Fachmodul gebucht** → Office `included_base`, **nicht** doppelt berechnet.
3. **Office + Fachmodul** (Office zuvor gekauft) → beide billable (Bestandskunden).
4. **Paketwahl** → Paketpreis statt Summe der Einzelmodule.
5. **Manuelle Modulauswahl** → Summe Fachmodule + Office inklusive.

Kernfunktionen:

- `calculateCartTotal(selectedModules, options)` — Warenkorb
- `calculateBillingItems(tenantId)` — Mandanten-Modulstatus ohne Doppelabrechnung
- `calculateTenantCartPreview(tenantId)` — Preise für aktive Module

---

## 5. Promo, Testphase, Intervall

| Angebot | Regel |
| ------- | ----- |
| Testphase | 14 Tage kostenlos (`TRIAL_DAYS`) |
| Jährlich | 2 Monate gratis → 10 Monate zahlen |
| Promo ISR10050 | 50 % Rabatt für 6 Monate (Demo-Store) |
| Einrichtung | Keine Setup-Gebühr im Startangebot |

---

## 6. Nutzer-Tiers (optional)

| Nutzer | Aufschlag/Monat |
| ------ | --------------- |
| 1–5 | inklusive |
| 6–15 | +29 € |
| 16–30 | +59 € |
| 31–50 | +99 € |

`USER_TIER_SURCHARGES` in `pricingCatalog.ts`.

---

## 7. Demo & Stripe

- Keine Stripe-Integration — nur Warenkorb-Mathematik und UI-Vorschau.
- Paketfreischaltung Demo: `activateDemoPackage()` → `activatePurchasedModule()`.
- Promo-Codes: `DEMO_PROMO_CODES` in `pricingCatalog.ts`.

---

## 8. Tests

`src/__tests__/billing/pricingModel.test.ts` — Office solo, Assist, Assist+Pflege, Pakete, Promo, Annual, included_base.
