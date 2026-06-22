import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildReportListKpis } from '@/lib/reporting/reportListStats';
import { demoReportList } from '@/data/demo/reportingDemo';
import { fetchReportList } from '@/lib/reporting';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import {
  REPORT_CATEGORY_FILTERS,
  REPORT_SORT_OPTIONS,
  REPORT_STATUS_FILTERS,
} from '@/hooks/useReportList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Business Reporting list', () => {
  it('enforcePermission schützt Reporting-Service', () => {
    expect(enforcePermission(null, 'business.reporting.view')).not.toBeNull();
  });

  it('fetchReportList liefert Demo-Berichte', async () => {
    const result = await fetchReportList(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.title).toBeTruthy();
    }
  });

  it('buildReportListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const kpis = buildReportListKpis(demoReportList);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'report-kpi-active')).toBe(true);
  });

  it('Status-, Kategorie- und Sortierfilter sind vollständig definiert', () => {
    expect(REPORT_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(REPORT_CATEGORY_FILTERS.some((f) => f.key === 'pdl')).toBe(true);
    expect(REPORT_SORT_OPTIONS.some((o) => o.key === 'title_asc')).toBe(true);
  });

  it('ReportsListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/reporting/ReportsListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('ReportsAdaptiveScreen nutzt MasterDetailLayout mit Summary-Panel', () => {
    const source = readSrc('src/screens/reporting/ReportsAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('ReportDetailSummaryPanel');
  });

  it('ReportListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/reporting/ReportListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('useReportList exportiert allItems für KPIs', () => {
    const source = readSrc('src/hooks/useReportList.ts');
    expect(source).toContain('allItems');
    expect(source).toContain('categoryFilter');
  });

  it('Berichte-Route nutzt ReportsAdaptiveScreen', () => {
    const source = readSrc('app/business/reporting/list.tsx');
    expect(source).toContain('ReportsAdaptiveScreen');
  });

  it('ReportDetailSummaryPanel verlinkt zur Vollansicht', () => {
    const source = readSrc('src/components/reporting/ReportDetailSummaryPanel.tsx');
    expect(source).toContain('Vollständigen Bericht öffnen');
    expect(source).toContain('useReportDetail');
  });
});
