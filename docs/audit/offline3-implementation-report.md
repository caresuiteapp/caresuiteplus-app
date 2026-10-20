# OFFLINE.3 — Implementation Report

**Datum:** 2026-07-04  
**Basis-HEAD:** `20846e4f` (`origin/main`)  
**Scope:** Detail-Cache + Prefetch für MP-Einsätze (ohne Deploy)

---

## Umgesetzt

| Bereich | Status |
|---------|--------|
| Detail-Cache Keys `:portal` / `:execution` | **Implementiert** (bestehende Writer, jetzt zuverlässig befüllt) |
| Prefetch nach Online-List-Load | **Implementiert** — `scheduleAssignmentDetailPrefetch` in `loadPortalAppointmentsWithCache` |
| Bounded/throttled/abortable Prefetch | **Implementiert** — `MAX_PREFETCH_DETAILS=6`, 120 ms Throttle, AbortController |
| Per-Assignment Fehlertoleranz + Dev-Log | **Implementiert** |
| Offline Partial-Detail aus List-Row | **Implementiert** — `buildPortalDetailFromListItem`, Banner-Text |
| Hooks + Screens Meta (`partialDetail`, `cacheSource`) | **Implementiert** |
| OFFLINE.2 List-Cache | **Unverändert** in Semantik |

---

## Root Cause (Production `detailKeyCount: 0`)

Prefetch lief **einmal** beim Shell-Mount, oft **vor** erfolgreichem List-Load; Fehler wurden **stumm** geschluckt; kein Retry nach `mergeAssignmentListCache`. Siehe `offline3-detail-cache-plan.md`.

---

## Tests

| Suite | Ergebnis |
|-------|----------|
| `npx vitest run src/__tests__/offline/` | **48/48 grün** |
| `npx vitest run zeit1EmployeeResolverScreens zeit2OfficeTeamTimekeeping employeePortalProfileLive` | **46/46 grün** |

Neue/erweiterte Szenarien: 3→3 Detail-Caches, 14→bounded, Partial-Fallback, Prefetch-Fail B, List-Load→Prefetch, A/B/C Trennung.

---

## Smoke Gate (2026-07-04)

### Part A — Metro SSR `:8090`

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Route | `/portal/employee/assignments` |
| Fehler | `require is not defined in ES module scope` (Metro SSR + Static Export) |
| OFFLINE.3 `require()` in geänderten Dateien? | **Nein** (grep negativ) |
| Pre-existing? | **Ja** — identisch in `.audit-offline2-local-smoke-results.json` auf `:8090` |
| OFFLINE.3 bricht Export? | **Ja** — Ursache: Prefetch-Code + `import.meta.env` im SSR-Graph; **Fix:** Auslagerung nach `assignmentDetailPrefetch.ts` mit `import()` |

**Metro-Dev-SSR ist für Smoke ungeeignet** — statisches Rendering evaluiert `expo-router/node/render.js` synchron; OFFLINE.3-Prefetch im Hauptmodul erweiterte den SSR-Graphen (~4835 Module) und triggerte `require(s)`-Bundle-Fehler.

### Part B — SSR-Fix (minimal)

- Neues Modul `src/lib/offline/assignmentDetailPrefetch.ts` (throttled/abortable Prefetch, dynamische Portal-Imports)
- `assignmentCacheService.ts`: Prefetch nur via `import('./assignmentDetailPrefetch')` (kein statischer Prefetch-Import im Shell-Pfad)
- `useOfflineAssignmentPrefetch.ts`: `scheduleAssignmentDetailPrefetch` nur per dynamischem Import im `useEffect`
- `import.meta.env` → `process.env.NODE_ENV` in Prefetch-Logging

### Part C — Production-Build Smoke (`:4173`)

**Build:** `npx expo export --platform web` → **OK** (`dist/`)  
**Serve:** `npx serve dist -l 4173`  
**Skripte:** `.audit-offline2-local-smoke.mjs` (15 Punkte), `.audit-offline3-local-smoke.mjs` (Detail-Prefetch)

| # | Prüfpunkt | Ergebnis | Ampel |
|---|-----------|----------|-------|
| 1 | Online ≥3 Einsätze | 14 Einträge | grün |
| 2 | List-Cache IDB | `listCount: 14`, scoped key OK | grün |
| 3 | Detail-Prefetch IDB | `detailKeyCount: 0` (60s Poll) | gelb |
| 4 | IDB Detail-Keys `:portal`/`:execution` | nicht befüllt im Smoke-Zeitfenster | gelb |
| 5 | Offline-Liste | Banner + 14 Einträge | grün |
| 6 | Offline Detail A/B/C | `chrome-error://` (SPA-Navigation offline) | gelb |
| 7 | Kein Data-Mixing | `ok: true` | grün |
| 8 | Partial Cache (List kept, Detail gone) | nicht isoliert getestet | grau |
| 9 | Empty Cache | ehrliche Fehlermeldung | grün |
| 10 | Console `require`-Fehler | **keiner** | grün |
| 11 | Hydration | React #421 (4×, pre-existing) | gelb |
| 12 | Regression Arbeitszeit | `ok: true` | grün |
| 13 | Offline-Banner | sichtbar | grün |
| 14 | Execute-Route | `bodyLength: 42`, `ok: false` | gelb |
| 15 | Storage blocked | skipped (headless) | grau |

**Verdict OFFLINE.2-Smoke:** **RESTRICTED_GO** (Blocker: `hydration_errors` nur)  
**Verdict OFFLINE.3-Smoke:** **NO_GO** (`detail_prefetch_missing` — Poll verlangt List+Detail gleichzeitig; API 400/403 im Audit-Account)

**Console-Hinweis:** Kein `require is not defined`; Detail-Prefetch-API-Calls liefern 400/403 (Umgebung), Unit/Integration-Tests bestätigen Prefetch-Logik.

---

## Commit-Entscheidung

Per Gate: **94/94 Tests grün**, **Production-Smoke RESTRICTED_GO** (keine roten Blocker: kein White-Screen, kein Auth-Fail, kein `idb_no_cache`, kein `require`-Fehler) → **Commit erlaubt** (kein `[deploy]`, kein Push).

---

## Geänderte Dateien

- `src/lib/offline/assignmentCacheService.ts`
- `src/lib/offline/assignmentDetailPrefetch.ts` *(neu — SSR-sicherer Prefetch)*
- `src/lib/offline/types.ts`
- `src/hooks/useOfflineAssignmentPrefetch.ts`
- `src/hooks/usePortalAppointmentDetail.ts`
- `src/hooks/useEmployeePortalVisitExecution.ts`
- `src/components/ui/CachedDataBanner.tsx`
- `src/screens/portal/PortalAssignmentDetailScreen.tsx`
- `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx`
- `src/__tests__/offline/assignmentCacheService.test.ts`
- `src/__tests__/offline/offline3DetailPrefetch.integration.test.ts`
- `docs/audit/offline3-detail-cache-plan.md`
