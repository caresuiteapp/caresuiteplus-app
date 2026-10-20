# Adaptive Klient:innenportal Engine

One **Portal Engine** composes the Klient:innenportal from module assignments, portal role, and release permissions — not four separate portal apps.

## Architecture

```
Login / session load
  → resolvePortalContext(tenant, client, role)
      → client_module_assignments (live)
      → portal_visibility_rules (tenant)
      → portal_feature_matrix + portal_widget_registry (catalog)
      → live KPI metrics (messages, appointments)
  → buildPortalNavigation(context)   // bottom tabs
  → buildPortalDashboard(context)    // ordered glass widgets
  → portalTerminology(primaryModule) // Termin vs Einsatz vs Bewohnertermin
```

## Data model (migration `0099_adaptive_portal_engine.sql` + `0102_portal_assist_workflows.sql`)

| Table | Scope | Purpose |
|-------|-------|---------|
| `client_module_assignments` | tenant + client | Which modules apply (`assist`, `pflege`, `stationaer`, `beratung`); extended with `is_primary`, `is_active`, `assigned_by` |
| `portal_feature_matrix` | global | Feature catalog per module (nav + permissions) |
| `portal_widget_registry` | global | Dashboard widget metadata and priority |
| `portal_visibility_rules` | tenant | Role-based feature visibility (`client`, `relative`, `guardian`, `invoice_recipient`) |
| `portal_requests` | tenant + client | Client portal requests (Terminänderung, Rückruf, Upload, …) |
| `portal_request_status_history` | tenant | Status audit trail per request |
| `portal_activities` | tenant + client | Activity feed for overview |
| `portal_budget_snapshots` | tenant + client | §45b/§45a budget display snapshots |

RLS: portal users read/write own client requests; office staff read/update with `office.access`.

## Assist portal (primary module = `assist`)

When `client_module_assignments.is_primary = assist`, the overview uses **AssistPortalOverview** instead of the generic widget grid:

1. **PortalGlassHero** — name, mandant, role, freigabe
2. **Dynamic nav** — `buildPortalNavigation` expands assist features from `portal_feature_matrix` (Betreuung, Begleitungen, Budget, Nachweise, Anfragen, Hilfe)
3. **PortalNextAppointmentHero** — next assignment from live `assignments` table
4. **KPI grid** — Termine, Nachrichten, Dokumente, Nachweise, Unterschriften, Budget, Anfragen, Begleitungen (hidden when `trips` not released)
5. **PortalQuickActions** — each CTA calls `createPortalRequest` or navigates to real screens
6. **Activity feed** — `portal_activities`
7. **Budget section** — `portal_budget_snapshots` when released + data exists

Services: `src/lib/portal/assist/` (`portalRequestService`, `portalActivityService`, `portalAssistDashboardService`, `portalBudgetService`).

Office visibility: `PortalRequestsOfficePanel` on client portal access tab queries `portal_requests` via office RLS.

Client-facing rename: **Assist-Fahrten → Begleitungen** (feature matrix + widget registry). Widget hidden when `trips` feature not visible.

## Module matrix

| Module | Example features | Terminology highlight |
|--------|------------------|----------------------|
| `assist` | Termine, Begleitungen, Betreuungsteam, Budget, Nachweise, Anfragen | Termin |
| `pflege` | Pflegeplan, Vitalwerte, Medikation | Einsatz (highest dashboard priority) |
| `stationaer` | Speiseplan, Aktivitäten, Zimmer | Bewohnertermin |
| `beratung` | Beratungstermine, Fälle, Nachsorge | Beratungstermin |

Combined clients get **Übersicht** + per-module tabs + global **Dokumente / Nachrichten / Profil**.

## TypeScript engine (`src/lib/portal/engine/`)

- `resolvePortalContext.ts` — I/O boundary; loads assignments + rules + metrics
- `buildPortalNavigation.ts` — dynamic tab items
- `buildPortalDashboard.ts` — widget ordering (Pflege first when active)
- `portalTerminology.ts` — module-specific labels
- `portalVisibility.ts` — role + rule filtering

UI entry: `AdaptivePortalOverview` on `/portal/client` — routes to `AssistPortalOverview` when primary module is `assist`. Wired via `usePortalContext`.

Office assigns modules on **Klient:in bearbeiten** (Portal-Module panel) and intake wizard (`assignedModules` → persisted on create).

## Phase 2 (not in this pass)

- Employee portal sync for portal requests
- Full budget from billing (not snapshots)
- Service proofs PDF generation
- Module-scoped KPI queries (appointments by module) for non-assist modules
- Release-flag enforcement (`requires_release` on visibility rules)
- Relative/guardian/invoice-recipient role variants from contact linkage
- Detail views as modals/drawers per widget (pflege, stationaer, beratung)
