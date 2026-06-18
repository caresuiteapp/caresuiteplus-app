import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('ListDetailLayout', () => {
  it('rendert vertikal: Liste oben, Detail unten', () => {
    const source = readSrc('src/components/layout/ListDetailLayout.tsx');
    expect(source).toContain('flexDirection: \'column\'');
    expect(source).toContain('listPane');
    expect(source).toContain('detailPane');
    expect(source).toContain('showDetail ? detail : placeholder');
  });

  it('zeigt auf Phone nur die Liste', () => {
    const source = readSrc('src/components/layout/ListDetailLayout.tsx');
    expect(source).toContain('useMasterDetail');
    expect(source).toContain('styles.phone');
  });

  it('MasterDetailLayout delegiert an ListDetailLayout', () => {
    const source = readSrc('src/components/layout/MasterDetailLayout.tsx');
    expect(source).toContain('ListDetailLayout');
    expect(source).toContain('list={master}');
  });

  it('AdaptiveListDetail nutzt ListDetailLayout', () => {
    const source = readSrc('src/components/adaptive/AdaptiveListDetail.tsx');
    expect(source).toContain('ListDetailLayout');
    expect(source).not.toContain('flexDirection: \'row\'');
  });

  it('OfficeMessagesAdaptiveScreen nutzt AdaptiveListDetail', () => {
    const source = readSrc('src/screens/office/OfficeMessagesAdaptiveScreen.tsx');
    expect(source).toContain('AdaptiveListDetail');
    expect(source).toContain('OfficeMessageDetailSummaryPanel');
  });
});

describe('Office Nachrichten list layout', () => {
  it('OfficeMessageCompactRow verhindert Textüberlappung', () => {
    const source = readSrc('src/components/office/OfficeMessageCompactRow.tsx');
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain('minWidth: 0');
    expect(source).toContain('flex: 1');
  });

  it('OfficeMessagesListView nutzt Kompaktzeilen im eingebetteten Modus', () => {
    const source = readSrc('src/components/office/OfficeMessagesListView.tsx');
    expect(source).toContain('OfficeMessageCompactRow');
    expect(source).toContain('embedded ?');
    expect(source).toContain('&& !embedded');
  });

  it('Tabellenansicht ist im eingebetteten Modus deaktiviert', () => {
    const source = readSrc('src/components/office/OfficeMessagesListView.tsx');
    expect(source).toMatch(/useTableLayout = isDesktop && viewMode === 'table' && !embedded/);
  });

  it('Standard-Ansicht für Nachrichten ist Karten statt Tabelle', () => {
    const source = readSrc('src/components/office/OfficeMessagesListView.tsx');
    expect(source).toContain("useDesktopListViewPreference('office.messages', 'cards')");
  });
});

describe('Office list views embedded table guard', () => {
  const listViews = [
    'ClientsListView.tsx',
    'EmployeesListView.tsx',
    'InvoicesListView.tsx',
    'AppointmentsListView.tsx',
    'DocumentsListView.tsx',
  ];

  for (const file of listViews) {
    it(`${file} deaktiviert Tabelle im eingebetteten Modus`, () => {
      const source = readSrc(`src/components/office/${file}`);
      expect(source).toMatch(/useTableLayout = isDesktop && viewMode === 'table' && !embedded/);
    });
  }
});
