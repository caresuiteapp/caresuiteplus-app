import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildResidentListKpis } from '@/data/demo/residentListStats';
import { getDemoResidentListItems } from '@/data/demo/residents';
import { fetchResidentList } from '@/lib/stationaer/residentListService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { RESIDENT_SORT_OPTIONS, RESIDENT_STATUS_FILTERS } from '@/hooks/useResidentList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Stationär Bewohner list', () => {
  it('enforcePermission schützt Resident-List-Service', () => {
    expect(enforcePermission(null, 'stationaer.residents.view' as never)).not.toBeNull();
  });

  it('fetchResidentList liefert Demo-Bewohner', async () => {
    const result = await fetchResidentList(DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.lastName).toBeTruthy();
    }
  });

  it('buildResidentListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const items = getDemoResidentListItems();
    const kpis = buildResidentListKpis(items);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'residents-kpi-active')).toBe(true);
  });

  it('Status- und Sortierfilter sind vollständig definiert', () => {
    expect(RESIDENT_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(RESIDENT_SORT_OPTIONS.some((o) => o.key === 'name_asc')).toBe(true);
  });

  it('ResidentsListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/stationaer/ResidentsListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('ResidentsAdaptiveScreen nutzt MasterDetailLayout mit Summary-Panel', () => {
    const source = readSrc('src/screens/stationaer/ResidentsAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('ResidentDetailSummaryPanel');
  });

  it('ResidentListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/stationaer/ResidentListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('residentListService nutzt guardServiceTenant und Live-Repo', () => {
    const source = readSrc('src/lib/stationaer/residentListService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('stationaerSupabaseRepository');
    expect(source).toContain('listMapped');
    expect(source).not.toContain('blockDemoOnlyInLiveMode');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('residentDetailService nutzt guardServiceTenant und Live-Repo', () => {
    const source = readSrc('src/lib/stationaer/residentDetailService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('getDetailMapped');
  });

  it('Bewohner-Tab nutzt BewohnerinnenListScreen', () => {
    const source = readSrc('app/stationaer/(tabs)/bewohner.tsx');
    expect(source).toContain('BewohnerinnenListScreen');
  });

  it('ResidentsListView nutzt Desktop-Tabellenansicht ab desktop breakpoint', () => {
    const source = readSrc('src/components/stationaer/ResidentsListView.tsx');
    expect(source).toContain('useDeviceClass');
    expect(source).toContain('isDesktopClass');
    expect(source).toContain('ResidentsListTable');
  });

  it('ResidentsListTable hat Spalten Name, Status, Zimmer, Bereich, Pflegegrad, Aufnahme, Aktionen', () => {
    const source = readSrc('src/components/stationaer/ResidentsListTable.tsx');
    expect(source).toContain("label: 'Name'");
    expect(source).toContain("label: 'Status'");
    expect(source).toContain("label: 'Zimmer'");
    expect(source).toContain("label: 'Bereich'");
    expect(source).toContain("label: 'Pflegegrad'");
    expect(source).toContain("label: 'Aufnahme'");
    expect(source).toContain("label: 'Aktionen'");
    expect(source).toContain('PremiumDataTable');
  });

  it('ResidentsListTable nutzt sortierbare Spalten', () => {
    const source = readSrc('src/components/stationaer/ResidentsListTable.tsx');
    expect(source).toContain('sortable: true');
    expect(source).toContain('onSortColumn');
  });
});
