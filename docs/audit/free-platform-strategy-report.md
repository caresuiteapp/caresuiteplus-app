# CareSuite+ Free Platform Strategy — Audit Report

**Datum:** 2026-06-14  
**Verdict:** CareSuite+ Free Platform Strategy wurde umgesetzt — alle Organisationen starten kostenlos (0 €), CareSuite+ Office immer aktiv, Hauptmodule frei aktivierbar, Premium nur preparedOnly.

---

## A. Produktentscheidung

| Aspekt | Umsetzung |
|--------|-----------|
| 0 € monatlich | `FREE_PLATFORM_MONTHLY_EUR = 0`, Migration `price_cents = 0` |
| Keine Kreditkarte / kein Trial-Ablauf | Registrierung ohne Payment-Schritte, `status: free_active` |
| CareSuite+ Office immer inklusive | `activateRegistrationModules` + Edge Function erzwingt `office` |
| Hauptmodule kostenlos | `FREE_PLATFORM_PRODUCT_KEYS` + `FREE_PLATFORM_FEATURE_KEYS` |
| Premium preparedOnly | `PremiumPreparedNotice`, `PREMIUM_PREPARED_CONNECTORS`, `canAccessPremiumFeature → false` |

---

## B. Code-Audit (Preis/Payment-Begriffe)

| Datei | Begriff | Alte Logik | Neue Aktion |
|-------|-------|------------|-------------|
| `src/lib/billing/pricingCatalog.ts` | price, TRIAL_DAYS | Legacy-Katalog 79–399 € | Beibehalten als Legacy-Referenz; Free Platform nutzt `freePlatformService` |
| `src/lib/billing/billingPreviewService.ts` | billable, checkout | Warenkorb-Berechnung | Unverändert für Legacy; Tenant-Billing via `moduleEntitlementService` → 0 billable |
| `src/lib/business/subscriptionService.ts` | subscription, trial, cart | Abo-Übersicht mit Testphase | → Free Platform Overview, `monthlyTotal: 0` |
| `src/screens/business/SubscriptionScreen.tsx` | Abonnement, Pakete, Warenkorb | Pricing/Checkout-UI | → Free Platform Übersicht, 0 €, Module inklusive |
| `src/components/business/SubscriptionHero.tsx` | Testphase, Abrechnung | Trial-KPIs | → Free Platform KPIs, „Kostenlos" |
| `src/screens/auth/BusinessRegisterScreen.tsx` | trialOrPurchase | Trial vs. Kauf | Entfernt — „Kostenlos registrieren" |
| `src/lib/auth/auth.types.ts` | trialOrPurchase | Registrierungsfeld | Entfernt |
| `src/components/modules/ModuleCard.tsx` | price, Gebucht, Kaufen | Preisanzeige + Paywall | → „Kostenlos", „Kostenlos aktivieren" / „Modul öffnen" |
| `src/components/modules/BusinessModuleHubHero.tsx` | Modul-Freischaltung, billable | Buchungs-Hero | → Free Platform Hero |
| `src/lib/modules/moduleHubStats.ts` | billable KPI | Abrechenbare Module | → „Kostenlos" KPI |
| `src/lib/modules/moduleAccessService.ts` | purchased, billable | Kauf-Freischaltung | → `free_active` / `activateFreeModule` |
| `src/lib/navigation/shellConfig.ts` | Abo | Tab-Label | → „Plattform" |
| `src/data/landing/appStartEntries.ts` | testen | Registrierungs-Copy | → „Kostenlos starten" |
| `src/screens/AppStartScreen.tsx` | Premium SaaS | Marketing-Claim | → Free Platform Messaging |
| `supabase/functions/register-business-tenant/index.ts` | trialing, status trial | Trial-Subscription | → `free_active`, `access_source: free_active` |
| `src/screens/onboarding/CompanySetupScreen.tsx` | cartPreview, /Monat | Onboarding-Preis | **Nicht geändert** — Demo-Onboarding Legacy |

---

## C. Migration

**Datei:** `supabase/migrations/0038_free_platform_strategy.sql` (0037 war belegt)

| Spalte/Tabelle | Änderung |
|----------------|----------|
| `tenants.free_platform_enabled` | BOOLEAN DEFAULT TRUE |
| `tenant_products.access_type` | free / premium_prepared / admin_disabled / legacy_paid |
| `tenant_products.price_cents` | INTEGER DEFAULT 0 |
| `tenant_products.premium_ready` | BOOLEAN DEFAULT FALSE |
| `tenant_products.billing_status` | + free_active, free_available, premium_prepared, admin_disabled |
| `tenant_products.access_source` | + free_active, free_available |
| `tenant_subscriptions.status` | + free_active |
| UPDATE bestehende Zeilen | Non-destructive Migration auf Free Platform |

**Hinweis:** Migration nicht remote angewendet (lokal vorbereitet).

---

## D. Services

| Service | Pfad | Funktionen |
|---------|------|------------|
| freePlatformService | `src/lib/billing/freePlatformService.ts` | `isFreePlatformEnabled()`, `getFreePlatformModules()`, `isPremiumPrepared()` |
| moduleActivationService | `src/lib/billing/moduleActivationService.ts` | `activateFreeModuleForTenant()`, `activateAllBaseModulesForTenant()`, `activateRegistrationModules()` |
| productAccessService | `src/lib/billing/productAccessService.ts` | `canAccessModule()`, `canAccessPremiumFeature()` |
| moduleAccessService (erweitert) | `src/lib/modules/moduleAccessService.ts` | `activateFreeModule()`, `canAccessModule()` |

