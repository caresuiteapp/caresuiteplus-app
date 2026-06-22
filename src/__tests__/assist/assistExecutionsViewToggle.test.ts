import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Desktop list view toggle Durchführung (Sprint 35)', () => {
  it('ExecutionsListHero integriert View-Toggle im PremiumListHeroFrame', () => {
    const source = readSrc('src/components/assist/ExecutionsListHero.tsx');
    expect(source).toContain('DesktopListViewToggle');
    expect(source).toContain('showViewToggle');
    expect(source).toContain('PremiumListHeroFrame');
  });

  it('ExecutionsListView schaltet Tabellenansicht per viewMode auf Desktop', () => {
    const source = readSrc('src/components/assist/ExecutionsListView.tsx');
    expect(source).toContain('viewMode');
    expect(source).toContain('setViewMode');
    expect(source).toContain('showViewToggle={isDesktop');
    expect(source).toContain('useTableLayout = isDesktop && viewMode');
    expect(source).toContain('ExecutionsListTable');
    expect(source).toContain('ExecutionListCard');
  });

  it('ExecutionsListView nutzt wiederverwendbaren DesktopListViewToggle aus Sprint 30', () => {
    const hero = readSrc('src/components/assist/ExecutionsListHero.tsx');
    const toggle = readSrc('src/components/ui/DesktopListViewToggle.tsx');
    expect(hero).toContain('DesktopListViewToggle');
    expect(toggle).toContain("'cards'");
    expect(toggle).toContain("'table'");
  });
});
