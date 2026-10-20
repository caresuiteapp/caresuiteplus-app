# CareSuite+ HealthOS — H2 Shell & Navigation Report

**Stand:** 2026-07-02  
**Phase:** H2 — Shell & Navigation (Wrapper-Vorbereitung)  
**Deploy:** nein · **Commit:** ausstehend (Freigabe)

---

## 1. Vorhandene Shells (Bestand)

| Shell / Layout | Datei | Route / Bereich | Rolle | Zweck | Probleme | Duplikate | H2-Risiko | Empfehlung |
|----------------|-------|-----------------|-------|-------|----------|-----------|-----------|------------|
| **PlatformShell** | `src/components/layout/platform/platformshell.tsx` | `/office`, `/assist`, `/business/*`, Module | Office, Assist, Zentrale, weitere Module | Desktop: MainModuleRail + ModuleNavSidebar + Topbar + optional RightContextPanel; Mobile: ohne Sidebar | Dual-Routing Office; Zentrale ohne Sidebar | `CareDesktopShell` Alias | hoch bei Ersetzung | **behalten** — H3 wrappen |
| **ModuleNavSidebar** | `src/components/layout/platform/modulenavsidebar.tsx` | Office, Assist, … | Modul-Nav | Gruppierte Sidebar aus `officeNav.ts` / `assistNav.ts` | `/office` vs `/business/office` gemischt in `officeNav` | — | mittel | **wrappen** via `HealthOSDesktopSidebar` |
| **PlatformTopbar** | `src/components/layout/platform/platformtopbar.tsx` | PlatformShell main column | alle Module | Titel, Kontext, Aktionen | — | PortalTopBar ähnlich | niedrig | **wrappen** via `HealthOSTopBar` |
| **BreadcrumbBar** | `src/components/layout/platform/breadcrumbbar.tsx` | ModuleDashboardShell | Office/Assist Detail | Segment-Navigation | nur in Dashboard-Shell, nicht global | — | niedrig | **wrappen** via `HealthOSBreadcrumbs` |
| **MainModuleRail** | `src/components/layout/platform/mainmodulerail.tsx` | PlatformShell | Produktwechsel | Modul-Rail links | — | — | mittel | **behalten** bis H3 |
| **RightContextPanel** | `src/components/layout/platform/rightcontextpanel.tsx` | Desktop ≥1280px | Zentrale, Kontext | KPI / Kontext | Zentrale-only Nav | — | niedrig | **behalten** |
| **PortalShellLayout** | `src/components/layout/portal/PortalShellLayout.tsx` | `/portal/client`, `/portal/employee` | Klient, MA | Desktop: LeftNav + TopBar + optional RightSidebar; Mobile: Drawer + BottomNav | Budget/Arbeitszeit nicht in Bottom Nav | EmployeePortalShell / ClientPortalShell | hoch bei Execute | **wrappen** via `HealthOSPortalShell` |
| **PortalMobileNav** | `src/components/layout/PortalMobileNav.tsx` | Portale mobile | Klient, MA | 5 feste Bottom-Tabs | Deep-Routes (Budget, Execute) fehlen absichtlich | `HealthOSMobileBottomNav` (neu, parallel) | mittel | **parallel** — H5/H6 Adoption |
| **PortalTopBar** | `src/components/layout/portal/PortalTopBar.tsx` | Portale | Klient, MA | App Bar, Hamburger | — | PlatformTopbar | niedrig | **wrappen** |
| **EmployeePortalShell** | `src/components/portal/EmployeePortalShell.tsx` | MA-Portal | Mitarbeitende | PortalShell + Permission-Onboarding | **P0 Execute** onboarding gate | PortalShell | **rot** | **behalten** — nicht ersetzen in H2 |
| **ClientPortalShell** | `src/components/portal/ClientPortalShell.tsx` | Klient-Portal | Klient:innen | Dünner PortalShell-Wrapper | — | PortalShell | niedrig | **behalten** |
| **officeNav** | `src/lib/navigation/modulenav/officenav.ts` | Office Sidebar | Office-Rollen | Legacy-Nav-Gruppen | `/business/office/*` gemischt | HealthOS Office Nav (neu) | mittel | **konsolidieren später** (H3) |
| **assistNav** | `src/lib/navigation/modulenav/assistnav.ts` | Assist Sidebar | Assist | Legacy Assist-Nav | fehlende HealthOS-Zielstruktur | HealthOS Assist Nav (neu) | niedrig | **konsolidieren später** (H4) |
| **portalMobileTabs** | `src/lib/navigation/portalMobileTabs.ts` | Portale mobile | Klient, MA | Feste 5 Tabs | Budget/Execute hidden by design | HealthOS Portal Nav | niedrig | **behalten** + HealthOS planen |
| **NotificationBellFab** | `src/components/notifications/notificationcenter.tsx` | Platform + Portal | alle | FAB Glocke | — | — | niedrig | **Slot** via `HealthOSNotificationArea` |
| **MobilePlatformContextPanel** | `src/components/layout/platform/mobileplatformcontextpanel.tsx` | Mobile Platform | Office/Assist | Kontext unter Main | — | — | niedrig | **behalten** |

