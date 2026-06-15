import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Desktop list view toggle Beratungsfälle (Sprint 92)', () => {
  it('CasesListHero integriert View-Toggle im PremiumListHeroFrame', () => {
    const source = readSrc('src/components/beratung/CasesListHero.tsx');
    expect(source).toContain('DesktopListViewToggle');
    expect(source).toContain('showViewToggle');
    expect(source).toContain('CareLightListHeroFrame');
  });

  it('CasesListView schaltet Tabellenansicht per viewMode auf Desktop', () => {
    const source = readSrc('src/components/beratung/CasesListView.tsx');
    expect(source).toContain('viewMode');
    expect(source).toContain('setViewMode');
    expect(source).toContain("useDesktopListViewPreference('beratung.cases')");
    expect(source).toContain('showViewToggle={isDesktop');
    expect(source).toContain('useTableLayout = isDesktop && viewMode');
    expect(source).toContain('CasesListTable');
    expect(source).toContain('CounselingCaseListCard');
  });

  it('CasesListTable nutzt PremiumDataTable', () => {
    const source = readSrc('src/components/beratung/CasesListTable.tsx');
    expect(source).toContain('PremiumDataTable');
  });
});
