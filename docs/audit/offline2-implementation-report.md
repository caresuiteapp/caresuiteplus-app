# OFFLINE.2 — Assignment Cache Implementation Report (Multi-Assignment)

**Datum:** 2026-07-04  
**Phase:** OFFLINE.2 (Multi-Assignment Revision)  
**Deploy:** **nein**

---

## 1. Multi-Assignment Acceptance

| # | Anforderung | Status |
|---|-------------|--------|
| 1 | Mehrere Einsätze/Tag laden, cachen, offline anzeigen | ✅ |
| 2 | Mehrere kommende Einsätze online sichtbar | ✅ |
| 3 | Eindeutiger Key pro Einsatz (`assignment_id`) | ✅ |
| 4 | Cache-Einträge überschreiben sich nicht gegenseitig | ✅ |
| 5 | Offline-Listen-UI für mehrere Einsätze | ✅ |
| 6 | Sortierung: heute → Startzeit → kommend chronologisch | ✅ |
| 7 | Status pro Einsatz erhalten | ✅ |
| 8 | Detail pro Einsatz (id, Klient, Datum, Status, Tasks, Notizen, lastUpdated) | ✅ |
| 9 | Update eines Einsatzes → andere bleiben erhalten | ✅ |
| 10 | Fehlend online → als stale markieren (`cacheStale`), nicht löschen | ✅ |
| 11 | Offline-UI: Cache-Label, Stand, kein Live-Hinweis | ✅ |
| 12 | Kein Cache → ehrliche Leer-/Fehleranzeige | ✅ |
| 13 | Execute öffnet korrekten Einsatz per ID | ✅ |
| 14 | Niemals B statt A anzeigen | ✅ |
| 15 | Tests für Multi-Assignment | ✅ (15 Tests) |

---

## 2. Geänderte Dateien (Multi-Assignment Revision)

| Datei | Änderung |
|-------|----------|
| `src/lib/offline/types.ts` | `CachedPortalAppointmentItem` mit `cacheStale` |
| `src/lib/offline/assignmentCacheService.ts` | `sortCachedAssignments`, `mergeAssignmentListCache`, Stale-Merge, Prefetch Portal+Execution |
| `src/components/portal/PortalAppointmentsTab.tsx` | Badge „Veraltet“ + `CachedDataBanner` |
| `src/__tests__/offline/assignmentCacheService.test.ts` | 15 Multi-Assignment Tests |
| `docs/audit/offline2-assignment-cache-plan.md` | Multi-Assignment Abschnitt |
| `docs/audit/offline2-implementation-report.md` | dieses Dokument |

Bestehende OFFLINE.2-Integration (Hooks, Shell, Banner, Execute read-only) unverändert funktionsfähig.

---

## 3. Cache-Konzept (Multi-Assignment)

- **Listen-Key:** `{tenant}:{employee}:list` — Array aller Einsätze, sortiert
- **Detail-Keys:** pro `assignment_id` getrennt (`:portal`, `:execution`)
- **Online-Merge:** `mergeAssignmentListCache` — fehlende Online-IDs → `cacheStale: true`
- **Sortierung:** `sortCachedAssignments` vor jedem Read/Write
- **Prefetch:** bis zu 6 heute/künftige Einsätze — Portal- + Execution-Detail

---

## 4. Tests

```text
npx vitest run src/__tests__/offline/ \
  src/__tests__/wfm/zeit1EmployeeResolverScreens.test.ts \
  src/__tests__/portal/employeePortalProfileLive.test.ts
→ 6 files, 59/59 pass
```

| Suite | Ergebnis |
|-------|----------|
| assignmentCacheService | **15/15 pass** |
| offlineIdb | 6/6 pass |
| offlineNotice | 4/4 pass |
| useConnectivity | 6/6 pass |
| zeit1EmployeeResolverScreens | 4/4 pass |
| employeePortalProfileLive | 24/24 pass |

Multi-Assignment Testmatrix (alle abgedeckt):

- 1 Einsatz online→cache→offline
- 3 am selben Tag → sortierte Offline-Liste
- heute + kommend → chronologisch
- Detail A/B/C korrekt (Execution + Portal)
- Update B → A,C in Liste erhalten
- Fetch fail → mehrere sichtbar
- Kein Cache → ehrlicher Fehler
- Duplicate/missing IDs → sicherer Fallback
- Stale-Markierung bei partiellem Online-Refresh

---

## 5. Commits

| Hash | Message | `[deploy]` |
|------|---------|------------|
| `d3c26592` | `feat(offline): add employee assignment cache fallback` | nein |
| *(neu)* | `fix(offline): support multiple assignment cache entries` | **nein** |

---

## 6. Kein Deploy

**Bestätigt:** kein Push mit `[deploy]`, kein Netlify-Deploy.

---

*Erstellt: 2026-07-04 | OFFLINE.2 Multi-Assignment Revision*
