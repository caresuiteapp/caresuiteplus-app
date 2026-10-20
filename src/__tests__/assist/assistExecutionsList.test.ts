import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildExecutionListKpis } from '@/lib/assist/executionListStats';
import { getActiveDemoExecutions } from '@/data/demo/assignmentExecutions';
import { fetchExecutionList } from '@/lib/assist/executionListService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import { EXECUTION_PHASE_FILTERS, EXECUTION_SORT_OPTIONS } from '@/hooks/useExecutionList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Assist Durchführung list', () => {
  it('enforcePermission schützt Execution-List-Service', () => {
    expect(enforcePermission(null, 'assist.execution.view' as never)).not.toBeNull();
  });

  it('fetchExecutionList liefert Demo-Einsätze zur Durchführung', async () => {
    const result = await fetchExecutionList(DEMO_TENANT_ID, 'caregiver');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.assignmentId).toBeTruthy();
    }
  });

  it('buildExecutionListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const items = getActiveDemoExecutions();
    const kpis = buildExecutionListKpis(items);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'execution-kpi-ready')).toBe(true);
  });

  it('Phase- und Sortierfilter sind vollständig definiert', () => {
    expect(EXECUTION_PHASE_FILTERS.some((f) => f.key === 'pending')).toBe(true);
    expect(EXECUTION_SORT_OPTIONS.some((o) => o.key === 'time_asc')).toBe(true);
  });

  it('ExecutionsListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/assist/ExecutionsListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('ExecutionsAdaptiveScreen nutzt MasterDetailLayout mit Summary-Panel', () => {
    const source = readSrc('src/screens/assist/ExecutionsAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('ExecutionDetailSummaryPanel');
  });

  it('ExecutionListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/assist/ExecutionListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('executionListService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/assist/executionListService.ts');
    expect(source).toContain('guardServiceTenant');
  });

  it('executionService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/assist/executionService.ts');
    expect(source).toContain('guardServiceTenant');
  });

  it('ExecutionsListView nutzt Desktop-Tabellenansicht ab desktop breakpoint', () => {
    const source = readSrc('src/components/assist/ExecutionsListView.tsx');
    expect(source).toContain('useDeviceClass');
    expect(source).toContain('isDesktopClass');
    expect(source).toContain('ExecutionsListTable');
  });

  it('ExecutionsListTable hat Spalten Einsatz, Klient, Phase, Zeit, Ort, Aktionen', () => {
    const source = readSrc('src/components/assist/ExecutionsListTable.tsx');
    expect(source).toContain("label: 'Einsatz'");
    expect(source).toContain("label: 'Klient'");
    expect(source).toContain("label: 'Phase'");
    expect(source).toContain("label: 'Zeit'");
    expect(source).toContain("label: 'Ort'");
    expect(source).toContain("label: 'Aktionen'");
    expect(source).toContain('PremiumDataTable');
  });

  it('ExecutionsListTable nutzt sortierbare Spalten', () => {
    const source = readSrc('src/components/assist/ExecutionsListTable.tsx');
    expect(source).toContain('sortable: true');
    expect(source).toContain('onSortColumn');
  });
});
