import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildCaseListKpis } from '@/lib/beratung/caseListStats';
import { getDemoCounselingCaseListItems } from '@/data/demo/counselingCases';
import { fetchCounselingCaseList } from '@/lib/beratung/caseListService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import { CASE_SORT_OPTIONS, CASE_STATUS_FILTERS } from '@/hooks/useCounselingCaseList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Beratung Fälle list', () => {
  it('enforcePermission schützt Case-List-Service', () => {
    expect(enforcePermission(null, 'beratung.cases.view' as never)).not.toBeNull();
  });

  it('fetchCounselingCaseList liefert Demo-Fälle', async () => {
    const result = await fetchCounselingCaseList(DEMO_TENANT_ID, 'counselor');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.subject).toBeTruthy();
    }
  });

  it('buildCaseListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const items = getDemoCounselingCaseListItems();
    const kpis = buildCaseListKpis(items);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'cases-kpi-open')).toBe(true);
  });

  it('Status- und Sortierfilter sind vollständig definiert', () => {
    expect(CASE_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(CASE_SORT_OPTIONS.some((o) => o.key === 'opened_desc')).toBe(true);
  });

  it('CasesListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/beratung/CasesListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('CasesAdaptiveScreen nutzt MasterDetailLayout mit Summary-Panel', () => {
    const source = readSrc('src/screens/beratung/CasesAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('CaseDetailSummaryPanel');
  });

  it('CounselingCaseListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/beratung/CounselingCaseListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('caseListService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/beratung/caseListService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).not.toContain('blockDemoOnlyInLiveMode');
  });

  it('caseDetailService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/beratung/caseDetailService.ts');
    expect(source).toContain('guardServiceTenant');
  });

  it('Beratungsfälle-Tab nutzt CasesAdaptiveScreen', () => {
    const source = readSrc('app/beratung/(tabs)/cases.tsx');
    expect(source).toContain('CasesAdaptiveScreen');
  });
});
