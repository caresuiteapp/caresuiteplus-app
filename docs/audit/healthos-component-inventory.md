# CareSuite+ HealthOS — Komponenten-Inventur (H0)

**Stand:** 2026-07-02  
**Ziel:** Bestand erfassen, Duplikate identifizieren, HealthOS-Standard definieren.

---

## Shells & Layouts

| Komponente | Pfad | Verwendung | Qualität | Wiederverwendbar | Duplikate | Empfehlung |
|------------|------|------------|----------|------------------|-----------|------------|
| `PlatformShell` | `src/components/layout/platform/platformshell.tsx` | Office, Assist, Business | hoch (Desktop) | mittel | CareDesktopShell, CompactPlatformShell | **→ HealthOSShell (office)** |
| `PortalShellLayout` | `src/components/layout/portal/PortalShellLayout.tsx` | Beide Portale | hoch | hoch | — | **→ HealthOSShell (portal)** |
| `ModuleDashboardShell` | `src/components/layout/platform/moduledashboardshell.tsx` | Dashboards | gut | hoch | CareLightModuleDashboard | **→ HealthOSPage** |
| `ScreenShell` | `src/components/layout/ScreenShell.tsx` | Detail screens | mittel | mittel | CareLightScreen | merge |
| `PortalTabScreen` | `src/screens/portal/PortalTabScreen.tsx` | Portal tabs | mittel | portal-only | — | **→ HealthOSPage (portal)** |
| `ModuleNavSidebar` | `modulenavsidebar.tsx` | Office/Assist nav | gut | modul-spezifisch | ShellNavigationDrawer | **→ HealthOSNavSidebar** |
| `MainModuleRail` | `mainmodulerail.tsx` | Produktwechsel | gut | global | ModuleSwitcher | keep, restyle |
| `PortalMobileNav` | `PortalMobileNav.tsx` | Portal bottom | gut | portal | CareLightBottomNav, AppTabBar | **→ HealthOSMobileNav** |
| `PageHeader` / `ActionToolbar` | `platform/*` | Listen, Dashboards | gut | hoch | CareLightPageHeader | **→ HealthOSPageHeader + HealthOSActionToolbar** |

---

## Cards, Tabellen, Status

| Komponente | Pfad | Verwendung | Qualität | Duplikate | Empfehlung |
|------------|------|------------|----------|-----------|------------|
| `PremiumCard` | `ui/PremiumCard.tsx` | überall | gut | CareLightCard, AuroraGlassCard, GlassCard | **→ HealthOSCard** |
| `PremiumBadge` | `ui/PremiumBadge.tsx` | Status | gut | AuroraBadge | **→ HealthOSStatusBadge** |
| `PremiumKpiCard` | `ui/PremiumKpiCard.tsx` | Dashboards | gut | CareLightKpiCard, ModuleOverviewKpiCard | **→ HealthOSMetricCard** |
| `PremiumDataTable` | `ui/PremiumDataTable.tsx` | Office Listen | gut | — | **→ HealthOSDataTable** |
| `AssignmentCompactCard` | `assist/AssignmentCompactCard.tsx` | Assist/Portal lists | gut | — | **→ HealthOSVisitCard** |
| `VisitProofPreviewPanel` | `assist/VisitProofPreviewPanel.tsx` | Proof review | spezifisch | — | **→ HealthOSProofCard** |
| `ClientBudgetAccountsGrid` | `office/ClientBudgetAccountsGrid.tsx` | Budget | gut | — | **→ HealthOSBudgetBar/Card** |
| `PortalDocumentDetailHero` | `portal/PortalDocumentDetailHero.tsx` | Doc detail | gut | — | **→ HealthOSDocumentCard** |
| `AssistExecutionProblemInboxPanel` | `assist/AssistExecutionProblemInboxPanel.tsx` | Blocker | basic | — | **→ HealthOSBlockerCard** |
| `Timeline` | `ui/Timeline.tsx` | Status history | selten | — | **→ HealthOSTimeline** |
| `SectionPanel` | `ui/SectionPanel.tsx` | Form sections | gut | CareLightSection | **→ HealthOSSection** |

