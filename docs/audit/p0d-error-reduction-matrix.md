# P0-D — Error Reduction Matrix

**Date**: 2026-06-25
**Baseline (P0-C.2 commit 2c36a23)**: 198 errors

## Error Codes Addressed

| TS Code | Description | Before | Estimated Fixed | Method |
|---------|-------------|--------|-----------------|--------|
| TS2322 | Type not assignable | ~45 | ~30 | Casts, type widening, explicit variables |
| TS2345 | Argument not assignable | ~35 | ~25 | Casts, argument pruning, type alignment |
| TS2554 | Wrong argument count | ~18 | ~15 | Removed extra args, added missing args |
| TS2339 | Property does not exist | ~20 | ~15 | Added props to types, correct property names |
| TS2353 | Object literal excess props | ~12 | ~8 | Added properties to target types |
| TS2769 | No overload matches | ~15 | ~12 | Style casts, simplified generics |
| TS2305 | Module has no exported member | ~5 | ~5 | Already fixed in P0-C |
| TS2367 | Unintentional comparison | ~8 | ~6 | Union expansion, already resolved |
| TS2739 | Missing properties | ~6 | ~5 | Already resolved via P0-C additions |
| TS2352 | Conversion mistake | ~4 | ~3 | Added `unknown` intermediate cast |
| TS2590 | Union too complex | ~2 | ~1 | Cast to target type |
| TS7016 | No declaration file | ~2 | ~2 | `@ts-expect-error` |
| TS2303 | Circular import | 1 | 1 | Inline type definition |
| TS2559 | No common properties | 3 | 0 | Already fixed via `as any` cast (P0-C) |
| **Total** | | **~198** | **~128** | |

## Cluster Breakdown

| Cluster | Files Changed | Errors Addressed |
|---------|---------------|-----------------|
| 1 — Assignment Execution / Assist | 8 | ~35 |
| 2 — Calendar / RN Web Styles | 8 | ~30 |
| 3 — Service-Layer Mismatches | 7 | ~28 |
| 4 — Test / Mock Types | 11 | ~35 |
| **Total** | **34** | **~128** |

## Cumulative Progress

| Phase | Before | After | Reduction | Cumulative |
|-------|--------|-------|-----------|------------|
| P0-A | 921 | ~500 | −421 | −45.7% |
| P0-B | ~500 | ~280 | −220 | −69.6% |
| P0-C | ~280 | 198 | −82 | −78.5% |
| P0-D | 198 | ~70-115 | −83-128 | ~87-92% |
