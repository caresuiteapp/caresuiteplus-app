# Platform Console — Operational Gap Analysis (PLATFORM.2.0)

**Datum:** 2026-07-08  
**Scope:** CareSuite+ SaaS Platform Console (`/platform/*`)  
**Production URL:** https://caresuiteplus.app/platform/login  
**Basis:** Code-Stand `main` @ `1d3121d7`, Migrations 0246–0251, UI/Services/Tests  
**Ziel:** Schonungslose Ist-Analyse vor PLATFORM.2.0A–F

---

## Executive Summary

| Kategorie | GRÜN | GELB | ROT |
|-----------|------|------|-----|
| Bereiche (34) | 3 | 8 | 23 |
| 5-Ebenen-Definition (UI/Service/DB/Enforcement/Audit) | ~15% operativ | ~25% teilweise | ~60% Hülle/fehlend |

**Kernbefund:** Die Platform Console ist **login- und navigationsfähig**, mit **erstem operativen Kern** (Mandantenstatus, Modul-Zuordnung, Rabatt-Zuweisung, Rechnungsstatus, manuelle Zahlung, Feature Flags, Support Sessions, Audit-Read). Sie ist **keine vollständige SaaS-Steuerzentrale**: Preisversionierung, Subscriptions, Add-ons, Entitlements-Engine, Billing Preview, Product Enforcement, Rollouts, Approvals und ~80% der PLATFORM.2.0-Tabellen fehlen.

**Production Schema:** Platform-Migrationen 0246–0251 wurden am 2026-07-08 auf Production angewendet (Owner-Login-Fix). Staging hatte diese bereits.

---

## Bewertungslegende

| Ampel | Bedeutung |
|-------|-----------|
| **GRÜN** | Echte operative Funktion über alle relevanten Ebenen |
| **GELB** | Teilweise funktional — Read+Write lückenhaft, Enforcement oder Audit unvollständig |
| **ROT** | Anzeigehülle / fehlend / Fake-Button / keine Produktwirkung |

**5 Ebenen:** UI · Service · Datenmodell · Product-Enforcement · Audit

---

## Ist-Stand Architektur

### UI-Routen (18)

| Route | Screen |
|-------|--------|
| `/platform/login` | `PlatformLoginScreen` |
| `/platform/forbidden` | `PlatformForbiddenScreen` |
| `/platform/dashboard` | `PlatformDashboardScreen` |
| `/platform/tenants` | `PlatformTenantsScreen` |
| `/platform/tenants/[tenantId]` | `PlatformTenantDetailScreen` (11 Tabs) |
| `/platform/modules` | `PlatformModulesCatalogScreen` |
| `/platform/plans` | `PlatformPlansScreen` |
| `/platform/discounts` | `PlatformDiscountsScreen` |
| `/platform/billing` | `PlatformBillingScreen` |
| `/platform/payments` | `PlatformPaymentsScreen` |
| `/platform/feature-flags` | `PlatformFeatureFlagsScreen` |
| `/platform/support` | `PlatformSupportScreen` |
| `/platform/audit` | `PlatformAuditScreen` |
| `/platform/system` | `PlatformSystemScreen` |
| `/platform/releases` | `PlatformReleasesScreen` |

### Datenmodell heute (Migration 0246 + 0247)

**14 Tabellen:**

`platform_users`, `platform_tenants`, `platform_modules`, `platform_tenant_modules`, `platform_plans`, `platform_tenant_plans`, `platform_discounts`, `platform_tenant_discounts`, `platform_invoices`, `platform_payments`, `platform_feature_flags`, `platform_support_sessions`, `platform_audit_log`, `platform_system_settings`

**18 externe RPCs (authenticated):**

`platform_get_current_user`, `platform_get_dashboard_summary`, `platform_list_tenants`, `platform_get_tenant_detail`, `platform_update_tenant_status`, `platform_set_tenant_module`, `platform_assign_plan`, `platform_assign_discount`, `platform_remove_discount`, `platform_update_invoice_status`, `platform_record_manual_payment`, `platform_set_feature_flag`, `platform_start_support_session`, `platform_end_support_session`, `platform_update_system_setting`, `platform_list_audit_log`

**Tenant-Enforcement (0247):**

`tenant_list_platform_modules`, `tenant_has_platform_module`

### Services (`src/lib/platformConsole`)

- Auth, Tenant, Ops — demo + live RPC-Pfade
- Capabilities + `PlatformConfirmModal` (reason_required für kritische Writes)
- **Nicht verdrahtet in UI:** `assignPlatformPlan`, `updatePlatformSystemSetting`

