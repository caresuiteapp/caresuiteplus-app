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
| 10 | Fehlend online → als „Veraltet“ markieren, nicht löschen | ✅ |
| 11 | Offline-UI: Cache-Label, Stand, kein Live-Hinweis | ✅ |
| 12 | Kein Cache → ehrliche Leer-/Fehleranzeige | ✅ |
| 13 | Execute öffnet korrekten Einsatz per ID | ✅ |
| 14 | Niemals B statt A anzeigen | ✅ |
| 15 | Tests für Multi-Assignment | ✅ (11 Tests) |

---

## 2. Geänderte Dateien (Multi-Assignment Revision)

| Datei | Änderung |
|-------|----------|
| `src/lib/offline/types.ts` | `CachedPortalAppointmentItem` mit `cacheStale` |
| `src/lib/offline/assignmentCacheService.ts` | Sort, Merge, Stale, Prefetch Portal+Execution |
| `src/components/portal/PortalAppointmentsTab.tsx` | Badge „Veraltet“ |
| `src/__tests__/offline/assignmentCacheService.test.ts` | 11 Multi-Assignment Tests |
| `docs/audit/offline2-assignment-cache-plan.md` | Multi-Assignment Abschnitt |
| `docs/audit/offline2-implementation-report.md` | dieses Dokument |

Bestehende OFFLINE.2-Integration (Hooks, Shell, Banner, Execute read-only) unverändert funktionsfähig.

---

## 3. Cache-Konzept (Multi-Assignment)

- **Listen-Key:** `{tenant}:{employee}:list` — Array aller Einsätze
- **Detail-Keys:** pro `assignment_id` getrennt (`:portal`, `:execution`)
- **Online-Merge:** `mergeAndWriteAssignmentListCache` — fehlende Online-IDs → `cacheStale: true`
- **Sortierung:** `sortPortalAppointmentItems` vor jedem Read/Write
- **Prefetch:** bis zu 6 heute/künftige Einsätze — Portal- + Execution-Detail

---

## 4. Tests

```text
npx vitest run src/__tests__/offline/
→ 4 files, 33/33 pass

Regression:
→ zeit1EmployeeResolverScreens, zeit2OfficeTeamTimekeeping, offlineIdb — pass
```

Multi-Assignment Testmatrix:

- 1 Einsatz online→cache→offline
- 3 am selben Tag → sortierte Offline-Liste
- heute + kommend → chronologisch
- Detail A/B/C korrekt
- Update B → A,C erhalten
- Fetch fail → mehrere sichtbar
- Kein Cache → Fehler
- Duplicate/missing IDs → sicherer Fallback
- Execute öffnet nie falschen Einsatz

---

## 5. Commit

| Feld | Wert |
|------|------|
| Message | `feat(offline): add employee assignment cache fallback` |
| `[deploy]` | **nein** |

---

## 6. Kein Deploy

**Bestätigt:** kein Push mit `[deploy]`, kein Netlify-Deploy.

---

*Erstellt: 2026-07-04 | OFFLINE.2 Multi-Assignment Revision*
