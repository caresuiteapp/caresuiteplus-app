# PLATFORM.2.0A Foundation Gate

**Datum:** 2026-07-08  
**Branch:** `main`  
**HEAD vorher (Gap-Commit):** `73145b05` — `docs(platform): audit operator console operational gaps`  
**HEAD nachher:** `af5336ef` — `feat(platform): add operator foundation for plans billing and entitlements`  
**Staging Ref:** `shwpweerzsfkqaivmaoc`  
**Production Ref:** `euagyyztvmemuaiumvxm` — **nicht angewendet**

---

## 1. Gap-Bericht committed

| Item | Status |
|------|--------|
| `docs/audit/platform-console-operational-gap-analysis.md` | **JA** — Commit `73145b05` |
| Hinweis Git-Precheck | Unrelated modified: `docs/audit/wfm-office-timekeeping-finalization-gate.md` (nicht committed) |

---

## 2. Migration 0254

| Item | Status |
|------|--------|
| Datei | `supabase/migrations/0254_platform_2_0a_foundation.sql` |
| Art | Additive DDL + RPCs + RLS + Grants |
| DROP/TRUNCATE/DELETE produktiv | **Nein** |

---

## 3. Staging Apply Ergebnis

| Check | Ergebnis |
|-------|----------|
| Ziel-Projekt | `shwpweerzsfkqaivmaoc` (Staging) |
| Production ausgeschlossen | **JA** |
| Apply-Methode | `npx supabase db query --linked --file 0254...` (kein `db push`, kein reset) |
| Vorher Plans/Modules/Discounts/Audit | 6 / 20 / 1 / 13 |
| Tabellen vorhanden | **JA** (plan_versions, subscriptions, addons, entitlements, credits, invoice_previews, …) |
| RPCs vorhanden | **JA** (create_plan, assign_plan_to_tenant, recalculate_entitlements, generate_invoice_preview, book_tenant_credit, …) |
| RLS aktiv | **JA** (platform-only SELECT policies) |
| Grants | **JA** (SELECT tables + EXECUTE RPCs) |
| Unerwartete Datenzerstörung | **Nein** |

---

## 4. Neue Tabellen (17)

- `platform_plan_versions`
- `platform_plan_modules`
- `platform_plan_limits`
- `platform_tenant_subscriptions`
- `platform_subscription_events`
- `platform_subscription_scheduled_changes`
- `platform_addons`
- `platform_addon_versions`
- `platform_addon_entitlements`
- `platform_tenant_addons`
- `platform_tenant_addon_events`
- `platform_tenant_entitlements`
- `platform_entitlement_events`
- `platform_tenant_credits`
- `platform_credit_ledger`
- `platform_invoice_previews`
- `platform_invoice_preview_items`

---

## 5. Neue RPCs (Kern)

**Plans:** `platform_create_plan`, `platform_update_plan`, `platform_create_plan_version`, `platform_assign_plan_module`, `platform_remove_plan_module`, `platform_set_plan_limit`

**Subscriptions:** `platform_assign_plan_to_tenant`, `platform_schedule_plan_change`, `platform_suspend_subscription`, `platform_reactivate_subscription`, `platform_cancel_subscription`

**Add-ons:** `platform_create_addon`, `platform_update_addon`, `platform_create_addon_version`, `platform_assign_addon_to_tenant`, `platform_remove_addon_from_tenant`

**Entitlements:** `platform_recalculate_tenant_entitlements`, `platform_get_effective_tenant_entitlements`

**Discounts/Credits:** `platform_assign_discount_to_tenant`, `platform_remove_discount_from_tenant`, `platform_book_tenant_credit`

**Billing Preview:** `platform_generate_invoice_preview`

**Helper:** `platform_resolve_effective_plan_version`, `platform_assert_capability`, `platform_assert_reason`

---

## 6. Pricing Engine

| Item | Ergebnis |
|------|----------|
| Service | `src/lib/platformConsole/foundation/platformPricingEngine.ts` |
| Plan-Version-Auswahl | **OK** (effective_from/until, version_number) |
| Override/Interval | **OK** (monthly/yearly, price overrides) |
| Add-on Summierung | **OK** |
| Unit-Tests | **20/20 foundation tests grün** |

---

## 7. Entitlement Calculator