---

## E. Registrierung `/auth/register-business`

- Payment-Schritte entfernt (`trialOrPurchase` gelöscht)
- Copy: „Kostenlos registrieren", „Module kostenlos aktivieren"
- CareSuite+ Office locked/always-on
- `PremiumPreparedNotice` eingebunden
- Demo + Supabase Edge Function: Module mit `free_active`, Subscription `free_active`

---

## F. UI-Komponenten

| Komponente | Änderung |
|------------|----------|
| `PremiumPreparedNotice.tsx` | Neu — DATEV, KIM, TI, E-Rezept preparedOnly |
| `ModuleCard.tsx` | Status free_active/free_available, Buttons „Kostenlos aktivieren" / „Modul öffnen" |
| `ModuleOverviewScreen.tsx` | Free Platform Copy, PremiumPreparedNotice |
| `SubscriptionScreen.tsx` | Free Platform Overview statt Pricing/Checkout |
| `AppStartScreen.tsx` | „Kostenlos starten", 0 € Messaging |
| `AuthRegisterHero.tsx` | Free Platform KPIs |

---

## G. Modul-Übersicht

Status-Mapping:
- `free_active` → „Kostenlos aktiv"
- `free_available` → „Kostenlos verfügbar"
- `premium_prepared` → „Premium vorbereitet"
- `admin_disabled` → „Admin deaktiviert"

Buttons: „Kostenlos aktivieren" / „Modul öffnen" — **nicht** „Kaufen"

---

## H. Audit-Script

**Script:** `scripts/free-platform-audit.mjs`  
**npm:** `free-platform:audit`

Prüft: Migration 0038, Kern-Services, UI-Muster, verbotene Texte in Hauptflows.

---

## I. Tests

**Datei:** `src/__tests__/billing/freePlatformStrategy.test.ts`

| Test | Status |
|------|--------|
| Registrierung ohne Payment | ✓ |
| CareSuite+ Office auto free | ✓ |
| Module kostenlos aktivieren | ✓ |
| Kein Paywall Hauptmodule | ✓ |
| PremiumPreparedNotice | ✓ |
| Pricing/Subscription Free Platform | ✓ |

Aktualisiert: `moduleAccess.test.ts`, `pricingModel.test.ts`, `businessModuleHubHero.test.ts`, `appStartPage.test.ts`, `authAccessModel.test.ts`

---

## J. Quality Gates

| Gate | Ergebnis |
|------|----------|
| typecheck | ✓ bestanden |
| test | ✓ 1264/1264 bestanden |
| smoke | ✓ bestanden |
| platform:audit | ✓ bestanden |
| store:audit | ✓ bestanden (2 Warnungen Store-Submit) |
| free-platform:audit | ✓ bestanden |
| design:audit | ✓ bestanden |
| responsive:audit | ✓ bestanden |
| visual:audit | ✓ bestanden |
| content:audit | ✓ bestanden |

---

## K. Breaking Changes

- Minimal: Legacy `pricingCatalog` bleibt für Referenz
- `activatePurchasedModule` delegiert bei Free Platform an `activateFreeModule`
- `SubscriptionOverview` ohne `cartPreview`/`trialDaysLeft` — Hook vereinfacht
- `trialOrPurchase` aus `BusinessRegistrationInput` entfernt

---

## L. Premium preparedOnly (ehrlich)

| Connector | Status |
|-----------|--------|
| DATEV | preparedOnly — `canAccessPremiumFeature('datev') → false` |
| KIM | preparedOnly |
| TI-Connector | preparedOnly |
| E-Rezept | preparedOnly |

Keine Paywall auf Hauptmodulen. Premium-Hinweis in UI, nicht blockierend.

---

## M. Nicht umgesetzt / bewusst offen

- Remote Migration Apply (laut Anweisung nicht ausgeführt)
- Stripe/Checkout-Integration (nicht Ziel dieser Strategie)
- `CompanySetupScreen` Onboarding-Preisvorschau (Legacy Demo — separater Sprint)
- Produktions-Store-Freigabe / Monetarisierung Premium

---

## N. Checkliste Parent (1–11)

| # | Task | Status |
|---|------|--------|
| 1 | Code-Audit + Report-Tabelle | ✓ |
| 2 | Migration 0038 | ✓ |
| 3 | Services (freePlatform, moduleActivation, productAccess) | ✓ |
| 4 | Registrierung ohne Payment | ✓ |
| 5 | UI (PremiumPreparedNotice, Free Platform Copy) | ✓ |
| 6 | Modul-Übersicht Status/Buttons | ✓ |
| 7 | Audit-Script + npm script | ✓ |
| 8 | Tests | ✓ |
| 9 | Quality Gates | ✓ (siehe J) |
| 10 | Report A–O | ✓ |
| 11 | Deutsche Zusammenfassung | ✓ |

---

## O. Verdict

**CareSuite+ Free Platform Strategy wurde umgesetzt.**

Alle Organisationen können CareSuite+ dauerhaft kostenlos nutzen: 0 € monatlich, CareSuite+ Office inklusive, Hauptmodule frei aktivierbar, Premium-Connectors nur vorbereitet (preparedOnly). Nicht production-ready, nicht store-ready, nicht Premium monetarisiert.