---

## Modals & Drawer

| Komponente | Pfad | Empfehlung |
|------------|------|------------|
| `PlatformModal` / `AppGlassModal` | `platform/*` | **→ HealthOSModal** |
| `PortalNavigationDrawer` | `portal/PortalNavigationDrawer.tsx` | **→ HealthOSDrawer** |
| Office message modals (5+) | `office/officemessage*.tsx` | konsolidieren unter HealthOSModal |

---

## Buttons & Inputs

| Komponente | Pfad | Empfehlung |
|------------|------|------------|
| `PremiumButton` | `ui/PremiumButton.tsx` | **→ HealthOSActionButton** |
| `AuroraGradientButton` | `aurora/*` | merge → primary variant |
| `CareLightButton` | `ui/CareLightButton.tsx` | deprecate |
| `PremiumInput` | `ui/PremiumInput.tsx` | **→ HealthOSFormField** |
| `SegmentedTabs` | `ui/SegmentedTabs.tsx` | **→ HealthOSTabs** |

---

## Design-System-Fragmentierung (Hauptproblem)

Parallel existieren **Aurora** (`src/components/aurora/`), **Premium** (`src/components/ui/`), **CareLight** (`src/components/layout/CareLight*`), **Glass** (`src/design/components/GlassCard.tsx`).

HealthOS H1 muss **eine** Token-Schicht + **23 Zielkomponenten** als Wrapper definieren — keine Workflow-Imports.

---

## HealthOS-Zielkomponenten (23) — Mapping Alt → Neu

| # | HealthOS | Ersetzt primär | Priorität |
|---|----------|----------------|-----------|
| 1 | HealthOSPage | ModuleDashboardShell, PortalTabScreen | H1 |
| 2 | HealthOSSection | SectionPanel, CareLightSection | H1 |
| 3 | HealthOSCard | PremiumCard, AuroraGlassCard, GlassCard | H1 |
| 4 | HealthOSMetricCard | PremiumKpiCard, ModuleOverviewKpiCard | H1 |
| 5 | HealthOSStatusBadge | PremiumBadge, AuroraBadge | H1 |
| 6 | HealthOSActionButton | PremiumButton, AuroraGradientButton | H1 |
| 7 | HealthOSTimeline | Timeline | H4 |
| 8 | HealthOSDataTable | PremiumDataTable | H2 |
| 9 | HealthOSDetailPanel | Side panels, modals | H2 |
| 10 | HealthOSFormField | PremiumInput | H1 |
| 11 | HealthOSModal | PlatformModal, AppGlassModal | H2 |
| 12 | HealthOSDrawer | PortalNavigationDrawer | H2 |
| 13 | HealthOSAlert | scattered alerts | H1 |
| 14 | HealthOSBlockerCard | AssistExecutionProblemInboxPanel rows | H3/H4 |
| 15 | HealthOSBudgetBar | ClientBudgetAccountsGrid bars | H3 |
| 16 | HealthOSTimeAccountCard | WFM session cards | H3/H5 |
| 17 | HealthOSProofCard | VisitProofPreviewPanel | H4 |
| 18 | HealthOSDocumentCard | PortalDocumentDetailHero | H6 |
| 19 | HealthOSVisitCard | AssignmentCompactCard | H4/H5 |
| 20 | HealthOSPortalHeader | PortalTopBar | H2 |
| 21 | HealthOSCommandCenter | OfficeIndexScreen layout | H3 |
| 22 | HealthOSMobileBottomNav | PortalMobileNav, AppTabBar | H2 |
| 23 | HealthOSDesktopSidebar | ModuleNavSidebar | H2 |

**Fehlend (neu anlegen):** alle 23 unter `src/components/healthos/` (H1).

**Zu entfernen (später):** CareLightButton, redundante Aurora/CareLight Card-Varianten nach Migration.
