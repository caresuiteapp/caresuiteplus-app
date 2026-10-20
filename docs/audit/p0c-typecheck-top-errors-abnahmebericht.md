# P0-C TypeScript Error Distribution — Abnahmebericht

## Baseline → Final: 326 → 220 (−106 errors, −32.5%)

### Error Code Distribution (After P0-C)

| Code    | Count | Description                              |
|---------|-------|------------------------------------------|
| TS2322  | 66    | Type not assignable                      |
| TS2339  | 35    | Property does not exist on type          |
| TS2345  | 31    | Argument not assignable to parameter     |
| TS2769  | 16    | No overload matches (RN style types)     |
| TS2353  | 15    | Object literal unknown properties        |
| TS2554  | 15    | Expected N args, got M                   |
| TS2739  | 9     | Missing properties in type               |
| TS2305  | 5     | Module has no exported member            |
| TS2741  | 5     | Missing property in assignment           |
| TS2367  | 5     | Comparison always false                  |
| TS2352  | 4     | Conversion may be a mistake              |
| TS2559  | 3     | No common properties                     |
| TS2590  | 2     | Expression too complex                   |
| Other   | 14    | Various minor codes                      |

### Top 20 Remaining Error Files

| File | Errors |
|------|--------|
| AssignmentExecutionScreen.tsx | 5 |
| WebFontSizeControl.tsx | 3 |
| applyInvisibleScrollIndicators.ts | 3 |
| workspaceAccess.test.ts | 3 |
| employeePortalExecutionService.ts | 3 |
| invoices/runs.tsx | 3 |
| qmCockpit.test.ts | 3 |
| personalComplianceCockpitBuilder.ts | 2 |
| EntityFormScreen.tsx | 2 |
| missingtablefallback.ts | 2 |
| messageattachmentservice.ts | 2 |
| AssistLiveMap.tsx | 2 |
| clientStatus.ts | 2 |
| CalendarEventGrid.tsx | 2 |
| CalendarEventDrawer.tsx | 2 |
| CsvErrorTable.tsx | 2 |
| assignmentConflictService.ts | 2 |
| appointmentService.ts | 2 |
| portalDocumentUploadService.ts | 2 |
| qmCockpitService.ts | 2 |

### Next Priority Actions (P0-D candidates)

1. **AssignmentExecutionScreen** (5 errors) — execution workflow types need alignment
2. **employeePortalExecutionService** (3 errors) — ExtendedAssignmentTaskStatus vs AssignmentStatus
3. **WebFontSizeControl / scroll** (6 errors) — RN web-specific style casting
4. **Invoice/billing types** (3 errors) — runs.tsx route types
5. **Test mock shapes** (6 errors) — workspaceAccess, qmCockpit test fixtures