**Keine bestehende Shell gelöscht.**

---

## 2. Neue H2-Shell-Komponenten

| # | Komponente | Datei | Zweck |
|---|------------|-------|-------|
| 1 | HealthOSAppShell | `shell/HealthOSAppShell.tsx` | Slot-basierte Root-Shell (Sidebar, TopBar, Main, Detail, BottomNav) |
| 2 | HealthOSDesktopSidebar | `shell/HealthOSDesktopSidebar.tsx` | Config-gesteuerte Desktop-Sidebar mit visible/disabled |
| 3 | HealthOSMobileBottomNav | `shell/HealthOSMobileBottomNav.tsx` | Mobile Bottom Nav aus `ShellTabConfig[]` |
| 4 | HealthOSTopBar | `shell/HealthOSTopBar.tsx` | Präsentations-TopBar (kein Auth) |
| 5 | HealthOSBreadcrumbs | `shell/HealthOSBreadcrumbs.tsx` | Wrapper um `BreadcrumbBar` |
| 6 | HealthOSRoleNavigation | `shell/HealthOSRoleNavigation.tsx` | Sidebar + Mobile aus zentraler Nav-Config |
| 7 | HealthOSTenantContext | `shell/HealthOSTenantContext.tsx` | Mandanten-/Modul-Chip (Props only) |
| 8 | HealthOSNotificationArea | `shell/HealthOSNotificationArea.tsx` | Slot für Glocke/Blocker-Banner |
| 9 | HealthOSPortalShell | `shell/HealthOSPortalShell.tsx` | Dünner Wrapper → `PortalShellLayout` |
| 10 | HealthOSModuleShell | `shell/HealthOSModuleShell.tsx` | Office/Assist Modul-Shell → `HealthOSAppShell` |

Barrel: `src/components/healthos/shell/index.ts` · Public API: `src/components/healthos/index.ts`

**Keine Produktionsseite automatisch umgestellt.**

---

## 3. Navigation-Konfiguration

Zentrale Datei: `src/components/healthos/navigation/healthosNavigationConfig.ts`

| Rolle | Config | Sichtbare Bereiche (Auszug) | Hidden (P0 / unfertig) | Disabled (geplant) |
|-------|--------|------------------------------|------------------------|-------------------|
| **Office** | `HEALTHOS_OFFICE_NAV` | Command Center, Klient:innen, MA, Einsätze, Dokumente, WFM, Abrechnung, Kommunikation, QM, Settings | Budgets | Nachweise (Office-Hub) |
| **Assist** | `HEALTHOS_ASSIST_NAV` | Dashboard, Planung, Live, Nachweise, Qualität, Settings | Budgets | Leistungsarten, Kommunikation |
| **MA-Portal** | `HEALTHOS_EMPLOYEE_PORTAL_NAV` | Heute, Einsätze, Nachrichten, Profil | Aktueller Einsatz (Execute), Meine Zeiten (WFM) | Urlaub, Dokumente/Schulungen |
| **Klient-Portal** | `HEALTHOS_CLIENT_PORTAL_NAV` | Übersicht, Termine, Dokumente, Nachrichten, Stammdaten | Budget | Nachweise, Hilfe |

Resolver: `resolveHealthOSNavigation.ts` — `getVisibleNavItemsForRole`, `toMobileShellTabs`, `filterNavItemsByRole`

Visibility-Modell: `visible` | `disabled` | `hidden` — **keine** Demo-/„Coming soon“-Texte im Live-UI.

---

## 4. Dual-Routing-Befund

Quelle: H0 + `healthosDualRoutingPlan.ts`

| Canonical Key | Primary | Alternate | Risiko |
|---------------|---------|-----------|--------|
| office-dashboard | `/office` | `/business/office` | medium |
| office-clients | `/office/clients` | `/business/office/clients` | **high** |
| office-time-tracking | `/business/office/time-tracking` | `/office/time-tracking` | **high** (P0 WFM) |
| office-qm | `/business/office/qm` | `/office/qm` | medium |
| office-access | `/business/office/access` | `/office/access` | medium (Modal) |
| office-settings | `/business/office/modules` | `/business/office/settings` | low |

### Zielrouting-Plan (nur dokumentiert)

1. **H2:** HealthOS-Nav referenziert bestehende Routen — **keine Redirects**
2. **H3:** Office Command Center unter `/office` konsolidieren
3. **H7:** Soft-/301-Aliase für verbleibende `/business/office/*` Deep-Links nach expliziter Freigabe

