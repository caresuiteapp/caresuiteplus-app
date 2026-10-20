import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  emptyTrackingDashboard,
  mapTrackingDashboardRow,
  type TrackingDashboardLiveRow,
} from '@/lib/assist/trackingDashboardMapper';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('trips completeTrip live wiring (Sprint 37)', () => {
  it('tripRepository nutzt completeTripMapped mit UPDATE auf trips', () => {
    const source = readSrc('src/lib/services/repositories/tripRepository.supabase.ts');
    expect(source).toContain('completeTripMapped');
    expect(source).toContain('completeTrip');
    expect(source).toContain('.update({');
    expect(source).toContain('end_address');
    expect(source).toContain('abgeschlossen');
    expect(source).not.toContain('service_role');
  });

  it('completeTrip in tripLogService nutzt Supabase-Repo ohne Demo-Fallback in Live-Pfad', () => {
    const source = readSrc('src/lib/assist/tripLogService.ts');
    expect(source).toContain('completeTripMapped');
    expect(source).toMatch(
      /completeTrip[\s\S]*getServiceMode\(\) === 'supabase'[\s\S]*completeTripMapped/,
    );
    expect(source).not.toContain('service_role');
  });

  it('completeTrip validiert Zieladresse und Distanz im Repository', () => {
    const source = readSrc('src/lib/services/repositories/tripRepository.supabase.ts');
    expect(source).toContain('Zieladresse ist erforderlich');
    expect(source).toContain('Fahrt ist bereits abgeschlossen');
    expect(source).toContain('Distanz muss eine gültige Zahl');
  });
});

describe('assist_tracking_dashboard live mapping (Sprint 37)', () => {
  const completeRow: TrackingDashboardLiveRow = {
    tenant_id: DEMO_TENANT_ID,
    active_trips: 1,
    employees_on_route: 2,
    geofence_alerts_today: 3,
    positions: [
      {
        employeeId: 'emp-001',
        employeeName: 'Anna Krüger',
        latitude: 50.9375,
        longitude: 6.9603,
        speedKmh: 18,
        heading: 'SO',
        updatedAt: '2026-06-14T10:30:00.000Z',
        assignmentTitle: 'Pflegevisit',
        insideGeofence: true,
      },
    ],
    recent_events: [
      {
        id: 'geo-001',
        type: 'enter',
        label: 'Einsatzgebiet Musterstraße',
        timestamp: '2026-06-14T08:52:00.000Z',
        employeeName: 'Thomas Keller',
      },
    ],
    updated_at: '2026-06-14T10:30:00.000Z',
  };

  it('Migration 0030 erstellt assist_tracking_dashboard mit IF NOT EXISTS', () => {
    const sql = readSrc('supabase/migrations/0030_assist_tracking_dashboard_live.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.assist_tracking_dashboard');
    expect(sql).toContain('positions');
    expect(sql).toContain('recent_events');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('mapTrackingDashboardRow mappt vollständige Zeile', () => {
    const result = mapTrackingDashboardRow(completeRow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.activeTrips).toBe(1);
      expect(result.data.positions.length).toBe(1);
      expect(result.data.recentEvents[0]?.type).toBe('enter');
    }
  });

  it('mapTrackingDashboardRow meldet fehlendes Schema ehrlich', () => {
    const incomplete: TrackingDashboardLiveRow = {
      tenant_id: DEMO_TENANT_ID,
      active_trips: 0,
    };
    const result = mapTrackingDashboardRow(incomplete);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Schema unvollständig');
      expect(result.error).toContain('positions');
    }
  });

  it('emptyTrackingDashboard liefert leeren Live-Zustand', () => {
    const dashboard = emptyTrackingDashboard();
    expect(dashboard.positions).toEqual([]);
    expect(dashboard.recentEvents).toEqual([]);
    expect(dashboard.activeTrips).toBe(0);
  });

  it('trackingRepository nutzt getDashboardMapped', () => {
    const source = readSrc('src/lib/services/repositories/trackingRepository.supabase.ts');
    expect(source).toContain('getDashboardMapped');
    expect(source).toContain('TRACKING_DASHBOARD_SELECT_COLUMNS');
    expect(source).toContain('assist_tracking_dashboard');
  });

  it('fetchTrackingDashboard nutzt Supabase-Repo ohne Demo-Fallback in Live-Pfad', () => {
    const source = readSrc('src/lib/assist/tripLogService.ts');
    expect(source).toContain('getDashboardMapped');
    expect(source).toMatch(
      /fetchTrackingDashboard[\s\S]*getServiceMode\(\) === 'supabase'[\s\S]*getDashboardMapped/,
    );
    expect(source).toContain('guardServiceTenant');
  });

  it('seed-live-pilot.mjs enthält assist_tracking_dashboard', () => {
    const source = readSrc('scripts/seed-live-pilot.mjs');
    expect(source).toContain('assist_tracking_dashboard');
    expect(source).toContain('ON CONFLICT (tenant_id) DO NOTHING');
  });
});
