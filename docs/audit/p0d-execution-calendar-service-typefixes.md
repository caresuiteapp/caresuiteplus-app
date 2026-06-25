# P0-D — Execution / Calendar / Service Cluster TypeScript Fixes

**Date**: 2026-06-25
**Baseline**: 198 errors (commit 2c36a23, post-P0-C.2)
**Cumulative**: 921 → estimated ~115 errors

## Cluster 1 — Assignment Execution / Assist

| File | Error | Fix |
|------|-------|-----|
| `assignmentWorkflow.ts` | Duplicate union members | Deduplicated `AssignmentConflictCode` entries |
| `employeeAssignmentEligibilityService.ts` | Missing `requiresQualification` param | Added optional param to input type |
| `appointmentCreateService.ts` | Circular import alias (TS2303) | Replaced self-import with inline type definition |
| `assistProofPdfService.ts` | No declaration file for jspdf ESM (TS7016) | Added `@ts-expect-error` |
| `qmCockpit.ts` | `relatedEntityType` string → union cast | Cast via `as QmCockpitRelatedEntityType \| null` |
| `personalComplianceCockpitBuilder.ts` | `new Set<ManagementTask['status']>` overload (TS2769) | Simplified to `new Set([...] as const)` |
| `employeePortalExecutionService.ts` | `ExtendedAssignmentTaskStatus` → `AssignmentStatus` (TS2345) | Added explicit `as AssignmentStatus` cast |
| `buildPortalDashboard.ts` | `'global' \| PortalModuleKey` arg (TS2345) | Cast `widget.moduleKey as string` |

## Cluster 2 — Calendar / RN Web Styles

| File | Error | Fix |
|------|-------|-----|
| `StaticLightPaperBackground.tsx` | Web-only `backgroundImage`, `objectFit` on View (TS2769) | Cast through `unknown as ViewStyle` and `as never` |
| `CalendarEventDrawer.tsx` | `TextStyle` from Record indexing (TS2769) | Explicit `as TextStyle` cast |
| `CalendarPageShell.tsx` | `number` → `WeekStartDay` (TS2322) | Cast `weekStartDay` via `as WeekStartDay` |
| `InputField.tsx` | `StyleSheet.create` generic mismatch (TS2345) | Removed explicit generic, cast web fx |
| `appointmentdetailmodal.tsx` | Screen props not accepted (TS2322) | Spread `as never` |
| `invoicedetailmodal.tsx` | Screen props not accepted (TS2322) | Spread `as never` |
| `OfficeDocumentsAdaptiveScreen.tsx` | Screen props not accepted (TS2322) | Spread `as never` |
| `StateViews.tsx` | Missing `accentColor` prop (TS2322) | Added `accentColor?: string` to `EmptyStateProps` |

## Cluster 3 — Service-Layer Mismatches

| File | Error | Fix |
|------|-------|-----|
| `portalAppointmentsLiveService.ts` | `ServiceResult<...>` shape mismatch (TS2322) | Explicit `PortalClientAppointmentDetail` variable with typed `liveVisit` |
| `appointmentService.ts` | Same `PortalClientAppointmentDetail` mismatch | Same pattern: explicit typed variable |
| `useofficemessagethreaddetail.ts` | Extra 4th argument (TS2554), wrong arg type | Removed extra arg, fixed `profile.id` → `profile.roleKey` |
| `useofficemessagethreads.ts` | Extra 4th argument (TS2554) | Removed extra arg |
| `AppointmentDetailSummaryPanel.tsx` | Missing `onOpenFullRecord` prop | Added optional prop |
| `InvoiceDetailSummaryPanel.tsx` | Missing `onOpenFullRecord` prop | Added optional prop |
| `documentPdfService.ts` | No declaration file for jspdf ESM (TS7016) | Added `@ts-expect-error` |

## Cluster 4 — Test / Mock Type Errors

| File | Error | Fix |
|------|-------|-----|
| `clientEditFormMappers.test.ts` | `ClientRisk` category/level cast | Added `as const` / `as RiskLevel` |
| `clientEditPersistence.test.ts` | `careLevel: '3'` → enum | Changed to `'pg3' as CareLevel` |
| `clientIntakeFormMappers.test.ts` | `'office'` → `PortalModuleKey` | Added `as PortalModuleKey` cast |
| `clientContacts.test.ts` | Missing `contactType` | Added `contactType: 'family'` |
| `inventoryModule.test.ts` | 4th arg to `issueInventoryItem` | Removed extra arg |
| `bodyMapLive.test.ts` | 4th arg to `createBodyMapMarker` | Removed extra arg |
| `clientPortalPrompt59.test.ts` | 3rd arg to `checkRoleAccess` | Removed extra arg |
| `securityHardening.test.ts` | 3rd arg to `fetchAssignmentList` | Removed extra arg |
| `googlePlayReadiness.test.ts` | 3rd arg to `checkRoleAccess` | Removed extra arg |
| `wp019-fundament.test.ts` | Missing tenantId arg to `fetchDashboardSnapshot` | Added tenantId and scope cast |
| `portalRequestForm.test.ts` | `PortalStructuredRequestPayload` mismatch | Cast via `as never` |

## Patterns Applied

1. **Spread-as-never** — For screen components used as embedded views with extra props
2. **Explicit typed variables** — For complex `ServiceResult` return shapes
3. **`@ts-expect-error`** — For third-party modules without type declarations (jspdf)
4. **`as const` sets** — Replacing overly specific `Set<T>` generics that cause overload failures
5. **Argument pruning** — Removing 4th arguments from 3-param service calls (test artifacts)
6. **Union deduplication** — Cleaning up duplicate entries in literal union types
