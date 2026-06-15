import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mapReportRowToDetail } from '@/lib/reporting/reportDetailMapper';
import type { ReportDetailLiveRow } from '@/lib/reporting/reportDetailMapper';
import { mapReportRowsToListItems } from '@/lib/reporting/reportListMapper';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('reporting_reports live detail mapping', () => {
  const completeRow: ReportDetailLiveRow = {
    id: 'report-001',
    tenant_id: DEMO_TENANT_ID,
    title: 'PDL-Wochenbericht KW 24',
    category: 'pdl',
    period: '2026-06-09 – 2026-06-15',
    status: 'aktiv',
    summary: 'Aggregierte KPIs aus Einsatzplanung und Qualität.',
    kpi_snapshot: [
      {
        id: 'kpi-1',
        label: 'Einsatzabdeckung',
        value: '94%',
        icon: '📅',
        accentColor: '#62F3FF',
      },
    ],
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-11T00:00:00.000Z',
  };

  it('Migration 0028 fügt Detail-Felder mit IF NOT EXISTS hinzu', () => {
    const sql = readSrc('supabase/migrations/0028_reporting_reports_live_detail.sql');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS summary');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS kpi_snapshot');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('mapReportRowsToListItems mappt vollständige Zeilen', () => {
    const result = mapReportRowsToListItems([completeRow]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.title).toBe('PDL-Wochenbericht KW 24');
      expect(result.data[0]?.category).toBe('pdl');
    }
  });

  it('mapReportRowToDetail mappt vollständige Zeile', () => {
    const result = mapReportRowToDetail(completeRow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.summary).toContain('Aggregierte KPIs');
      expect(result.data.kpiSnapshot.length).toBe(1);
    }
  });

  it('mapReportRowToDetail meldet fehlendes Schema ehrlich', () => {
    const incomplete: ReportDetailLiveRow = {
      ...completeRow,
      summary: undefined,
    };
    const result = mapReportRowToDetail(incomplete);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Schema unvollständig');
      expect(result.error).toContain('summary');
    }
  });

  it('reportingRepository nutzt REPORT_DETAIL_SELECT_COLUMNS und getDetailMapped', () => {
    const source = readSrc('src/lib/services/repositories/reportingRepository.supabase.ts');
    expect(source).toContain('REPORT_DETAIL_SELECT_COLUMNS');
    expect(source).toContain('getDetailMapped');
    expect(source).toContain('listMapped');
  });

  it('fetchReportDetail nutzt Supabase-Repo ohne Demo-Fallback in Live-Pfad', () => {
    const source = readSrc('src/lib/reporting/reportingService.ts');
    expect(source).toContain('getDetailMapped');
    expect(source).toMatch(
      /fetchReportDetail[\s\S]*getServiceMode\(\) === 'supabase'[\s\S]*getDetailMapped/,
    );
  });

  it('fetchReportList nutzt Supabase-Repo ohne Demo-Fallback in Live-Pfad', () => {
    const source = readSrc('src/lib/reporting/reportingService.ts');
    expect(source).toContain('listMapped');
    expect(source).toMatch(
      /fetchReportList[\s\S]*getServiceMode\(\) === 'supabase'[\s\S]*listMapped/,
    );
    expect(source).toContain('guardServiceTenant');
    expect(source).not.toMatch(/REPORTING_DEMO_TENANT/);
  });

  it('useReportList nutzt useServiceTenantId', () => {
    const source = readSrc('src/hooks/useReportList.ts');
    expect(source).toContain('useServiceTenantId');
    expect(source).not.toMatch(/REPORTING_DEMO_TENANT/);
  });
});