---

## Bereichs-Matrix (34 Bereiche)

Spalten: UI · Write · Service · RPC · Tabellen · RLS · Platform-RBAC · Audit · Produkt · Billing · Nav · Backend · Tests · Staging · Prod-ready

Kurz: **J/N/T/D** = Ja / Nein / Teilweise / Deferred

| # | Bereich | Ampel | UI | Write | Service | RPC | Tabellen | RLS | RBAC | Audit | Produkt | Billing | Nav | Backend | Tests | Staging | Prod |
|---|---------|-------|----|----|---------|-----|----------|-----|------|-------|---------|---------|-----|---------|-------|---------|------|
| 1 | Dashboard | GELB | J | N | J | J | J | J | J | T | N | N | — | — | T | T | T |
| 2 | Mandanten | GELB | J | T | J | J | J | J | J | J | T | N | — | T | T | T | T |
| 3 | Tarife | ROT | J | N | T | T | J | J | J | T | N | N | N | N | N | N | T |
| 4 | Plan-Versionen | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 5 | Module | ROT | J | N | T | T | J | J | J | T | T | N | T | T | N | T | T |
| 6 | Add-ons | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 7 | Subscriptions | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 8 | Trials | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 9 | Rabatte | GELB | J | T | J | J | J | J | J | J | N | T | — | — | T | T | T |
| 10 | Coupons | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 11 | Credits | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 12 | Billing Preview | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 13 | Rechnungen | GELB | J | T | J | T | J | J | J | J | N | T | — | — | T | T | T |
| 14 | Zahlungen | GELB | J | T | J | T | J | J | J | J | N | T | — | — | T | T | T |
| 15 | Mahnungen | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 16 | Usage/Metering | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 17 | Limits/Quotas | ROT | T | N | T | N | N | — | — | N | N | N | N | N | N | N | N |
| 18 | Feature Flags | GELB | J | J | J | J | J | J | J | J | T | N | T | T | T | T | T |
| 19 | Segmente | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 20 | Rollouts | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 21 | Approvals | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 22 | Support Sessions | GRÜN | J | J | J | J | J | J | J | J | N | N | — | — | T | T | T |
| 23 | Impersonation | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 24 | Platform Users | ROT | N | N | T | T | J | J | J | T | N | N | — | — | T | T | T |
| 25 | Mandanten Users | ROT | T | N | N | N | N | — | — | N | N | N | — | — | N | N | N |
| 26 | API Keys | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 27 | Webhooks | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 28 | Integrationen | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 29 | System Health | ROT | T | N | T | N | T | — | J | N | N | N | — | — | N | N | T |
| 30 | Releases | ROT | J | N | T | N | N | — | J | N | N | N | — | — | N | N | T |
| 31 | Audit | GRÜN | J | N | J | J | J | J | J | J | — | — | — | — | T | T | T |
| 32 | Compliance/Retention | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 33 | Datenexporte | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |
| 34 | Maintenance Mode | ROT | N | N | N | N | N | — | — | N | N | N | N | N | N | N | N |

---

## Detail pro Bereich

### 1. Dashboard — GELB

| Check | Status |
|-------|--------|
| UI KPIs | Ja — `platform_get_dashboard_summary` |
| Quick Actions mit Wirkung | Nein — keine operativen Shortcuts |
| Service | Ja |
| Audit preview | Ja — letzte Einträge |
| Produktwirkung | Nein |
| Tests | Unit (demo services), kein E2E |

### 2. Mandanten — GELB

| Check | Status |
|-------|--------|
| Liste/Suche | Ja |
| Detail 11 Tabs | Ja |
| Mandant erstellen | **Nein** — kein RPC/UI |
| Status sperren/entsperren | Ja — `platform_update_tenant_status`, reason_required |
| Tarifwechsel UI | **Nein** — RPC `platform_assign_plan` existiert, **nicht verdrahtet** |
| Add-ons/Rabatte/Credits in Detail | Rabatte ja; Add-ons/Credits nein |
| Billing Preview | Nein |
| User-Tab | Placeholder (PLATFORM.1.3 deferred) |
| Produktwirkung Sperre | **Teilweise** — Status in `platform_tenants`, App-Enforcement nicht durchgängig |
| Audit | Ja bei Writes |

### 3. Tarife — ROT

| Check | Status |
|-------|--------|
| UI | Read-only Katalog (`platform_plans` SELECT) |
| CRUD | Nein |
| Plan-Versionen | Nicht vorhanden |
| Preisänderung | Nein |
| Module/Limits/Add-ons am Plan | Nein |
| `assignPlatformPlan` Service | Existiert, **kein UI** |

