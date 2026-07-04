# OFFLINE.2 — Assignment Cache + Prefetch Plan

**Datum:** 2026-07-04  
**Phase:** OFFLINE.2  
**Basis:** OFFLINE.1 (`CareSuiteOfflineDB`, `useConnectivity`, `OfflineNotice`)  
**Scope:** Mitarbeiterportal — Assignment-Liste, Detail, Dashboard, Execute read-only Fallback

---

## Root Cause — Lazy IDB Init (Gelb-Punkt OFFLINE.1)

OFFLINE.1 legte IndexedDB **nur on-demand** an (`openOfflineDb()` beim ersten CRUD-Aufruf). Im MP wurde `openOfflineDb()` **nirgends** beim Start aufgerufen — Stores blieben leer, Health-Probe lief erst indirekt.

**Folge:** Kein zuverlässiger Warm-Start, kein sichtbarer IDB-Fehler vor dem ersten Cache-Versuch, schwerer zu testen.

**OFFLINE.2 Fix:** `useOfflineDbInit()` in `EmployeePortalShell` — nach `useHydrated()` client-only `openOfflineDb()` + `getOfflineDbHealth()`.

---

## Store Schema (Reuse, keine Version-Bump)

Bestehender Store `assignments` (v1, `keyPath: 'key'`) wird wiederverwendet.

| Record `kind` | Key-Muster | Inhalt |
|---------------|------------|--------|
| `list` | `{tenantId}:{employeeId}:list` | `CachedPortalAppointmentItem[]` (alle Einsätze, sortiert) |
| `portal_detail` | `{tenantId}:{employeeId}:{assignmentId}:portal` | `PortalAppointmentDetail` |
| `execution_detail` | `{tenantId}:{employeeId}:{assignmentId}:execution` | `EmployeePortalAssignmentDetail` |

`sync_meta` wird bei Listen-Cache-Write mit `lastSyncAt` aktualisiert.

**Invalidierung:** Partial Merge bei Online-Refresh (`mergeAssignmentListCache`); fehlende Online-IDs bleiben mit `cacheStale: true` erhalten; `clearOfflineDb()` bei Logout (OFFLINE.1, unverändert).

---

## Multi-Assignment (Pflicht OFFLINE.2)

| Anforderung | Umsetzung |
|-------------|-----------|
| Mehrere Einsätze in Liste | Ein List-Record mit allen Items, stabil per `id` |
| Sortierung | `sortCachedAssignments`: heute → Startzeit → kommende chronologisch |
| Online-Refresh | `mergeAssignmentListCache` upsertet Online-Rows, markiert fehlende als stale |
| Detail pro Einsatz | Separate Keys `:portal` / `:execution` pro `assignmentId` |
| Execute-Isolation | A/B/C nie vermischt — Key enthält `assignmentId` |
| UI | `CachedDataBanner` in Liste, Detail, Dashboard, Execute |

---

## Cache-Felder (portal-permitted)

Es werden **nur** Felder gecacht, die bereits durch Live-Services permission-gefiltert zurückkommen:

- Assignment-ID, Titel, Status, geplante/ist-Zeiten
- Klient Display-Name, Adresse/Ort
- Portal-Hinweise (`notesForEmployee`), Tasks (Titel/Status wenn geladen)
- Execute-Metadaten (`canStartExecution`, erlaubte Transitionen — **nur Anzeige offline**)

**Nicht gecacht:** Budget, Gesundheitsakte, fremde Einsätze, Signatur-Blobs, Outbox.

---

## Prefetch-Trigger

`useOfflineAssignmentPrefetch()` in `EmployeePortalShell`:

- Nach Hydration + `isLinkedReady` + **online**
- Einmal pro `{tenantId}:{employeeId}:{actorId}`
- Lädt Liste + bis zu 6 heutige/künftige Execution-Details

---

## Fallback-UI

`CachedDataBanner` — „Zwischengespeicherte Daten (Stand: …)“

- Liste (`PortalAppointmentsTab`)
- Detail (`PortalAssignmentDetailScreen`)
- Dashboard (`HealthOSEmployeePortalTodayView`)
- Execute: zusätzlich „Nur Ansicht“ + deaktivierte Workflow-Aktionen

`OfflineNotice` (OFFLINE.1 Banner) — aktualisiert für OFFLINE.2 Hinweis auf zwischengespeicherte Einsätze.

---

## Execute-Pfad — Read-only

`useEmployeePortalVisitExecution`:

- `readOnlyExecution = isOffline || fromCache`
- `allowedActions = []` wenn read-only
- Keine neuen Offline-Sign/Sync-Aktionen

---

## Risiken / Gelb-Punkte (verbleibend)

| Punkt | Status |
|-------|--------|
| Reload bei vollem Offline ohne SW | **offen** (OFFLINE.8) |
| TTL 24h enforced | **offen** — Merge + stale flag, kein hartes TTL |
| Stale ohne Online-Refresh | Banner + Timestamp |
| Private Mode / Quota | Graceful degrade (null DB) |

---

## Testplan

- Unit: `assignmentCacheService.test.ts` — **15 Tests** (Multi-Assignment, Sort, Merge/Stale, A/B/C Details)
- Regression: `offlineNotice`, `offlineIdb`, `useConnectivity`, `zeit1EmployeeResolverScreens`, `employeePortalProfileLive`
- Manuell: Online laden → Offline → mehrere Einsätze sichtbar, sortiert, einzeln öffnbar

---

*Nächste Phase: OFFLINE.3 — Outbox-Grundgerüst*
