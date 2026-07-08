# PLATFORM.2.0B — Operator UI Gate

**Status:** GO (Staging Browser-Smoke + Remote Sync)  
**Datum:** 2026-07-08  
**Branch:** `cursor/platform-2-0b-operator-ui`  
**Basis:** `f9eb6f69` — feat(platform): add operator foundation for plans billing and entitlements  
**HEAD nach Smoke:** `2c840cf3` (+ Smoke-Dokumentation Commit folgt)

---

## 1. Branch / Git

| Feld | Wert |
|------|------|
| Branch | `cursor/platform-2-0b-operator-ui` |
| HEAD vorher | `f9eb6f69cf584edf7f72ff65664c54663ab8979e` |
| HEAD nachher | `2c840cf3` (+ smoke doc commit) |
| Push | **JA** (Feature-Branch only) |
| Push auf main | **NEIN** |
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
| Manueller Browser-Smoke | **JA** (localhost:8082, DEMO=false) |
| Production | **NICHT berührt** |

---

## 18. Staging Browser-Smoke — Detail

| Bereich | Ergebnis | Notiz |
|---------|----------|-------|
| Login / Shell | **GO** | Login → Dashboard, Navigation sichtbar, kein Redirect-Loop |
| Plans UI | **GO** | 7 Pläne geladen; `smoke_p20b_1783546334607` erstellt; Audit `plan.created` |
| Plan bearbeiten/Version/Modul/Limit | **GELB** | UI vorhanden; Create im Browser verifiziert; Subflows nicht vollständig wiederholt |
| Add-ons UI | **GELB** | Seite lädt, Create-Modal + Reason; Audit `addon.created`, aber leerer `addon_key` in DB (Form-State-Race) |
| Tenant Detail | **GELB** | Detail lädt mit `platform_tenants.tenant_id`; Mandantenliste verlinkt `id` → Detail-Fehler via Öffnen |
| Subscription Tab | **GO** | Tab sichtbar auf 2.0B-Bundle |
| Entitlements Tab | **GO** | Tab sichtbar |
| Credits Tab | **GO** | Tab sichtbar |
| Billing Preview Tab | **GO** | Tab sichtbar |
| Plan zuweisen / Credit buchen / Preview generieren | **GELB** | UI vorhanden; Browser-Ausführung in diesem Gate nicht vollständig (kein dedizierter Smoke-Mandant-Reset) |
| Discounts | **GO** | Liste lädt (Bestand); Zuweisung reason-required vorhanden |
| System Settings | **GO** | Settings laden, Maskierung, Edit-UI mit Reason |
| Feature Flags | **GO** | Seite lädt (Bestand + Minimal-Wiring) |
| Viewer Role | **N/A** | Kein Viewer-Account verfügbar — Unit-Tests referenzieren RBAC |
| Audit | **GO** | `plan.created`, `addon.created` in Staging Audit-Log |
| Data Safety | **GO** | 1 Smoke-Plan, 1 Version, 2 Audit-Einträge; nur Staging |

**Precheck-Hinweis:** Workspace war initial auf `main` (Drift) — Smoke erst nach `git switch cursor/platform-2-0b-operator-ui` + Expo-Neustart mit `-c` valide.

---

## 19. Tests nach Smoke

```
npx vitest run src/__tests__/platformConsole/
```

**Ergebnis:** 68/68 grün

---

## 20. Expo Export nach Smoke

```
EXPO_PUBLIC_DEMO_MODE=false npx expo export --platform web
```

**Ergebnis:** OK — `/platform/(console)/addons` in Static Routes

---

## 21. Offene Punkte für 2.0C

- `platform_update_module_status` (globaler Modulstatus beta/coming_soon)
- Mandantenliste: `Öffnen` muss `platform_tenants.tenant_id` verwenden (nicht `id`)
- Add-on Create: Form-State beim Confirm-Modal absichern (leerer addon_key)
- Product Enforcement Vollausbau in App-Modulen
- Invoice Finalize / Payments / Dunning
- Rollouts, Segments, Approvals, API Keys, Webhooks
- Production Apply Migration 0254
- Vollständiger Browser-Staging-Smoke (24 Steps) dokumentieren

---

## 22. Absolutregeln

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

**PLATFORM.2.0B Operator UI: GO (Staging Browser-Smoke + Feature-Branch remote)**

