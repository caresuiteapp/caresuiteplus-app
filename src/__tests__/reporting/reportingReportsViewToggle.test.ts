import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Desktop list view toggle Business Reporting (Sprint 93)', () => {
  it('ReportsListHero integriert View-Toggle und Live-Badge', () => {
    const source = readSrc('src/components/reporting/ReportsListHero.tsx');
    expect(source).toContain('DesktopListViewToggle');
    expect(source).toContain('showViewToggle');
    expect(source).toContain('isReportsListLiveReady');
    expect(source).toContain('PremiumListHeroFrame');
  });

  it('ReportsListView schaltet Tabellenansicht per viewMode auf Desktop', () => {
    const source = readSrc('src/components/reporting/ReportsListView.tsx');
    expect(source).toContain('viewMode');
    expect(source).toContain('setViewMode');
    expect(source).toContain("useDesktopListViewPreference('business.reporting')");
    expect(source).toContain('showViewToggle={isDesktop');
    expect(source).toContain('useTableLayout = isDesktop && viewMode');
    expect(source).toContain('ReportsListTable');
    expect(source).toContain('ReportListCard');
  });

  it('ReportsListTable nutzt PremiumDataTable', () => {
    const source = readSrc('src/components/reporting/ReportsListTable.tsx');
    expect(source).toContain('PremiumDataTable');
  });

  it('isReportsListLiveReady folgt Service-Mode', () => {
    const source = readSrc('src/lib/reporting/reportingModuleConfig.ts');
    expect(source).toContain('isReportsListLiveReady');
  });
});
