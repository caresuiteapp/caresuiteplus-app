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

## Data model (migration `0099_adaptive_portal_engine.sql`)

| Table | Scope | Purpose |
|-------|-------|---------|
| `client_module_assignments` | tenant + client | Which modules apply (`assist`, `pflege`, `stationaer`, `beratung`); extended with `is_primary`, `is_active`, `assigned_by` |
| `portal_feature_matrix` | global | Feature catalog per module (nav + permissions) |
| `portal_widget_registry` | global | Dashboard widget metadata and priority |
| `portal_visibility_rules` | tenant | Role-based feature visibility (`client`, `relative`, `guardian`, `invoice_recipient`) |

RLS: portal users read their own client's active assignments; office staff manage assignments with `office.clients.edit`.

## Module matrix

| Module | Example features | Terminology highlight |
|--------|------------------|----------------------|
| `assist` | Termine, Fahrten, Betreuungsteam | Termin |
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

UI entry: `AdaptivePortalOverview` on `/portal/client`, wired via `usePortalContext`.

Office assigns modules on **Klient:in bearbeiten** (Portal-Module panel) and intake wizard (`assignedModules` → persisted on create).

## Phase 2 (not in this pass)

- Live widget backends per module (§45b budget, meds, SIS, Speiseplan API, Beratungsfälle)
- Module-scoped KPI queries (appointments by module)
- Release-flag enforcement (`requires_release` on visibility rules)
- Relative/guardian/invoice-recipient role variants from contact linkage
- Detail views as modals/drawers per widget