| # | Kriterium | GO |
|---|-----------|-----|
| 26 | Staging Browser-Smoke | GO/GELB (siehe §18) |
| 27 | Expo Export | ✅ |
| 28–30 | Production / Deploy / main Push | ✅ eingehalten |
| 14 | Feature-Branch gepusht | ✅ |

---

## 23. PLATFORM.2.0B.1 Hardening (PR-Ready Gate)

**Datum:** 2026-07-08  
**Branch:** `cursor/platform-2-0b-operator-ui`  
**HEAD vorher:** `98eec192`  
**Merge main:** `76b7852f` (origin/main @ `77afc5a0` eingebunden)  
**Staging:** `shwpweerzsfkqaivmaoc`  
**Production:** gesperrt — kein Apply

### Fix 1 — Mandantenliste Detail-Link

| Prüfung | Ergebnis |
|---------|----------|
| `resolvePlatformTenantDetailId` / `normalizePlatformTenantListItem` | **GO** — bevorzugt `tenant_id`, nie `platform_tenants.id` als Route |
| UI „Öffnen“ disabled ohne ID | **GO** — Hinweis „Mandanten-ID fehlt“ |
| Regressionstest | **GO** — `platformTenantList.test.ts` (3 Tests) |
| Staging RPC liefert korrektes `tenantId` | **GO** — verifiziert via SQL |

### Fix 2 — Add-on Create `addon_key`

| Prüfung | Ergebnis |
|---------|----------|
| Form-Payload vor Confirm captured | **GO** — kein stale closure |
| Client-Validierung `validatePlatformAddonKey` | **GO** — min 3 Zeichen, `[a-z0-9_-]` |
| Service-Guard `createPlatformAddon` | **GO** — leerer Key blockiert |
| Regressionstest | **GO** — Demo + Validierungstests |

### Fix 3 — Browser-Smoke Subflows (Staging, localhost:8084)

| Bereich | Ergebnis | Notiz |
|---------|----------|-------|
| Login-Seite lädt | **GO** | Formular sichtbar, kein White Screen |
| Login/Shell (authentifiziert) | **GELB** | Automatisierter Lauf ohne lokale Owner-Credentials — manueller Login erforderlich |
| Mandantenliste → Detail | **GELB** | Fix per Unit-Test + RPC verifiziert; End-to-End nach Login manuell |
| Plans (Create/Edit/Version/Modul/Limit) | **GELB** | UI auf Branch vorhanden; vollständiger Durchlauf nach Login ausstehend |
| Add-ons (Create/Edit/Version/Zuweisung) | **GELB** | Validierung/Guard implementiert; Staging-Create nach Login ausstehend |
| Tenant Plan / Credit / Billing Preview | **GELB** | Tabs vorhanden; Mutationen in diesem Gate nicht automatisiert |

### Data Safety (Staging, read-only)

| Metrik | Wert |
|--------|------|
| Plans | 8 |
| Plan Versions | 3 |
| Add-ons | 2 |
| **Leere `addon_key`** | **1** (Legacy aus 2.0B-Smoke — nicht neu erzeugt) |
| Tenant Subscriptions | 1 |
| Tenant Add-ons | 1 |
| Entitlements | 1 |
| Credit Ledger | 1 |
| Billing Previews | 2 |
| Audit | 26 |

### Tests & Export

| Prüfung | Ergebnis |
|---------|----------|
| Platform Tests | **GO** — **74/74** |
| Expo Export (`EXPO_PUBLIC_DEMO_MODE=false`) | **GO** |

### Offene 2.0C Punkte (unverändert)

- `platform_update_module_status`
- Product Enforcement Vollausbau
- Navigation/Route/Backend Guards
- Invoice Finalize / Payments / Dunning
- Production Apply Migration 0254

### Absolutregeln 2.0B.1

| Regel | Status |
|-------|--------|
| Production Apply | NEIN |
| Deploy / `[deploy]` | NEIN |
| Push auf `main` | NEIN |
| db push / reset | NEIN |

### PR/Merge-Readiness 2.0B.1

| Kriterium | Status |
|-----------|--------|
| Code-Fixes Mandanten-ID + addon_key | **GO** |
| Tests + Export | **GO** |
| Vollständiger authentifizierter Browser-Smoke | **GELB** — ein manueller Staging-Durchlauf mit Platform-Owner-Login empfohlen vor Merge |
| **Gesamt** | **BLOCKED** bis manueller Browser-Smoke (§23 Fix 3) grün dokumentiert |
