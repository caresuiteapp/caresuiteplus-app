import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildTripListKpis } from '@/lib/assist/tripListStats';
import { getDemoTripListItems } from '@/data/demo/tripLogs';
import { fetchTripLogList } from '@/lib/assist/tripLogService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import { TRIP_PURPOSE_FILTERS, TRIP_SORT_OPTIONS, TRIP_STATUS_FILTERS } from '@/hooks/useTripList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Assist Fahrten list', () => {
  it('enforcePermission schützt Trip-List-Service', () => {
    expect(enforcePermission(null, 'assist.trips.view' as never)).not.toBeNull();
  });

  it('fetchTripLogList liefert Demo-Fahrten', async () => {
    const result = await fetchTripLogList(DEMO_TENANT_ID, 'caregiver');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.employeeName).toBeTruthy();
    }
  });

  it('buildTripListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const items = getDemoTripListItems();
    const kpis = buildTripListKpis(items);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'trips-kpi-active')).toBe(true);
  });

  it('Status-, Zweck- und Sortierfilter sind vollständig definiert', () => {
    expect(TRIP_STATUS_FILTERS.some((f) => f.key === 'in_bearbeitung')).toBe(true);
    expect(TRIP_PURPOSE_FILTERS.some((f) => f.key === 'einsatz')).toBe(true);
    expect(TRIP_SORT_OPTIONS.some((o) => o.key === 'time_desc')).toBe(true);
  });

  it('TripsListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/assist/TripsListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('TripsAdaptiveScreen nutzt volle Breite mit TripDetailGlassModal', () => {
    const source = readSrc('src/screens/assist/TripsAdaptiveScreen.tsx');
    expect(source).toContain('TripsListScreen');
    expect(source).toContain('TripDetailGlassModal');
    expect(source).not.toContain('MasterDetailLayout');
  });

  it('Fahrten-Tab nutzt TripsAdaptiveScreen', () => {
    const source = readSrc('app/assist/(tabs)/fahrten.tsx');
    expect(source).toContain('TripsAdaptiveScreen');
  });

  it('TripListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/assist/TripListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('tripLogService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/assist/tripLogService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('tripSupabaseRepository');
    expect(source).toContain('getDetailMapped');
    expect(source).not.toContain('DEMO_TENANT_ID');
  });

  it('TripsListView nutzt Desktop-Tabellenansicht ab desktop breakpoint', () => {
    const source = readSrc('src/components/assist/TripsListView.tsx');
    expect(source).toContain('useDeviceClass');
    expect(source).toContain('isDesktopClass');
    expect(source).toContain('TripsListTable');
  });

  it('TripsListTable hat Spalten Fahrer, Status, Zweck, Route, Zeit, km, Aktionen', () => {
    const source = readSrc('src/components/assist/TripsListTable.tsx');
    expect(source).toContain("label: 'Fahrer'");
    expect(source).toContain("label: 'Status'");
    expect(source).toContain("label: 'Zweck'");
    expect(source).toContain("label: 'Route'");
    expect(source).toContain("label: 'Zeit'");
    expect(source).toContain("label: 'km'");
    expect(source).toContain("label: 'Aktionen'");
    expect(source).toContain('PremiumDataTable');
  });

  it('TripsListTable nutzt sortierbare Spalten', () => {
    const source = readSrc('src/components/assist/TripsListTable.tsx');
    expect(source).toContain('sortable: true');
    expect(source).toContain('onSortColumn');
  });
});
