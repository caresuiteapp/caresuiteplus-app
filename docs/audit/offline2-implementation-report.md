# OFFLINE.2 — Assignment Cache Implementation Report

**Datum:** 2026-07-04  
**HEAD (Start):** `27cd1eed` — hydration1 production smoke doc  
**Phase:** OFFLINE.2  
**Deploy:** **nein**

---

## 1. Ausgangsstand

| Check | Ergebnis |
|-------|----------|
| HEAD | `27cd1eede27bfeca6f2db6eb21da6238bd2fa1f8` |
| origin/main | identisch (sync) |
| Push nötig | **nein** |
| Untracked | `.audit-*` Logs (nicht committed) |

---

## 2. Production HYDRATION.1

| Check | Ergebnis |
|-------|----------|
| Bundle `entry-932739f8` | in `docs/audit/hydration1-production-smoke.md` dokumentiert |
| SSR/Hydration Patterns | `useHydrated`, `useHydrationSafeWindowDimensions` unverändert genutzt |
| OFFLINE.2 IDB Init | client-only via `useHydrated` + `useEffect` |

---

## 3. Geänderte / neue Dateien

| Datei | Aktion |
|-------|--------|
| `src/lib/offline/types.ts` | Cache-Record-Typen |
| `src/lib/offline/idb.ts` | `putStoreRecord`, `getStoreRecord` |
| `src/lib/offline/assignmentCacheService.ts` | **neu** — Cache CRUD + Loader |
| `src/hooks/useOfflineDbInit.ts` | **neu** |
| `src/hooks/useOfflineAssignmentPrefetch.ts` | **neu** |
| `src/components/ui/CachedDataBanner.tsx` | **neu** |
| `src/components/ui/OfflineNotice.tsx` | OFFLINE.2 Message |
| `src/components/ui/index.ts` | Export |
| `src/components/portal/EmployeePortalShell.tsx` | IDB init + Prefetch |
| `src/hooks/usePortalAppointments.ts` | Cache read/write |
| `src/hooks/usePortalAppointmentDetail.ts` | Cache read/write |
| `src/hooks/useEmployeePortalDashboard.ts` | Cache read/write |
| `src/hooks/useEmployeePortalVisitExecution.ts` | Cache + read-only |
| `src/components/portal/PortalAppointmentsTab.tsx` | Banner |
| `src/screens/portal/PortalAssignmentDetailScreen.tsx` | Banner |
| `src/screens/portal/EmployeePortalDashboardScreen.tsx` | Banner wiring |
| `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx` | Read-only UI |
| `src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx` | Banner |
| `src/__tests__/offline/assignmentCacheService.test.ts` | **neu** |
| `src/__tests__/offline/offlineNotice.test.tsx` | OFFLINE.2 |
| `src/__tests__/offline/useConnectivity.test.tsx` | HYDRATION.1 Guard |
| `docs/audit/offline2-assignment-cache-plan.md` | **neu** |
| `docs/audit/offline2-implementation-report.md` | **neu** (dieses Dokument) |

**Unverändert:** ZEIT.2, ABSENCE.1, PROFILE.1, SIGNATURE.1 (keine Business-Logic-Änderungen)

---

## 4. Cache-Konzept

- **Store:** bestehender `assignments` in `CareSuiteOfflineDB` v1
- **Keys:** `{tenant}:{employee}:list`, `{tenant}:{employee}:{id}:portal`, `{tenant}:{employee}:{id}:execution`
- **Schreiben:** nach erfolgreichem Online-Load (overwrite = Invalidierung)
- **Prefetch:** MP-Shell, online, max. 6 Detail-Records
- **Logout:** `clearOfflineDb()` (OFFLINE.1, unverändert)

---

## 5. Offline-Fallback-Verhalten

| Screen | Online OK | Online fail / offline + Cache | Offline ohne Cache |
|--------|-----------|-------------------------------|---------------------|
| Einsatzliste | Live | Cache + Banner | ErrorState |
| Einsatz-Detail | Live | Cache + Banner | ErrorState |
| Dashboard | Live | Cache + Banner | Error |
| Execute | Live Workflow | **Read-only** + Banner | ErrorState |

Execute: `allowedActions = []` bei `isOffline || fromCache` — keine Offline-Sign/Sync.

---

## 6. Datenschutz / Datenminimierung

| Aspekt | Bewertung |
|--------|-----------|
| Scope | Nur eigene Einsätze (`tenantId` + `employeeId` Keys) |
| Inhalt | Bereits portal-gefilterte Live-Payloads |
| Kein PHI-Bulk | Keine Akte, kein Budget, keine Signatur-Blobs |
| Tenant-Isolation | Key-Präfix + Logout-Purge |
| Transparenz | „Zwischengespeicherte Daten“ + Timestamp |
| Manipulation | Read-only offline — kein SSOT-Write |

**Risiko:** Stale Cache ohne TTL — mittel; Banner + Timestamp; TTL in OFFLINE.8 empfohlen.

---

## 7. Tests und Ergebnisse

```text
npx vitest run src/__tests__/offline/
→ 4 files, 22/22 pass
```

| Suite | Ergebnis |
|-------|----------|
| assignmentCacheService | 6/6 pass |
| offlineIdb | 6/6 pass |
| offlineNotice | 4/4 pass |
| useConnectivity | 6/6 pass (HYDRATION.1 Guard angepasst) |

`npm run typecheck`: **pre-existing errors** in Office/Pflege-Screens (unverändert durch OFFLINE.2); keine neuen Fehler in OFFLINE.2-Dateien.

---

## 8. Lokale Smoke

| Szenario | Ergebnis |
|----------|----------|
| Dev-Server Browser-Smoke | **nicht ausgeführt** (kein laufender Expo in Session) |
| Empfohlen manuell | Online MP → Einsätze laden → DevTools Offline → Liste/Detail/Execute prüfen |

---

## 9. Verbleibende Gelb-Punkte

| Punkt | Phase |
|-------|-------|
| Full-Reload offline ohne SW | OFFLINE.8 |
| TTL 24h enforced | OFFLINE.2+ / OFFLINE.8 |
| Outbox / Workflow offline | OFFLINE.3–4 |
| Sync-Engine | OFFLINE.6 |
| `@react-native-community/netinfo` | optional Native |

---

## 10. Commit

Message: `feat(offline): add employee assignment cache fallback`  
**Ohne `[deploy]`**

---

## 11. Kein Deploy

**Bestätigt:** kein Push mit `[deploy]`, kein Netlify-Deploy.

---

## 12. Empfehlung deploybereit

**Ja — mit Einschränkung:** Feature ist read-only Fallback, risikoarm. Nach manuellem MP-Smoke (Online→Offline→Cache sichtbar) Production-Deploy sinnvoll. Execute bleibt bewusst ohne Offline-Workflow bis OFFLINE.4.

---

*Erstellt: 2026-07-04 | OFFLINE.2 Implementierung*
