# Visible UI Internal Text Audit (U.1)

**Date:** 2026-06-21  
**Scope:** User-facing surfaces — Office, Assist, Clients, Employees, Portals, Tenant center

## Files cleaned (representative)

| File | Before | After |
|------|--------|-------|
| `clientExtendedRepository.supabase.ts` | `profiles(display_name)` | `profiles(first_name, last_name, full_name)` |
| `assistSetupHints.ts` | Supabase, 0156, assist_location_points | German cloud/persistence labels |
| `gpsTrackingConfig.ts` | Table names in banners | User-facing tracking messages |
| `AssistLiveStatusScreen.tsx` | assist_location_points | Kartenansicht / Standortdaten |
| `EmployeePortalImpactPanel.tsx` | budgetCents keys, Core folgt später | Friendly badge labels |
| `tenantCenterSections.ts` | Core K.0 / K.1 | Leistungsarten-/Budget-Vorlagen |
| `TenantCenterSectionCard.tsx` | Teilweise / Offen | In Arbeit / Ausstehend |
| `FormScreenHero.tsx` | WP, Supabase Live | Modus / Bereit |
| `AssignmentCreateScreen.tsx` | wpNumber, demo persistenz meta | Clean assist create hero |

## Edit flow changes

| Surface | Old | New |
|---------|-----|-----|
| Client record edit | `ClientIntakeModal mode=edit` (wizard) | `ClientSectionEditModal` |
| Employee record edit | `EmployeeEditModal` + 4-step wizard | `EmployeeSectionEditModal` |
| Modal shell | Ad-hoc Modal + GlassSurface | `AppGlassModal` → `PlatformModal` |

## Remaining internal text (allowed)

- Developer hub, tests, lib/services, migrations, types — not user-visible
- `ClientEditModal` retained for modal-stack `prep.client.edit` route (legacy stack entry)

## Verification

- `src/__tests__/ui/visibleUiRealityFix.test.ts`
- `src/__tests__/clients/clientRecordUi.test.ts`
- `src/__tests__/assist/assistNavigation.test.ts`
