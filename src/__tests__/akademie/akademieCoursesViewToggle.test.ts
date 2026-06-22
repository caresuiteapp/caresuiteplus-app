import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Desktop list view toggle Kurse (Sprint 43)', () => {
  it('CoursesListHero integriert View-Toggle im PremiumListHeroFrame', () => {
    const source = readSrc('src/components/akademie/CoursesListHero.tsx');
    expect(source).toContain('DesktopListViewToggle');
    expect(source).toContain('showViewToggle');
    expect(source).toContain('PremiumListHeroFrame');
  });

  it('CoursesListView schaltet Tabellenansicht per viewMode auf Desktop', () => {
    const source = readSrc('src/components/akademie/CoursesListView.tsx');
    expect(source).toContain('viewMode');
    expect(source).toContain('setViewMode');
    expect(source).toContain('showViewToggle={isDesktop');
    expect(source).toContain('useTableLayout = isDesktop && viewMode');
    expect(source).toContain('CoursesListTable');
    expect(source).toContain('CourseListCard');
  });

  it('CoursesListView nutzt useDesktopListViewPreference', () => {
    const source = readSrc('src/components/akademie/CoursesListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'akademie.courses'");
    expect(source).not.toMatch(/useState<'cards' \| 'table'>/);
  });

  it('CoursesListView nutzt wiederverwendbaren DesktopListViewToggle aus Sprint 30', () => {
    const hero = readSrc('src/components/akademie/CoursesListHero.tsx');
    const toggle = readSrc('src/components/ui/DesktopListViewToggle.tsx');
    expect(hero).toContain('DesktopListViewToggle');
    expect(toggle).toContain('Karten');
    expect(toggle).toContain('Tabelle');
  });
});
