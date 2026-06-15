import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildTrackingKpis } from '@/data/demo/trackingStats';
import { getDemoTrackingDashboard } from '@/data/demo/tripLogs';
import { fetchTrackingDashboard } from '@/lib/assist/tripLogService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Assist Live-Tracking list', () => {
  it('enforcePermission schützt Tracking-Service', () => {
    expect(enforcePermission(null, 'assist.tracking.view' as never)).not.toBeNull();
  });

  it('fetchTrackingDashboard liefert Demo-Tracking-Daten', async () => {
    const result = await fetchTrackingDashboard(DEMO_TENANT_ID, 'caregiver');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.positions.length).toBeGreaterThan(0);
      expect(result.data.recentEvents.length).toBeGreaterThan(0);
    }
  });

  it('buildTrackingKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const data = getDemoTrackingDashboard();
    const kpis = buildTrackingKpis(data);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'tracking-kpi-active')).toBe(true);
  });

  it('TrackingListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/assist/TrackingListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).toContain('TrackingPositionCard');
    expect(source).not.toContain('Coming Soon');
  });

  it('TrackingListHero nutzt PremiumListHeroFrame', () => {
    const source = readSrc('src/components/assist/TrackingListHero.tsx');
    expect(source).toContain('PremiumListHeroFrame');
    expect(source).toContain('Live-Tracking');
    expect(source).toContain('isGpsTrackingLiveReady');
    expect(source).toContain('GPS extern');
  });

  it('TripsListScreen integriert SegmentedTabs für Fahrten + Tracking', () => {
    const source = readSrc('src/screens/assist/TripsListScreen.tsx');
    expect(source).toContain('SegmentedTabs');
    expect(source).toContain('TrackingListView');
    expect(source).toContain('TripsListView');
    expect(source).toContain('assist.tracking.view');
  });

  it('tripLogService nutzt guardServiceTenant für Tracking', () => {
    const source = readSrc('src/lib/assist/tripLogService.ts');
    expect(source).toContain('fetchTrackingDashboard');
    expect(source).toContain('guardServiceTenant');
    expect(source).not.toContain('service_role');
  });

  it('seed-live-pilot.mjs ist safe INSERT-only', () => {
    const source = readSrc('scripts/seed-live-pilot.mjs');
    expect(source).toContain('ON CONFLICT');
    expect(source).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i);
    expect(source).toContain('trips');
    expect(source).toContain('care_records');
    expect(source).toContain('catalogs');
    expect(source).toContain('reporting_reports');
  });
});
