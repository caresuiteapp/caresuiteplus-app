import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Desktop list view toggle Mitarbeitende (Sprint 31)', () => {
  it('EmployeesListHero integriert View-Toggle im PremiumListHeroFrame', () => {
    const source = readSrc('src/components/office/EmployeesListHero.tsx');
    expect(source).toContain('DesktopListViewToggle');
    expect(source).toContain('showViewToggle');
    expect(source).toContain('CareLightListHeroFrame');
  });

  it('EmployeesListView schaltet Tabellenansicht per viewMode auf Desktop', () => {
    const source = readSrc('src/components/office/EmployeesListView.tsx');
    expect(source).toContain('viewMode');
    expect(source).toContain('setViewMode');
    expect(source).toContain('showViewToggle={isDesktop');
    expect(source).toContain('useTableLayout = isDesktop && viewMode');
    expect(source).toContain('EmployeesListTable');
    expect(source).toContain('EmployeeListCard');
  });

  it('EmployeesListView nutzt wiederverwendbaren DesktopListViewToggle aus Sprint 30', () => {
    const hero = readSrc('src/components/office/EmployeesListHero.tsx');
    const toggle = readSrc('src/components/ui/DesktopListViewToggle.tsx');
    expect(hero).toContain('DesktopListViewToggle');
    expect(toggle).toContain("'cards'");
    expect(toggle).toContain("'table'");
  });
});