| Item | Ergebnis |
|------|----------|
| Service | `src/lib/platformConsole/foundation/platformEntitlementCalculator.ts` |
| Plan/Add-on Module | **OK** |
| Beta nur mit Entitlement | **OK** |
| coming_soon / disabled | **OK** |
| Subscription suspended blockiert | **OK** |
| Product Enforcement API | `getTenantEntitlements`, `hasTenantModuleAccess`, `resolveModuleStateForTenant`, `resolveFeatureAvailability`, `resolveTenantSubscriptionStatus` |

---

## 8. Billing Preview Engine

| Item | Ergebnis |
|------|----------|
| Service | `src/lib/platformConsole/foundation/platformBillingPreviewEngine.ts` |
| RPC | `platform_generate_invoice_preview` |
| Plan + Add-ons + Rabatt + Credit | **OK** |
| Total ≥ 0 | **OK** |
| Abgelaufene/inaktive Rabatte | **OK** (ignoriert) |

---

## 9. Audit + reason_required

| Item | Ergebnis |
|------|----------|
| Kritische RPCs schreiben Audit | **JA** (`platform_write_audit_log`) |
| `platform_assert_reason` (< 3 Zeichen → `reason_required`) | **JA** |
| Staging Smoke: reason denied bei `p_reason: 'x'` | **OK denied** |

---

## 10. Tests Ergebnis

| Suite | Ergebnis |
|-------|----------|
| `src/__tests__/platformConsole/` (4 Dateien) | **56/56 PASS** |
| Pricing / Entitlement / Billing Preview / RBAC | **PASS** |
| Gesamte Repo-Test-Suite | Vorbestehende Failures außerhalb Platform-Scope |

---

## 11. Staging Smoke Ergebnis

Script: `scripts/audit/_platform-2-0a-staging-smoke-temp.mjs` (temp, nicht committed)

| Step | Ergebnis |
|------|----------|
| 1 Platform Owner Login | OK (`platform_owner`) |
| 2 Plan erstellen | OK |
| 3 Plan-Version erstellen | OK (v2) |
| 4 Add-on erstellen | OK |
| 5 Mandant Plan zuweisen | OK |
| 6 Entitlements berechnen | OK (count ≥ 1) |
| 7 Add-on zuweisen | OK |
| 8 Entitlements ändern sich | OK |
| 9 Rabatt zuweisen | OK |
| 10 Billing Preview | OK (`totalCents: 11160`) |
| 11 Credit buchen | OK (500 ct) |
| 12 Preview reduziert | OK (`totalCents: 10660`) |
| 13 Audit-Einträge | OK (7 für Tenant) |
| 14 reason_required | OK denied |

**Staging Smoke: GO**

---

## 12. Expo Export

| Befehl | Ergebnis |
|--------|----------|
| `EXPO_PUBLIC_DEMO_MODE=false npx expo export --platform web` | **OK** (`dist/`, 632 static routes) |

---

## 13. Offene Punkte für 2.0B

- Operator UI für Plans/Versions/Subscriptions/Add-ons (Write-Actions verdrahten)
- `assignPlatformPlan` / `updatePlatformSystemSetting` UI-Wiring (bestehende Lücke)
- Backfill `platform_plan_versions` für bestehende 6 Plans auf Staging/Prod
- Add-on Entitlement Seeds / Catalog-UI
- Rollouts, Segmente, Approvals (2.0E)
- Dunning / echte Rechnungserstellung (2.0D)
- Webhooks / API Keys (2.0F)

---

## 14. Release-Flags

| Flag | Wert |
|------|------|
| Production Release | **NEIN** |
| Production Apply | **NEIN** |
| Deploy | **NEIN** |
| Push | **NEIN** |
| `[deploy]` in Commits | **NEIN** |

---

## 15. Akzeptanz PLATFORM.2.0A

| Kriterium | Status |
|-----------|--------|
| Gap-Bericht committed | **GO** |
| Datenmodell Foundation | **GO** |
| Core RPCs | **GO** |
| reason_required | **GO** |
| Audit bei kritischen Aktionen | **GO** |
| Pricing Engine | **GO** |
| Entitlement Calculator | **GO** |
| Billing Preview Engine | **GO** |
| Staging Migration angewendet | **GO** |
| Platform Owner Login | **GO** |
| Platform Tests | **GO** |
| Expo Export | **GO** |
| Staging Smoke | **GO** |
| Kein Production Apply | **GO** |

**Gesamt: GO für PLATFORM.2.0A Foundation (Staging-only)**
