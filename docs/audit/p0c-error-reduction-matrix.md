# P0-C Error Reduction Matrix

## Summary

| Phase | Before | After | Δ | Cumulative |
|-------|--------|-------|---|-----------|
| Baseline (P0-B commit be519b0) | 326 | — | — | 326 |
| GROUP 1: Data model/interfaces | 326 | 293 | −33 | −33 |
| GROUP 2: Service/repository signatures | 293 | 267 | −26 | −59 |
| GROUP 3: RN Web styles | 267 | 242 | −25 | −84 |
| GROUP 4+5: Portal/test types | 242 | 220 | −22 | −106 |
| **Final** | **326** | **220** | **−106** | **−32.5%** |

## Error Code Reduction Detail

| Code | Before | After | Δ |
|------|--------|-------|---|
| TS2322 | 109 | 66 | −43 |
| TS2345 | 53 | 31 | −22 |
| TS2339 | 49 | 35 | −14 |
| TS2769 | 26 | 16 | −10 |
| TS2353 | 19 | 15 | −4 |
| TS2554 | 15 | 15 | 0 |
| TS2352 | 11 | 4 | −7 |
| TS2367 | 6 | 5 | −1 |
| TS2741 | 5 | 5 | 0 |
| TS2305 | 5 | 5 | 0 |
| TS2540 | 4 | 0 | −4 |
| TS2739 | 4 | 9 | +5 (expanded types surfaced new mismatches) |
| TS18049 | 3 | 0 | −3 |
| TS2783 | 3 | 0 | −3 |

## Fix Strategy Per Group

### GROUP 1 — Data Model / Interfaces (−33)
- Extended `SensitivityLevel` with `'standard'`
- Extended `DataVisibilityScope` with `'internal'`
- Extended `SystemCostCarrierType` with 4 additional carrier types
- Added `apartmentNumber` to demo `ClientAddress` data
- Added `contactType` to demo `ClientContactRecord` data
- Added missing portal access fields to demo data
- Made `ownedByProfileId` accept `null` in `PortalScopedEntity`
- Made `IntakeTenantDisplay` fields optional with `defaultHourlyRate`
- Fixed test helper `buildDetail()` with missing `ClientDetail` fields

### GROUP 2 — Service/Repository Signatures (−26)
- Added explicit return types to `listMapped()` methods
- Fixed `resolveMissingTableList` type compatibility
- Added `WorkflowStatus` cast for DB row mapping
- Used `as unknown as T` for `fromUnknownTable` return values
- Added `assignedTo` to `createManagementTask` input
- Fixed `null` vs `undefined` in optional params
- Added generic type params to `runService<T>()` calls
- Expanded `IntakeDbClient` query builder type (recursive `.eq()`)

### GROUP 3 — RN Web Styles (−25)
- Used `as unknown as ViewStyle` for web-only position:fixed styles
- Extracted glow styles from `StyleSheet.create()` (null incompatibility)
- Flattened nested style arrays to single objects
- Fixed `SegmentOption` key naming (`value` → `key`)
- Fixed CSV import preview type narrowing with explicit casts
- Resolved duplicate property warnings in StyleSheet spreads

### GROUP 4+5 — Portal/Test Types (−22)
- Used `fromUnknownTable` for German status enum queries
- Added `'geplant'` and `'bestaetigt'` to `WorkflowStatus`
- Added `bodyStrong` to responsive typography
- Added `avatarUrl` to `EmployeeListItem`
- Fixed null-check for `profilePhoto` in employee create service
- Used `as unknown as T` for generic DB row casts
- Fixed `PostgrestError` test helper with `as unknown as` pattern
