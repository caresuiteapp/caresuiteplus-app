# P0-C Remaining Errors (220)

## Overview
After P0-C, 220 TypeScript errors remain (down from 326 baseline, 623 original P0-A).

## Remaining Error Breakdown by Category

### 1. Assignment/Execution Types (≈15 errors)
- `AssignmentExecutionScreen.tsx` (5) — workflow status enums, execution state shape
- `employeePortalExecutionService.ts` (3) — `ExtendedAssignmentTaskStatus` vs `AssignmentStatus`
- `assignmentConflictService.ts` (2) — type narrowing for conflict detection

### 2. RN Web Style Incompatibilities (≈20 errors)
- `WebFontSizeControl.tsx` (3) — Pressable/Text overload resolution
- `applyInvisibleScrollIndicators.ts` (3) — web-only DOM manipulation types
- `CalendarEventGrid.tsx` + `CalendarEventDrawer.tsx` (4) — style array compositions
- Various components using conditional web styles

### 3. Service Layer Type Mismatches (≈30 errors)
- Portal services: appointment, document upload, budget snapshots
- Invoice/billing runs route types
- Message attachment service
- Personal compliance cockpit builder
- QM cockpit service return types

### 4. Test Mock Shape Mismatches (≈15 errors)
- `workspaceAccess.test.ts` (3) — extra args, missing properties
- `qmCockpit.test.ts` (3) — deprecated filter options
- Various client tests with outdated fixture shapes

### 5. Remaining Infrastructure (≈10 errors)
- `missingtablefallback.ts` (2) — generic constraint refinements
- `clientStatus.ts` (2) — workflow transition validation
- Module export/import issues (TS2305)

## Phantom Tables (DOCUMENT ONLY — no errors caused)
These tables do NOT exist in the database and must NOT be created:
- `employee_time_entries`
- `assignment_executions`
- `proofs`
- `portal_releases`
- `live_operation_events`
- `employee_absences`

They cause zero typecheck errors currently. Queries against them use `fromUnknownTable()`.

## Recommended P0-D Priorities
1. Assignment/execution type unification (−15 potential)
2. Remaining RN web style patterns (−20 potential)
3. Service layer generic improvements (−15 potential)
4. Test fixture modernization (−10 potential)
