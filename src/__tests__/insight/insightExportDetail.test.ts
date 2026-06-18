import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDemoInsightExportDetail } from '@/data/demo/insightDemo';
import { buildInsightExportDetailKpis } from '@/lib/insight';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('InsightCenter Export Detail (Sprint 94)', () => {
  it('InsightExportDetailHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/insight/InsightExportDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('INSIGHTCENTER');
    expect(hero).toContain('isInsightLiveReady');
  });

  it('Route /insight/exports/[id] und Service vorhanden', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/insight/exports/[id].tsx'))).toBe(true);
    const service = readSrc('src/lib/insight/insightDashboardService.ts');
    expect(service).toContain('fetchInsightExportDetail');
  });

  it('InsightExportsListView navigiert zu Export-Detail', () => {
    const view = readSrc('src/components/insight/InsightExportsListView.tsx');
    expect(view).toContain('/insight/exports/');
    expect(readSrc('src/screens/insight/InsightExportsListScreen.tsx')).toContain('InsightExportsListView');
  });

  it('Demo-Export-Detail ist preparedOnly', () => {
    const detail = getDemoInsightExportDetail('export-csv-weekly');
    expect(detail?.lastRunLabel).toContain('preparedOnly');
    const kpis = buildInsightExportDetailKpis(detail!);
    expect(kpis[2]?.subValue).toContain('preparedOnly');
  });
});
