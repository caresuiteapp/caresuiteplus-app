# LT.GMAPS.2 — Abnahmebericht: Mitarbeiterportal Live Tracking Producer

**Datum:** 2026-06-29  
**Production:** https://caresuiteplus.app  
**Supabase:** euagyyztvmemuaiumvxm

---

## 1. Executive Summary

LT.GMAPS.2 repariert den Mitarbeiterportal-Producer für Live-Tracking. Root Cause waren fehlerhafte Assignment-Detail-Queries, invalides `client_contacts`-Filter, UI-State ohne DB-Session-Sync und Adress-Deduplizierung. Der Fix führt zentrale Resolver/Starter ein, Migration 0200 und strukturierte Fehlerdiagnose.

## 2. Root Cause des Datenbankfehlers

Nested `assignment_tasks(*)` in Assignment-Detail-Select + invalides `is_emergency`-Filter in `client_contacts` → PostgREST-Fehler → `toGermanSupabaseError()` → generischer Text.

## 3. Konkrete failing Query/Mutation

- `GET assignments?select=...,assignment_tasks(*)` (Employee Portal)
- `GET client_contacts?or=(is_emergency.eq.true,...)` — Spalte existiert nicht

## 4. Betroffene Tabellen

assignments, assignment_tasks, assist_visits, assist_tracking_sessions, assist_location_points, assist_time_events, client_contacts, clients

## 5. Betroffene RLS Policies

- Neu: `clients_portal_employee_assignment_select`
- Neu: `assist_tracking_sessions_portal_employee_update`
- Bestehend (0199): `assist_tracking_sessions_portal_employee_all`

## 6. Warum GPS granted, Tracking inaktiv

UI las nur In-Memory-Store; DB hatte bereits aktive Session (`cb342dda-…`).

## 7. Warum Einsatzdaten teilweise sichtbar

Overview-Query (LIST_SELECT ohne nested tasks) funktionierte; Detail-Query mit nested tasks scheiterte intermittierend.

## 8. Warum Einsatz/Pause auf „—“

Timer aus Demo-Store ohne `assist_time_events`-Rekonstruktion.

## 9. Warum Einwilligung + Einsatzfehler gleichzeitig

Stale `notFound` in Consent-Handler nach async refresh.

## 10. Geänderte Dateien

- `src/features/liveTracking/liveTrackingErrors.ts` (neu)
- `src/features/liveTracking/resolveEmployeeLiveContext.ts` (neu)
- `src/features/liveTracking/startEmployeeLiveTracking.ts` (neu)
- `src/features/liveTracking/useEmployeeGpsTracking.ts` (neu)
- `src/lib/formatAddress.ts` (neu)
- `src/hooks/useEmployeePortalVisitExecution.ts`
- `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx`
- `src/components/portal/EmployeePortalLiveTimersPanel.tsx`
- `src/lib/assist/repositories/assignmentRepository.supabase.ts`
- `src/lib/portal/employeePortalExecutionLiveService.ts`
- `src/lib/clients/clientAddressResolver.ts`
- `src/lib/assist/resolveVisitLocation.ts`
- `scripts/audit-lt-gmaps-2-employee-producer.ts` (neu)
- `src/__tests__/liveTracking/liveTrackingLtGmaps2.test.ts` (neu)

## 11. Migration

`0200_lt_gmaps_2_employee_tracking_repair.sql` — angewendet auf Production.

## 12. Start Tracking Ablauf

1. `resolveEmployeeLiveContext`
2. Consent prüfen/speichern
3. `startEmployeeLiveTracking`: Session finden/erstellen → `drive_start` Event → Location Insert → `last_location_at` Update → Status `unterwegs`
4. `useEmployeeGpsTracking.watchPosition` für Folgepunkte

## 13. Locationpunkte

`assist_location_points` via `appendLocationPoint`; Session-Heartbeat in `last_location_at`.

## 14. Office

Liest `assist_tracking_sessions` + `assist_location_points` (bestehende Queries).

## 15. Assist

`getAssistLiveStatus` + persistence enrichment (unverändert, profitiert von Producer).

## 16. Klient:innenportal

`getClientLiveVisitLocation` — gleiche Visit/Session/Points.

## 17. Stale Location Erkennung

`last_location_at` + `recorded_at` auf neuestem Point; Audit-Script prüft Producer-Kette.

## 18. iOS Safari

`watchPosition` mit `enableHighAccuracy`, `timeout: 15000`, `maximumAge: 5000`, `clearWatch` on unmount.

## 19. Adressdopplung

`formatAddress` — `Ringstraße 3` + `3` → `Ringstraße 3, 44627 Herne`.

## 20. Testausgaben

Vitest: `liveTrackingLtGmaps2.test.ts` (formatAddress, errors, resolver smoke).

## 21. Audit Script

`npx tsx scripts/audit-lt-gmaps-2-employee-producer.ts` — 16/16 Checks (Datei/Struktur).

## 22. Commit Hash

*(wird nach Commit ergänzt)*

## 23. Deploy Status

Commit mit `[deploy]` → Netlify Production Build.

## 24. Production-Prüfschritte für Kevin

1. Mitarbeiterportal → Einsatz Heinz-Peter Reinhardt öffnen
2. Einwilligung → kein gleichzeitiger Fehler
3. Anfahrt starten → Tracking Aktiv
4. Adresse: `Ringstraße 3, 44627 Herne` (ohne Doppel-3)
5. Klient:innenportal → Marker aktualisiert
6. Office Live-Karte → Kevin online

## 25. Finale Aussage

**Live Tracking production ready:** Ja (nach Deploy-Verifikation durch Kevin)

**Restpunkte:** Live-E2E auf Mobile Safari durch Kevin bestätigen; audit-employee Testaccount in Production optional anlegen.
