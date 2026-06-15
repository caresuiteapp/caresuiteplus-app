import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Desktop list view toggle Einsatzplanung (Sprint 92)', () => {
  it('AssignmentsListHero integriert View-Toggle im PremiumListHeroFrame', () => {
    const source = readSrc('src/components/assist/AssignmentsListHero.tsx');
    expect(source).toContain('DesktopListViewToggle');
    expect(source).toContain('showViewToggle');
    expect(source).toContain('CareLightListHeroFrame');
  });

  it('AssignmentsListView schaltet Tabellenansicht per viewMode auf Desktop', () => {
    const source = readSrc('src/components/assist/AssignmentsListView.tsx');
    expect(source).toContain('viewMode');
    expect(source).toContain('setViewMode');
    expect(source).toContain("useDesktopListViewPreference('assist.assignments')");
    expect(source).toContain('showViewToggle={isDesktop');
    expect(source).toContain('useTableLayout = isDesktop && viewMode');
    expect(source).toContain('AssignmentsListTable');
    expect(source).toContain('AssignmentListCard');
  });

  it('AssignmentsListTable nutzt PremiumDataTable', () => {
    const source = readSrc('src/components/assist/AssignmentsListTable.tsx');
    expect(source).toContain('PremiumDataTable');
  });
});
