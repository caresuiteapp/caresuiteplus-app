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

  it('MasterDetailLayout owns the responsive split panes', () => {
    const source = readSrc('src/components/layout/MasterDetailLayout.tsx');
    expect(source).toContain('useMasterDetail');
    expect(source).toContain('{master}');
    expect(source).toContain('showDetail ? detail : placeholder');
  });

  it('AdaptiveListDetail nutzt MasterDetailLayout', () => {
    const source = readSrc('src/components/adaptive/AdaptiveListDetail.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).not.toContain('flexDirection: \'row\'');
  });

  it('OfficeMessagesAdaptiveScreen nutzt den kanonischen Messenger', () => {
    const source = readSrc('src/screens/office/OfficeMessagesAdaptiveScreen.tsx');
    expect(source).toContain('OfficeMessengerScreen');
  });
});

describe('Office Nachrichten list layout', () => {
  it('OfficeMessageCompactRow verhindert Textüberlappung', () => {
    const source = readSrc('src/components/office/OfficeMessageCompactRow.tsx');
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain('minWidth: 0');
    expect(source).toContain('flex: 1');
  });

  it('OfficeMessagesListView nutzt einen eigenen eingebetteten Kopf', () => {
    const source = readSrc('src/components/office/OfficeMessagesListView.tsx');
    expect(source).toContain('styles.embeddedHeader');
    expect(source).toContain('embedded ?');
    expect(source).toContain('&& !embedded');
  });

  it('Tabellenansicht ist im eingebetteten Modus deaktiviert', () => {
    const source = readSrc('src/components/office/OfficeMessagesListView.tsx');
    expect(source).toMatch(/useTableLayout = isDesktop && viewMode === 'table' && !embedded/);
  });

  it('Standard-Ansicht für Nachrichten ist Karten statt Tabelle', () => {
    const source = readSrc('src/components/office/OfficeMessagesListView.tsx');
    expect(source).toContain("useDesktopListViewPreference('office.messages')");
  });
});

describe('Office list views embedded table guard', () => {
  const listViews = [
    'ClientsListView.tsx',
    'EmployeesListView.tsx',
    'InvoicesListView.tsx',
    'AppointmentsListView.tsx',
  ];

  for (const file of listViews) {
    it(`${file} deaktiviert Tabelle im eingebetteten Modus`, () => {
      const source = readSrc(`src/components/office/${file}`);
      expect(source).toMatch(/useTableLayout = isDesktop && viewMode === 'table' && !embedded/);
    });
  }
});
