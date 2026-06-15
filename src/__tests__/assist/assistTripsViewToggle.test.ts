import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Desktop list view toggle Fahrten (Sprint 35)', () => {
  it('TripsListHero integriert View-Toggle im PremiumListHeroFrame', () => {
    const source = readSrc('src/components/assist/TripsListHero.tsx');
    expect(source).toContain('DesktopListViewToggle');
    expect(source).toContain('showViewToggle');
    expect(source).toContain('CareLightListHeroFrame');
  });

  it('TripsListView schaltet Tabellenansicht per viewMode auf Desktop', () => {
    const source = readSrc('src/components/assist/TripsListView.tsx');
    expect(source).toContain('viewMode');
    expect(source).toContain('setViewMode');
    expect(source).toContain('showViewToggle={isDesktop');
    expect(source).toContain('useTableLayout = isDesktop && viewMode');
    expect(source).toContain('TripsListTable');
    expect(source).toContain('TripListCard');
  });

  it('TripsListView nutzt wiederverwendbaren DesktopListViewToggle aus Sprint 30', () => {
    const hero = readSrc('src/components/assist/TripsListHero.tsx');
    const toggle = readSrc('src/components/ui/DesktopListViewToggle.tsx');
    expect(hero).toContain('DesktopListViewToggle');
    expect(toggle).toContain("'cards'");
    expect(toggle).toContain("'table'");
  });
});
