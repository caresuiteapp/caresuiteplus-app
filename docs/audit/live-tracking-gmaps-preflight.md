# LT.GMAPS.1 — Ist-Analyse (Preflight)

**Datum:** 2026-06-29  
**Projekt:** CareSuite+ (`euagyyztvmemuaiumvxm`)  
**Scope:** Live-Tracking End-to-End + Google Maps Browser-Key

## Bekannte Produktions-Symptome

| Portal | Symptom | Root Cause (Ist) |
|--------|---------|------------------|
| Mitarbeiter | Consent gespeichert → „Einsatz nicht gefunden" | Assignment-Mirror fehlt; Employee-Portal kann `assignments` nicht INSERT; Fallback `assist_visits` blockiert durch fehlende Portal-RLS / `is_tenant_member` |
| Office Live-Mitarbeiter | 0 online | `getWfmLiveEmployeeOverview` liest nur `workforce_work_sessions`, ignoriert aktive `assist_tracking_sessions` |
| Assist Live-Status | 0 tracking | Persistence-Anreicherung scheitert an Visit-ID-Auflösung + RLS-Zirkel (`visit_id IN assignments`) |
| Client | Keine Live-Karte / Zeitfenster | Strikte Eligibility + fehlende Session/Point-Daten wegen RLS |
| Maps | Keine Google-Karte | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` fehlt; Key nur als Supabase Secret |

## Vorhandene Reparaturen (Commits)

- `91f5275c` — Live-Tracking Basis
- `1e4ac394` / `5fba41a2` — Assignment-Mirror
- `5119913e` — Google Maps Loader
- Migration `0197` — Assignment-Backfill + Client-RLS
- Migration `0198` — Profile-Tenant-Backfill, Sync-Trigger, Portal-Tracking-RLS

## Architektur-Ist

```
Office/Assist ──writes──► assist_visits
                              │
                    trigger 0198│
                              ▼
                         assignments (Mirror)
                              │
         Employee Portal ◄────┤ SELECT/UPDATE (0189, kein INSERT)
                              │
                         assist_tracking_sessions
                         assist_location_points
                         assist_time_events
```

## Identifizierte Lücken

1. **Kein zentraler Resolver** — Jeder Portal-Pfad löst IDs separat auf
2. **RLS-Zirkel** — Tracking-Policies referenzieren `assignments`, die fehlen können
3. **Portal-Tenant-Membership** — `is_tenant_member()` erkennt Portal-Accounts nicht
4. **Maps-Key** — Nur Server-Secret, kein Browser-Runtime-Pfad
5. **Office Live** — WFM-only, kein Assist-GPS-Merge
6. **Polling** — 15–30s statt 10s für operative Live-Daten

## Soll-Zustand (LT.GMAPS.1)

- `resolveLiveAssignment.ts` als Single Source of Truth
- Migration `0199`: Portal-RLS, RPC, Runtime-Settings, Realtime
- `maps-runtime-config` Edge Function für Browser-Key
- Zentrale Queries: `getOfficeLiveEmployees`, `getAssistLiveStatus`, `getClientLiveVisitLocation`
- 10s Realtime + Polling Fallback
- Keine Erfolgsmeldung bei nachgelagertem Fehler

## Risiken

- Edge Function muss deployed werden (separater Schritt nach Migration)
- Google Maps Browser-Key braucht HTTP-Referrer-Restriction in GCP
- Produktions-Verifikation erfordert echten Employee-Flow mit GPS
