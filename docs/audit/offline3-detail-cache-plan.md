# OFFLINE.3 — Detail Cache & Prefetch Plan

**Datum:** 2026-07-04  
**Basis:** Production Smoke OFFLINE.2 (`detailKeyCount: 0`, Detail-Offline **gelb**)  
**HEAD:** `20846e4f` (`origin/main`)

---

## Root Cause — warum `detailKeyCount === 0` in Production?

| Hypothese | Befund |
|-----------|--------|
| Prefetch schreibt keine Keys | **Nein** — `prefetchEmployeeAssignmentCache` ruft `writePortalAppointmentDetailCache` + `writeExecutionDetailCache` auf (Keys `:portal` / `:execution`). |
| Falsche Fetch-Funktion | **Teilweise** — Prefetch nutzte `fetchLiveEmployeePortalAssignmentDetail` **und** `fetchPortalAppointmentDetail` (letzteres delegiert intern wieder auf Live). Redundant, aber nicht blockierend. |
| Timing / Race | **Ja (Hauptursache)** — `useOfflineAssignmentPrefetch` lief **einmal** beim Shell-Mount (`lastKeyRef`), **bevor** die Einsatzliste geladen war. Wenn der erste Lauf leer/fehlgeschlagen → kein Retry nach erfolgreichem `loadPortalAppointmentsWithCache`. Smoke wartete auf List-Cache (Assignments-Tab), nicht auf Shell-Prefetch. |
| Fehler verschluckt | **Ja** — `Promise.all` ohne Logging; fehlgeschlagene Detail-Fetches hinterließen keine IDB-Einträge, kein Dev-Signal. |
| Tenant/Employee null | **Nein** in Prod-Smoke — List-Cache tenant/employee-scoped mit 14 Items belegt gültige IDs. |
| IDB-Write-Fehler | **Unwahrscheinlich** — List-Write funktionierte; Detail-Writes nutzen denselben Store. |

**Fazit:** Detail-Prefetch war implementiert, aber **nicht zuverlässig an erfolgreichen Online-List-Load gekoppelt** und bei Fehlern **stumm**. Offline-Detail fiel deshalb auf ehrliche Fehlermeldung zurück statt Cache.

---

## Zielbild OFFLINE.3

1. **Detail-Cache pro Einsatz** — Keys `{tenant}:{employee}:{assignmentId}:portal` und `:execution`.
2. **Prefetch nach List-Load** — `scheduleAssignmentDetailPrefetch` direkt nach `mergeAssignmentListCache` in `loadPortalAppointmentsWithCache`; bounded (`MAX_PREFETCH_DETAILS = 6`), throttled, abortable.
3. **Offline-Detail** — URL-ID → passender Cache; kein Mixing; bei fehlendem Detail aber vorhandener Liste → Basis aus List-Row + Banner „Detail nicht vollständig zwischengespeichert“.
4. **OFFLINE.2 unangetastet** — List-Cache-Pfad unverändert in Semantik; nur zusätzlicher Prefetch-Hook nach Merge.

---

## Implementierung (Dateien)

| Datei | Änderung |
|-------|----------|
| `assignmentCacheService.ts` | `selectPrefetchAssignmentCandidates`, `prefetchAssignmentDetailCaches`, `scheduleAssignmentDetailPrefetch`, List-Basis-Builder, Partial-Fallback in Detail-Loadern |
| `useOfflineAssignmentPrefetch.ts` | Retry wenn List-Cache nach Shell-Warmup verfügbar |
| `usePortalAppointmentDetail.ts` / `useEmployeePortalVisitExecution.ts` | `partialDetail`, `cacheSource` Meta |
| `CachedDataBanner.tsx` | Partial-Hinweis |
| `PortalAssignmentDetailScreen.tsx` / `EmployeePortalVisitExecutionScreen.tsx` | Partial-Banner |
| `types.ts` | `AssignmentCacheSource`, erweiterte `AssignmentCacheMeta` |

---

## Test-Matrix (20 Szenarien)

Siehe `assignmentCacheService.test.ts` + `offline3DetailPrefetch.integration.test.ts`.

---

## Smoke (lokal :8090)

`.audit-offline3-local-smoke.mjs` — IDB `detailKeyCount > 0`, Offline A/B/C via SPA-Klick, Partial-Cache, Hydration-Console.

---

## Nicht im Scope

Deploy, RLS, Migrations, Offline-Write/Sync, Signatur-Sync, Konfliktlösung.
