# ASSIST.LIVE.1 — Preflight: Sidebar vs Main Query Mismatch

## Symptom (Production)

| Area | Display |
|------|---------|
| Main Live-Status | 0 Einsätze, 0 Tracking aktiv, „Keine Einsätze heute“, Karte leer |
| Right sidebar HEUTE | Heutige Einsätze **1**, Laufende Einsätze **1** |

## Root cause

Two different data paths:

### Sidebar (correct in production)

- `RightContextPanel` → `useAssistDashboard()` → `fetchAssistDashboardStats`
- → `fetchAssignmentList` → **`fetchVisitDispositionList`** → `visitSupabaseRepository.list` (Supabase `assist_visits`)
- Counters: `todayCount`, `activeCount + inProgressCount` from live visit disposition

### Main Live-Status (broken in production)

- `AssistLiveStatusScreen` → `useAssistLiveStatus` → `getAssistLiveStatus`
- → **`fetchDayMonitor`** (`liveMonitorService.ts`)
- In Supabase mode `fetchDayMonitor` calls **`guardLiveDemoFeature`** → returns error *„Live-Monitor im Live-Modus noch nicht vollständig angebunden.“*
- Fallback `buildFallbackDayMonitorRows` uses **`listAssignmentWorkflows`** (in-memory demo store only) → **empty in production**
- Result: `rows.length === 0` while sidebar shows 1

### Map

- Same `rows` as main list; no markers when rows empty even if GPS data exists in `assist_location_points`.

## Fix (ASSIST.LIVE.1)

1. **`getAssistLiveMonitoring`** — single query: `assist_visits` today + LT.GMAPS enrichment
2. **`useAssistLiveMonitoring`** — shared hook for sidebar + main + map
3. Sidebar HEUTE counters use monitoring `todayCount` / `runningCount` when in Assist module
4. Migration **0204** — idempotent RLS/realtime repair for Assist read path

## Files changed

- `src/features/assistLive/getAssistLiveMonitoring.ts` (new)
- `src/features/assistLive/useAssistLiveMonitoring.ts` (new)
- `src/screens/assist/AssistLiveStatusScreen.tsx`
- `src/components/layout/platform/rightcontextpanel.tsx`
- `src/lib/assist/assistDashboardWorkspace.ts`
- `supabase/migrations/0204_assist_live_monitoring_rls.sql`