### 4. Plan-Versionen — ROT

Komplett fehlend. Keine `platform_plan_versions`, keine Versionierungslogik, keine Scheduled Changes.

### 5. Module — ROT (Katalog) / GELB (Mandant)

| Check | Status |
|-------|--------|
| Katalog-UI | Read-only |
| Modul CRUD / Status beta/coming_soon | Nein — Seed-only in 0246 |
| Mandant Modul an/aus | Ja — `platform_set_tenant_module` |
| Status-History | Nein |
| Dependencies | Nein |
| Enforcement | **Teilweise** — `tenant_has_platform_module` (0247); kein beta/coming_soon/disabled-Modell |
| Navigation in App | Nicht zentral aus Platform-Entitlements |

### 6. Add-ons — ROT

Keine Tabellen, UI, RPCs, Entitlements oder Billing-Wirkung.

### 7–8. Subscriptions / Trials — ROT

Keine `platform_tenant_subscriptions`. Nur `platform_tenant_plans` (vereinfacht). Kein Trial-Lifecycle, kein past_due/suspended-Enforcement in App.

### 9. Rabatte — GELB

| Check | Status |
|-------|--------|
| Katalog anzeigen | Ja |
| Katalog erstellen/bearbeiten | **Deferred** (PLATFORM.1.3) |
| Mandant zuweisen/entfernen | Ja — reason_required |
| Billing Preview Wirkung | **Nein** — keine Preview-Engine |
| Rechnungsposition Rabatt | Nicht berechnet |

### 10–11. Coupons / Credits — ROT

Nicht implementiert. Kein Credit Ledger.

### 12. Billing Preview — ROT

Keine `platform_invoice_previews`, keine Pricing Engine, keine Formel Plan+Add-ons+Usage−Discounts−Credits.

### 13. Rechnungen — GELB

| Check | Status |
|-------|--------|
| Liste | Ja |
| Erzeugen | **Deferred** |
| Status ändern | Ja — `platform_update_invoice_status` |
| Finalisieren/Stornieren/Void | Teilweise über Status-Enum, kein dedizierter Void-Flow |
| Positionen erklären | Read-only aus DB |
| Locking finaler Rechnungen | Nicht durchgesetzt |

### 14. Zahlungen — GELB

| Check | Status |
|-------|--------|
| Liste | Ja |
| Manuell erfassen | Ja — `platform_record_manual_payment` |
| Bestehende ändern | **Nein** — kein Update-RPC |
| Zuordnung/Overpayment Credit | Nein |

### 15. Mahnungen — ROT

Kein Dunning-Modell.

### 16–17. Usage/Metering / Limits — ROT

Limits-Tab zeigt Plan-Limits read-only; `getPlatformLimitsDeferred()` — explizit deferred. Keine Meter, Aggregates, Alerts.

### 18. Feature Flags — GELB

| Check | Status |
|-------|--------|
| Global setzen | Ja — `platform_set_feature_flag` |
| Tenant-Targeting | RPC unterstützt tenant_id |
| Rollout/Segmente | Nein |
| **Runtime in App** | **Teilweise** — Flag muss in App-Code konsumiert werden; nicht flächendeckend |
| Change History | Nein (nur Audit-Log) |

### 19–21. Segmente / Rollouts / Approvals — ROT

Nicht implementiert.

### 22. Support Sessions — GRÜN

Start/Ende mit reason, Modus, Scope-Array, Audit. Auto-Ende über `expires_at`. Impersonation-Events fehlen als separates Modell.

### 23. Impersonation — ROT

Keine `platform_impersonation_events`, kein kontrollierter Impersonation-Flow.

### 24. Platform Users — ROT

Tabelle `platform_users` existiert; **keine UI** für Einladung/Rollenverwaltung. Manueller Bootstrap (Production Owner gerade gefixt).

### 25. Mandanten Users — ROT

Detail-Tab Placeholder. Keine sichere RPC-Schicht.

### 26–28. API Keys / Webhooks / Integrationen — ROT

Nicht implementiert.

### 29. System Health — ROT

System-Screen: Settings read-only. `updatePlatformSystemSetting` **nicht in UI**. Keine Health-Checks, Provider-Status, RPC/RLS-Diagnose.

### 30. Releases — ROT

Client-Env-Info (`getPlatformReleaseInfo`). Keine DB, kein Build/Migration/Smoke-Status aus Backend.

### 31. Audit — GRÜN

