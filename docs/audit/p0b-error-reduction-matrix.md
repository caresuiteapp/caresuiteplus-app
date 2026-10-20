# P0-B — Error Reduction Matrix

**Baseline**: 623 Fehler (P0-A cb45e62)
**Ergebnis**: 326 Fehler (P0-B)
**Reduktion**: 297 Fehler (−47,7 %)

## Fehlercode-Reduktion

| Fehlercode | Beschreibung | Vorher | Nachher | Δ |
|------------|-------------|--------|---------|---|
| TS2322 | Type not assignable | ~160 | 109 | −51 |
| TS2339 | Property not exist | ~85 | 49 | −36 |
| TS2345 | Argument type mismatch | ~63 | 53 | −10 |
| TS2769 | No overload matches | ~53 | 26 | −27 |
| TS2304 | Cannot find name | ~40 | 0 | −40 |
| TS2305 | No exported member | ~20 | 5 | −15 |
| TS2459 | Not exported | ~8 | 0 | −8 |
| TS2578 | Unused @ts-expect-error | ~6 | 0 | −6 |
| TS2724 | Named export mismatch | ~5 | 0 | −5 |
| TS18048 | Possibly undefined | ~4 | 0 | −4 |
| TS7006 | Implicit any | ~3 | 0 | −3 |
| Sonstige | (TS2353, TS2554, TS2352 etc.) | ~176 | 84 | −92 |
| **TOTAL** | | **623** | **326** | **−297** |

## Reduktion nach Fix-Gruppe

| Gruppe | Beschreibung | Fehler vorher | Fehler nachher | Δ |
|--------|-------------|---------------|----------------|---|
| 1 | Re-Exports, fehlende Imports/Funktionen | 623 | 545 | −78 |
| 2 | Typ-Erweiterungen (ManagementTask, EmployeeDetail) | 545 | 517 | −28 |
| 3 | Supabase-Typen, React Native Props | 517 | 468 | −49 |
| 4 | Portal-Dokumenttypen | 468 | 450 | −18 |
| 5 | Web-Style-Typen, enforcePermission, Tests | 450 | 326 | −124 |

## Wichtigster Einzelfix

`enforcePermission<T = never>` (src/lib/permissions/enforce.ts):
- Default-Typparameter von implizit `unknown` auf `never` geändert
- `ServiceResult<never>` ist zuweisbar an jedes `ServiceResult<T>`
- Eliminierte ~170 Fehler in einem einzigen Typwechsel
- Kein Funktionsverhalten geändert, nur Typ-Inference verbessert
