import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Desktop list view toggle Bewohner (Sprint 43)', () => {
  it('ResidentsListHero integriert View-Toggle im PremiumListHeroFrame', () => {
    const source = readSrc('src/components/stationaer/ResidentsListHero.tsx');
    expect(source).toContain('DesktopListViewToggle');
    expect(source).toContain('showViewToggle');
    expect(source).toContain('CareLightListHeroFrame');
  });

  it('ResidentsListView schaltet Tabellenansicht per viewMode auf Desktop', () => {
    const source = readSrc('src/components/stationaer/ResidentsListView.tsx');
    expect(source).toContain('viewMode');
    expect(source).toContain('setViewMode');
    expect(source).toContain('showViewToggle={isDesktop');
    expect(source).toContain('useTableLayout = isDesktop && viewMode');
    expect(source).toContain('ResidentsListTable');
    expect(source).toContain('ResidentListCard');
  });

  it('ResidentsListView nutzt useDesktopListViewPreference', () => {
    const source = readSrc('src/components/stationaer/ResidentsListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'stationaer.residents'");
    expect(source).not.toMatch(/useState<'cards' \| 'table'>/);
  });

  it('ResidentsListView nutzt wiederverwendbaren DesktopListViewToggle aus Sprint 30', () => {
    const hero = readSrc('src/components/stationaer/ResidentsListHero.tsx');
    const toggle = readSrc('src/components/ui/DesktopListViewToggle.tsx');
    expect(hero).toContain('DesktopListViewToggle');
    expect(toggle).toContain('Karten');
    expect(toggle).toContain('Tabelle');
  });
});