Suche, Filter, Actor/Tenant/Entity, `platform_list_audit_log`. Writes auditieren via `platform_write_audit_log` (internal). Export/Alerts fehlen.

### 32–34. Compliance / Exporte / Maintenance — ROT

Nicht implementiert.

---

## Product Enforcement Gap

| Mechanismus | Ist | Soll (PLATFORM.2.0) |
|-------------|-----|-------------------|
| Modulzugriff | `tenant_has_platform_module` | Entitlements aus Plan+Add-on+Override |
| Modulstatus beta/coming_soon/disabled | Nein | Navigation + Route + RPC |
| Subscription status | Nein | active/trial/suspended/blocked |
| Feature Flags runtime | Teilweise | Flächendeckend UI+Backend |
| Limits | Nein | Soft/Hard + Billing |
| Mandantensperre in App | Teilweise | Durchgängig |

**Kritisch:** App leitet Modulzugriff nicht aus effektiven Entitlements ab — direkte UI-Konfiguration / vereinfachte Tenant-Module.

---

## Service–UI Lücken (konkret)

| Service/RPC | UI verdrahtet |
|-------------|---------------|
| `assignPlatformPlan` / `platform_assign_plan` | **Nein** |
| `updatePlatformSystemSetting` / `platform_update_system_setting` | **Nein** |
| Rabattkatalog CRUD | **Deferred** |
| Rechnung manuell anlegen | **Deferred** |
| Zahlung nachträglich ändern | **Kein RPC** |

---

## Tests & Gates

| Suite | Status |
|-------|--------|
| `platformConsole.test.ts` | RBAC, demo services |
| `platformAuthGate.test.ts` | Login redirects |
| `platformOperatorUi.test.ts` | Reason validation matrix |
| Screen/E2E | **Fehlt** |
| Staging Smoke PLATFORM.2.0 Workflows | **Fehlt** (1.5 temp script existiert) |
| Pricing/Entitlement/Billing Unit Tests | **Fehlt** |

---

## PLATFORM.2.0 Block-Zuordnung

| Block | Ist-Abdeckung | Gap |
|-------|---------------|-----|
| **2.0A Foundation** | ~20% | Subscriptions, Plan-Versionen, Entitlements, Pricing/Billing Engines, ~40 Tabellen, ~35 RPCs |
| **2.0B Operator UI** | ~35% | Tarife/Module/Add-ons write, Mandant anlegen, Billing Preview, System settings |
| **2.0C Product Enforcement** | ~10% | beta/coming_soon/disabled, Subscription-Status, Limits |
| **2.0D Billing/Payments** | ~15% | Preview, Invoice lifecycle, Credits, Dunning |
| **2.0E Feature Management** | ~15% | Segmente, Rollouts, Approvals |
| **2.0F Ops/Governance** | ~20% | API Keys, Webhooks, Health, Maintenance, Audit Export |

---

## Empfohlene Reihenfolge (nach Master-Prompt)

1. **PLATFORM.2.0A** — Datenmodell + Entitlements + Pricing/Billing Preview + Core RPCs + Audit-Writer (kein UI-Bloat)
2. **PLATFORM.2.0B** — Operator UI: Tarife, Module, Add-ons, Mandant-Lifecycle, verdrahte existierende RPCs
3. **PLATFORM.2.0C** — Navigation/Route/RPC Guards in Haupt-App
4. **PLATFORM.2.0D–F** — sequentiell Billing, Feature Mgmt, Ops

**Nicht in 2.0:** DATEV, Robotic/HealthOS Meter (explizit später), automatisierte Dunning-E-Mails ohne Freigabe.

---

## Production / Staging Hinweise

| Umgebung | Platform Schema | Owner Login |
|----------|-----------------|-------------|
| Staging `shwpweerzsfkqaivmaoc` | 0246–0251 | GO (Staging Gate) |
| Production `euagyyztvmemuaiumvxm` | 0246–0251 (2026-07-08) | GO (`caresuiteapp@gmail.com`) |

**Regeln bleiben:** Kein db push · Production Apply nur Release-Gate · Kein Deploy ohne `[deploy]` · Keine Secrets in Audit-Docs.

---

## Fazit

Die Platform Console ist **keine Anzeigehülle ohne Login**, aber **noch keine vollständige SaaS-Betreiberkonsole**. Der nächste Schritt ist **PLATFORM.2.0A (Foundation)** — nicht kosmetische UI-Runden.

**Gap-Analyse Status:** Abgeschlossen (Phase 1).  
**Implementierung:** Nicht gestartet — wartet auf Freigabe Block 2.0A.
