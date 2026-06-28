# Employee mobility & Google Maps travel time

CareSuite+ calculates travel times to assignments using employee mobility preferences and the Google Maps Distance Matrix API (via Supabase Edge Function).

## Required APIs (Google Cloud Console)

Enable for your project:

- **Distance Matrix API** (primary)
- Optional: Directions API (future enhancements)

Restrict the API key to these APIs and (recommended) to your Supabase Edge Function egress IPs or use HTTP referrer restrictions only for client-side keys — **prefer server-side key only**.

## Environment variables

### Supabase Edge Function (production)

Set in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

| Variable | Description |
|----------|-------------|
| `GOOGLE_MAPS_API_KEY` | Server-side Google Maps API key (never expose in the app) |

Deploy the function:

```bash
supabase functions deploy compute-travel-time
```

### Local / Expo (optional)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | **Not used for travel time** — reserved for future map tiles. Travel time always goes through `compute-travel-time`. |

Without `GOOGLE_MAPS_API_KEY` on the Edge Function, the UI shows a **heuristic estimate** or `—` (no crash).

## Database

Migration: `supabase/migrations/0191_employee_mobility_settings.sql`

Table: `employee_mobility_settings`

- `transport_mode`: `car` | `transit` | `bicycle` | `escooter` | `walking`
- `route_start_type`: `home` | `office` | `last_assignment` | `custom`
- `route_end_type`: `home` | `office` | `custom`
- Optional custom addresses: `route_start_address`, `route_end_address`

**RLS**

- Employee portal: read/write own row (`resolve_current_employee_id()`)
- Office: read/write all rows in tenant (`office.employees.view`)

Home address comes from `employees.street/house_number/postal_code/city`. Office address from `tenants` address fields.

## Transport mode mapping

| CareSuite mode | Google `mode` | Notes |
|----------------|---------------|-------|
| Auto (`car`) | `driving` | |
| ÖV (`transit`) | `transit` | |
| Fahrrad (`bicycle`) | `bicycling` | |
| Zu Fuß (`walking`) | `walking` | |
| E-Scooter (`escooter`) | `walking` ≤ 3 km, else `bicycling` | Google has no E-Scooter mode; documented approximation |

Implementation: `src/lib/maps/transportModeMapping.ts` (mirrored in `supabase/functions/compute-travel-time`).

## UI

- **Mitarbeiterportal**: Profil → „Verkehrsmittel & Routen“ → `/portal/employee/mobilitaet`
- **Office Personalakte**: Tab „Kontakt“ → Mobilität panel
- **Assist Einsatzkarten**: travel time badge uses employee settings + assignment address

## Caching

In-memory cache (~5 min) keyed by origin + destination + transport mode: `src/lib/maps/googleMapsTravelService.ts`.

## Deferred

- Batch travel time for full assignment lists / route planning board
- Persist last-assignment address automatically from completed visits
- `isGeoLiveReady()` flip — still uses prepared geo guard elsewhere; mobility travel time works independently when API key is set
- Map display with Google tiles (OpenStreetMap remains default)