**H2:** Keine Produktionsroute entfernt, keine harte Umschaltung.

---

## 5. Mobile / Desktop Strategie

Regeln: `shell/healthosShellLayoutRules.ts`

| Breakpoint | Sidebar | TopBar | Main | Bottom Nav | Detail Panel |
|------------|---------|--------|------|------------|--------------|
| Desktop ≥1280 | voll, collapsible | voll + Breadcrumbs | flex | aus | optional |
| Tablet 768–1279 | kompakt, touch 48px | voll | flex | aus | — |
| Mobile <768 | aus | kompakt | task-focused | max 5 Tabs | — |

**Portal mobile-first:** Employee/Client — Bottom Nav vorbereitet; Execute-Workflow (`EmployeePortalVisitExecutionScreen`) **unberührt**.

---

## 6. Bewusst nicht angefasst (rote Zonen)

- `src/features/assistWorkflow/finalizeVisit.ts` — Finalize/Proof
- `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx` — MA Execute
- Assist Assignment Detail Workflow
- Budget-/WFM-/Proof-/Portal-Sync-Services
- RLS, Migrationen
- `platformshell.tsx`, `officenav.ts`, `assistnav.ts` — **unverändert**
- Kein Deploy, kein `[deploy]`

---

## 7. Tests

| Suite | Datei | Tests | Ergebnis |
|-------|-------|-------|----------|
| H2 Shell + Nav | `src/__tests__/healthos/healthosShellNavigation.test.ts` | 32 | ✅ grün |
| H1 Foundation | `src/__tests__/healthos/healthosFoundation.test.ts` | 18 | ✅ grün |
| H1 Status | `src/__tests__/healthos/healthosStatusMapping.test.ts` | 9 | ✅ grün |
| P0.1 WFM RPC | `src/__tests__/wfm/wfmAssistAdapterRpc.test.ts` | 5 | ✅ grün |
| P0.1 Finalize/Proof | `src/__tests__/assistWorkflow/finalizeVisitProof.test.ts` | 5 | ✅ grün |

Abgedeckt: Nav-Bereiche pro Rolle, hidden/disabled, keine P0-Imports in Shell, Dual-Routing nur Daten, rote Dateien ohne HealthOS-Referenz.

---

## 8. Risiken

| Risiko | Bewertung | Mitigation |
|--------|-----------|------------|
| HealthOS-Nav divergiert von Live-`officeNav` | mittel | H3 Mapping-Tabelle; H2 nur parallel |
| `HealthOSPortalShell` ohne Onboarding | mittel | EmployeePortalShell weiter produktiv |
| Dual-Route-Verwirrung | hoch | Deprecation-Plan H7, keine H2-Redirects |
| WFM/Budget in Nav sichtbar gemacht | hoch | hidden/disabled in Config |

---

## 9. Empfehlung für H3

**Go** — H2 liefert adoptierbare Wrapper und Nav-Plan ohne Produktionsrisiko.

H3 Fokus:
1. Office Command Center unter `HealthOSModuleShell` + schrittweise Sidebar-Migration
2. Mapping `officeNav` → `HEALTHOS_OFFICE_NAV` (href-Abgleich)
3. Erste Seite: `/office` Dashboard — **ohne** Budget/WFM/Finalize-Logik anzufassen
4. Dual-Routing: nur interne Links auf canonical `/office/*` vorbereiten

---

## Geänderte / neue Dateien (H2)

```
src/components/healthos/navigation/types.ts
src/components/healthos/navigation/healthosNavigationConfig.ts
src/components/healthos/navigation/healthosDualRoutingPlan.ts
src/components/healthos/navigation/resolveHealthOSNavigation.ts
src/components/healthos/navigation/index.ts
src/components/healthos/shell/healthosShellLayoutRules.ts
src/components/healthos/shell/HealthOSAppShell.tsx
src/components/healthos/shell/HealthOSDesktopSidebar.tsx
src/components/healthos/shell/HealthOSMobileBottomNav.tsx
src/components/healthos/shell/HealthOSTopBar.tsx
src/components/healthos/shell/HealthOSBreadcrumbs.tsx
src/components/healthos/shell/HealthOSRoleNavigation.tsx
src/components/healthos/shell/HealthOSTenantContext.tsx
src/components/healthos/shell/HealthOSNotificationArea.tsx
src/components/healthos/shell/HealthOSPortalShell.tsx
src/components/healthos/shell/HealthOSModuleShell.tsx
src/components/healthos/shell/index.ts
src/components/healthos/index.ts (exports erweitert)
src/__tests__/healthos/healthosShellNavigation.test.ts
docs/audit/healthos-h2-shell-navigation-report.md
```
