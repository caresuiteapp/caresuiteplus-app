import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Desktop list view toggle (Sprint 30)', () => {
  it('DesktopListViewToggle bietet Karten- und Tabellen-Modus', () => {
    const source = readSrc('src/components/ui/DesktopListViewToggle.tsx');
    expect(source).toContain('SegmentedTabs');
    expect(source).toContain("'cards'");
    expect(source).toContain("'table'");
    expect(source).toContain('Karten');
    expect(source).toContain('Tabelle');
  });

  it('ClientsListHero integriert View-Toggle im PremiumListHeroFrame', () => {
    const source = readSrc('src/components/office/ClientsListHero.tsx');
    expect(source).toContain('DesktopListViewToggle');
    expect(source).toContain('showViewToggle');
    expect(source).toContain('PremiumListHeroFrame');
  });

  it('ClientsListView schaltet Tabellenansicht per viewMode auf Desktop', () => {
    const source = readSrc('src/components/office/ClientsListView.tsx');
    expect(source).toContain('viewMode');
    expect(source).toContain('setViewMode');
    expect(source).toContain('showViewToggle={isDesktop');
    expect(source).toContain('useTableLayout = isDesktop && viewMode');
    expect(source).toContain('ClientsListTable');
    expect(source).toContain('ClientListCard');
  });
});
