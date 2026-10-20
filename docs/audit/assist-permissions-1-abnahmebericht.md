# ASSIST.PERMISSIONS.1 — Abnahmebericht

**Date:** 2026-06-29  
**Scope:** Employee permission onboarding + markArrived GPS fallback  
**Production:** https://caresuiteplus.app  
**Tenant:** Helferhasen `56180c22-b894-4fab-b55e-a563c94dd6e7`

## Summary

ASSIST.PERMISSIONS.1 fixes the production bug where „Angekommen“ was blocked when internal DB consent existed but browser GPS permission was denied. It introduces central permission onboarding (location, notifications, camera, microphone, signature) and records `arrived_without_gps` / `arrived_manual` audit events without blocking workflow.

## Root cause (fixed)

| Layer | Before | After |
|-------|--------|-------|
| `handleMarkArrived` | Blocked when `!pos.ok && localConsent.granted` | Best-effort GPS; always calls `markArrived` |
| Error shown | Red blocker from `captureEmployeePortalForegroundPosition` | Yellow `InfoBanner` warning |
| Audit | Only `arrive` when GPS available | `arrived_without_gps` / `arrived_manual` time events |

## Migration 0206

- **Repo file:** `supabase/migrations/0206_employee_permission_onboarding.sql`
- **Tables:** `employee_permission_states`, `employee_consent_bundle`
- **Event types:** `arrived_without_gps`, `arrived_manual` on `assist_time_events`
- **Production apply:** via Supabase MCP `euagyyztvmemuaiumvxm`
- **Note:** Migration 0205 (`employee_location_consents`) unchanged

## Verification

| Check | Result |
|-------|--------|
| Unit tests (`assistPermissions1`) | Pass |
| Audit script (`audit-assist-permissions-1.ts`) | 22/22 |
| LT.GMAPS regression | Single GPS watch + permanent consent unchanged |
| PERF.1 regression | `useSingleGeolocationWatch` untouched |
| AWF.1 regression | Workflow transitions intact; arrive adds fallback only |

## Kevin iPhone — manual verification steps

1. Login employee portal as **Kevin Reinhardt**
2. On first visit: complete **Berechtigungen & Einwilligungen** onboarding (5 steps)
3. Open assignment **Hauswirtschaftliche Unterstützung** (Heinz-Peter Reinhardt)
4. Confirm **Standort-Einwilligung** (internal consent)
5. **Anfahrt starten** — en-route active
6. In Safari: set location to **Ask** or **Deny** for caresuiteplus.app
7. Tap **Anfahrt läuft — Angekommen**
8. **Expected:** Status → Angekommen, drive timer stops, **yellow warning** (not red error)
9. Assist **Live-Status:** row shows „Ankunft ohne GPS“ when applicable
10. Repeat with GPS granted → „Mit GPS“ / no warning

## Production ready

**Ja** — migration 0206 applied; commit includes `[deploy]` for Netlify.

## Commit

- **Hash:** _(see git log after commit)_
- **Message:** `ASSIST.PERMISSIONS.1 employee permission onboarding and arrived fallback [deploy]`
