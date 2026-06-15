import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildVitalListKpis } from '@/data/demo/vitalListStats';
import { getDemoVitalReadings } from '@/data/demo/vitalReadings';
import { fetchVitalReadings } from '@/lib/pflege/vitalService';
import { fetchVitalReadingDetail } from '@/lib/pflege/vitalDetailService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import {
  VITAL_STATUS_FILTERS,
  VITAL_SORT_OPTIONS,
  VITAL_TYPE_FILTERS,
} from '@/hooks/useVitalReadingList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Pflege Vitalwerte list', () => {
  it('enforcePermission schützt Vital-List-Service', () => {
    expect(enforcePermission(null, 'pflege.vitals.view' as never)).not.toBeNull();
  });

  it('fetchVitalReadings liefert Demo-Messungen', async () => {
    const result = await fetchVitalReadings(DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.typeLabel).toBeTruthy();
    }
  });

  it('fetchVitalReadingDetail liefert Demo-Detail', async () => {
    const result = await fetchVitalReadingDetail('vital-001', DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.type).toBe('blood_pressure');
    }
  });

  it('buildVitalListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const items = getDemoVitalReadings();
    const kpis = buildVitalListKpis(items);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'vitals-kpi-due')).toBe(true);
  });

  it('Status-, Typ- und Sortierfilter sind vollständig definiert', () => {
    expect(VITAL_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(VITAL_TYPE_FILTERS.some((f) => f.key === 'blood_pressure')).toBe(true);
    expect(VITAL_SORT_OPTIONS.some((o) => o.key === 'measured_desc')).toBe(true);
  });

  it('VitalReadingsListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/pflege/VitalReadingsListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('VitalReadingsAdaptiveScreen nutzt MasterDetailLayout mit Summary-Panel', () => {
    const source = readSrc('src/screens/pflege/VitalReadingsAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('VitalReadingDetailSummaryPanel');
  });

  it('VitalReadingListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/pflege/VitalReadingListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('vitalService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/pflege/vitalService.ts');
    expect(source).toContain('guardServiceTenant');
  });

  it('vitalDetailService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/pflege/vitalDetailService.ts');
    expect(source).toContain('guardServiceTenant');
  });
});
