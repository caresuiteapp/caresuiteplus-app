# PLATFORM.2.0B — Operator UI Gate

**Status:** GO (lokal)  
**Datum:** 2026-07-08  
**Branch:** `cursor/platform-2-0b-operator-ui`  
**Basis:** `f9eb6f69` — feat(platform): add operator foundation for plans billing and entitlements  

---

## 1. Branch / Git

| Feld | Wert |
|------|------|
| Branch | `cursor/platform-2-0b-operator-ui` |
| HEAD vorher | `f9eb6f69cf584edf7f72ff65664c54663ab8979e` |
| HEAD nachher | _(nach Commit unten)_ |
| Push | **NEIN** |
| Deploy | **NEIN** |
| `[deploy]` | **NEIN** |
| Production Apply 0254 | **NEIN** |

Unrelated (nicht committed): `docs/audit/wfm-office-timekeeping-finalization-gate.md`, Temp-Skripte, `dist/`

---

## 2. Geänderte / neue Dateien

### Services & Types
- `src/lib/platformConsole/platformFoundationService.ts` — erweiterte RPC-Wrapper (Plan/Addon/Subscription/Discount)
- `src/lib/platformConsole/platformOperatorDataService.ts` — Read-Helper (Versionen, Module, Limits, Subscriptions)
- `src/lib/platformConsole/platformTenantService.ts` — `assignPlatformPlan` → `platform_assign_plan_to_tenant`
- `src/lib/platformConsole/platformCapabilities.ts` — Reason min 5, `plans.write` für Admin
- `src/lib/platformConsole/index.ts` — Exports
- `src/lib/platformConsole/platformNavigation.ts` — Nav „Add-ons"

### UI
- `src/screens/platformConsole/PlatformPlansOperatorScreen.tsx` — **NEU**
- `src/screens/platformConsole/PlatformAddonsOperatorScreen.tsx` — **NEU**
- `src/components/platformConsole/PlatformBillingPreviewPanel.tsx` — **NEU**
- `src/screens/platformConsole/PlatformTenantOperatorTabs.tsx` — Subscription, Entitlements, Credits, Billing Preview
- `src/screens/platformConsole/PlatformTenantDetailScreen.tsx` — neue Tabs
- `src/screens/platformConsole/PlatformSystemScreen.tsx` — `updatePlatformSystemSetting` verdrahtet
- `src/screens/platformConsole/PlatformCatalogScreens.tsx` — Module-Hinweise
- `src/components/platformConsole/PlatformConfirmModal.tsx` — Reason min 5
- `app/platform/(console)/addons/index.tsx` — **NEU**

### Tests
- `src/__tests__/platformConsole/platformOperatorFoundation.test.ts` — **NEU** (12 Tests)

---

## 3. Plans UI — Ergebnis

| Kriterium | Status |
|-----------|--------|
| Plan-Liste | ✅ |
| Plan erstellen | ✅ (Reason Modal) |
| Plan bearbeiten | ✅ |
| Plan-Version erstellen | ✅ |
| Versionen anzeigen | ✅ |
| Module zu Plan hinzufügen/entfernen | ✅ |
| Plan-Limits setzen | ✅ |
| Audit-Link nach Write | ✅ |
| Read-only ohne plans.write | ✅ |

Route: `/platform/plans`

---

## 4. Plan Versions UI — Ergebnis

✅ Versionen werden geladen; neue Version via `platform_create_plan_version` mit Reason.

---

## 5. Add-ons UI — Ergebnis

| Kriterium | Status |
|-----------|--------|
| Route `/platform/addons` | ✅ |
| Navigation | ✅ |
| Add-on Liste | ✅ |
| Add-on erstellen/bearbeiten | ✅ |
| Add-on-Version erstellen | ✅ |
| Mandant zuweisen/entfernen | ✅ |
| Entitlements recalc nach Zuweisung | ✅ |
| Audit-Link | ✅ |

---

## 6. Tenant Subscription UI — Ergebnis

Tab **Subscription** im Mandantendetail:
- Subscription-Status, Plan, Periode, Trial
- Plan zuweisen (`assignPlatformPlan` → Foundation)
- Pausieren / Reaktivieren / Kündigen
- Reason required + Audit

---

## 7. Entitlements UI — Ergebnis

Tab **Entitlements**:
- `platform_get_effective_tenant_entitlements`
- Button „Neu berechnen" → `platform_recalculate_tenant_entitlements`

