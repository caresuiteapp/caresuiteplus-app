import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildCarePlanListKpis } from '@/lib/pflege/carePlanListStats';
import { getDemoCarePlanListItems } from '@/data/demo/carePlans';
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import { fetchCarePlanDetail } from '@/lib/pflege/carePlanDetailService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import { CARE_PLAN_STATUS_FILTERS, CARE_PLAN_SORT_OPTIONS } from '@/hooks/useCarePlanList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Pflege Pflegepläne list', () => {
  it('enforcePermission schützt CarePlan-List-Service', () => {
    expect(enforcePermission(null, 'pflege.plans.view' as never)).not.toBeNull();
  });

  it('fetchCarePlanList liefert Demo-Pflegepläne', async () => {
    const result = await fetchCarePlanList(DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.title).toBeTruthy();
    }
  });

  it('fetchCarePlanDetail liefert Demo-Detail', async () => {
    const result = await fetchCarePlanDetail('plan-001', DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toContain('Grundpflege');
    }
  });

  it('buildCarePlanListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const items = getDemoCarePlanListItems();
    const kpis = buildCarePlanListKpis(items);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'careplans-kpi-active')).toBe(true);
  });

  it('Status- und Sortierfilter sind vollständig definiert', () => {
    expect(CARE_PLAN_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(CARE_PLAN_SORT_OPTIONS.some((o) => o.key === 'client_asc')).toBe(true);
  });

  it('CarePlansListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/pflege/CarePlansListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('CarePlansAdaptiveScreen nutzt MasterDetailLayout mit Summary-Panel', () => {
    const source = readSrc('src/screens/pflege/CarePlansAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('CarePlanDetailSummaryPanel');
  });

  it('CarePlanListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/pflege/CarePlanListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('carePlanListService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/pflege/carePlanListService.ts');
    expect(source).toContain('guardServiceTenant');
  });
});
