# ASSIST.LIVE.1 — Abnahmebericht

**Datum:** 2026-06-29  
**Ticket:** ASSIST.LIVE.1 — Assist Live Employee Monitoring Display

## Problem

Assist Live-Status Hauptbereich zeigte 0 Einsätze, Sidebar HEUTE zeigte 1/1 — widersprüchliche Queries.

## Root cause

| Bereich | Query-Pfad |
|---------|------------|
| Sidebar | `fetchVisitDispositionList` → Supabase `assist_visits` |
| Main (vor Fix) | `fetchDayMonitor` → `guardLiveDemoFeature` blockiert in Supabase → leerer In-Memory-Fallback |

## Lösung

- **`getAssistLiveMonitoring`** — Single Source of Truth: heutige `assist_visits` + LT.GMAPS Enrichment
- **`useAssistLiveMonitoring`** — Sidebar, Main, Map nutzen denselben Hook
- Migration **0204** — RLS/Realtime Repair für Assist read-only Monitoring

## Migration 0204

| Status | Details |
|--------|---------|
| Applied | Ja — Supabase production `euagyyztvmemuaiumvxm` |
| Inhalt | `assist_visits` Realtime, idempotente Office/Assist SELECT Policies auf tracking tables |

## Audit

| Check | Ergebnis |
|-------|----------|
| `npx tsx scripts/audit-assist-live-1.ts` | **12/12 PASS** |
| `vitest assistLiveMonitoring + assistLiveTrackingView` | **3/3 PASS** |

## Kevin — Verifikation in Production

1. Als Assist-Admin einloggen (Supabase Live-Mandant)
2. Mitarbeiterportal: Einsatz heute starten, GPS-Tracking aktiv
3. Assist → **Live-Status** öffnen
4. Prüfen: KPI-Chips **Einsätze / laufend / Tracking aktiv** stimmen mit Sidebar **Heutige / Laufende Einsätze** überein
5. Einsatz erscheint in Liste; Karte zeigt Marker wenn Standort vorhanden
6. Kein leerer schwarzer Kartenbereich bei vorhandenen Standortdaten

## Production ready

**Ja** — nach Deploy und Kevin-Verifikation oben.

## Commit

Message: `ASSIST.LIVE.1 fix assist live employee monitoring display [deploy]`