---

## 8. Discounts/Credits UI — Ergebnis

- Rabatte: bestehende Discounts-Screens + Mandanten-Tab (legacy + Foundation-RPCs verfügbar)
- Credits: Tab **Credits** mit `bookPlatformTenantCredit`, Balance-Anzeige

---

## 9. Billing Preview UI — Ergebnis

- `PlatformBillingPreviewPanel` im Mandanten-Tab **Billing Preview**
- `platform_generate_invoice_preview`
- Klare Disclaimer: keine finale Rechnung, keine Zahlung

---

## 10. Modules UI — Ergebnis

- Katalog: Read + Hinweis auf Plan-Zuordnung unter Tarife
- Mandanten-Module: bestehendes Toggle via `setPlatformTenantModule`
- **Offen 2.0C:** `platform_update_module_status` (globaler Modulstatus) fehlt in 0254

---

## 11. Feature Flags Minimal-Wiring — Ergebnis

✅ Mandanten-Tab: Aktivieren/Deaktivieren mit Reason via `setPlatformFeatureFlag` (scope tenant)

---

## 12. System Settings Wiring — Ergebnis

| Feld | Status |
|------|--------|
| `updatePlatformSystemSetting` verdrahtet | **JA** |
| Reason required | ✅ |
| Sensitive values maskiert | ✅ |
| Audit-Link | ✅ |

---

## 13. assignPlatformPlan verdrahtet

**JA** — `platformTenantService.assignPlatformPlan` delegiert an `assignPlatformPlanToTenant` (`platform_assign_plan_to_tenant`).

---

## 14. updatePlatformSystemSetting verdrahtet

**JA** — `PlatformSystemScreen` mit Edit-Form + Confirm Modal.

---

## 15. Audit Integration

Nach kritischen Writes: `PlatformAuditLink` in Plans, Add-ons, Subscription, Entitlements, Credits, Billing Preview, System Settings, Feature Flags (Tenant).

---

## 16. Tests

```
npx vitest run src/__tests__/platformConsole/
```

**Ergebnis:** 68/68 grün (56 bestehend + 12 neue Operator-Foundation-Tests)

---

## 17. Staging Smoke

| Prüfung | Ergebnis |
|---------|----------|
| Staging Ref | `shwpweerzsfkqaivmaoc` |
| RPCs vorhanden (SQL) | ✅ 30+ `platform_*` Functions |
| Browser UI Smoke (24 Steps) | **Manuell ausstehend** — kein automatisierter Browser-Lauf in diesem Gate |
| Production | **NICHT berührt** |

Backend auf Staging bereit; UI-Flows manuell mit Platform Owner verifizieren.

---

## 18. Expo Export

```
EXPO_PUBLIC_DEMO_MODE=false npx expo export --platform web
```

**Ergebnis:** OK — `/platform/(console)/addons`, `/platform/(console)/plans` in Static Routes

---

## 19. Offene Punkte für 2.0C

- `platform_update_module_status` (globaler Modulstatus beta/coming_soon)
- Product Enforcement Vollausbau in App-Modulen
- Invoice Finalize / Payments / Dunning
- Rollouts, Segments, Approvals, API Keys, Webhooks
- Production Apply Migration 0254
- Vollständiger Browser-Staging-Smoke (24 Steps) dokumentieren

---

## 20. Absolutregeln

| Regel | Status |
|-------|--------|
| Production Apply | NEIN |
| Deploy | NEIN |
| Push | NEIN |
| Fake Buttons | NEIN |
| Service Role im Frontend | NEIN |

---

## Akzeptanz — Summary

| # | Kriterium | GO |
|---|-----------|-----|
| 1–15 | Operator-Flows Plans/Addons/Subscription/Entitlements/Discounts/Credits/Preview | ✅ |
| 16–17 | Module (partial) / Feature Flags | ✅ / partial |
| 18–19 | System Settings / assignPlatformPlan | ✅ |
| 20–24 | Reason / Audit / RBAC | ✅ |
| 25 | Tests | ✅ 68/68 |
| 26 | Staging Smoke | partial (RPC ✅, UI manual) |
| 27 | Expo Export | ✅ |
| 28–30 | Production / Deploy / Push | ✅ eingehalten |

**PLATFORM.2.0B Operator UI: GO (lokal, commit bereit, kein Push)**
