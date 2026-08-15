import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Desktop list view toggle Einsatzplanung (Sprint 92)', () => {
  it('AssignmentsListHero zeigt operative Lage, Live-Metadaten und Kalenderaktion', () => {
    const source = readSrc('src/components/assist/AssignmentsListHero.tsx');
    expect(source).toContain('Operative Einsatzlage');
    expect(source).toContain('LIVE-DISPOSITION');
    expect(source).toContain('Kalender öffnen');
    expect(source).toContain('kpis.slice(0, 4)');
  });

  it('AssignmentsListView schaltet Tabellenansicht per viewMode auf Desktop', () => {
    const source = readSrc('src/components/assist/AssignmentsListView.tsx');
    expect(source).toContain('viewMode');
    expect(source).toContain('setViewMode');
    expect(source).toContain("useDesktopListViewPreference('assist.assignments.v2', 'cards')");
    expect(source).toContain('DesktopListViewToggle');
    expect(source).toContain('viewToggleRow');
    expect(source).toContain('useTableLayout = isDesktop && viewMode');
    expect(source).toContain('AssignmentsListTable');
    expect(source).toContain('AssignmentsCardGrid');
  });

  it('AssignmentsListTable nutzt PremiumDataTable', () => {
    const source = readSrc('src/components/assist/AssignmentsListTable.tsx');
    expect(source).toContain('PremiumDataTable');
  });
});
