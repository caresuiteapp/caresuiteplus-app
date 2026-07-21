import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Office Integrität', () => {
  it('zeigt Zielgruppen nur einmal im Messenger und nicht erneut in der Seitenleiste', () => {
    const nav = read('src/lib/navigation/modulenav/officenav.ts');
    expect(nav).not.toContain("key: 'messages-clients'");
    expect(nav).not.toContain("key: 'messages-employees'");
    expect(nav).not.toContain("key: 'messages-internal'");
  });

  it('öffnet aus der Rechnungsliste das echte Rechnungsdetail-Popup', () => {
    const billing = read('src/screens/office/OfficeBillingScreen.tsx');
    expect(billing).toContain("import { InvoiceDetailModal } from '@/components/office/invoicedetailmodal'");
    expect(billing).not.toMatch(/function\s+InvoiceDetailModal[\s\S]*?return null;/);
  });

  it('rendert auf kritischen Detailseiten immer einen sichtbaren Zustand', () => {
    for (const file of [
      'src/screens/office/ClientDetailScreen.tsx',
      'src/screens/office/InvoiceDetailScreen.tsx',
      'src/screens/office/BudgetDetailScreen.tsx',
    ]) {
      expect(read(file)).not.toMatch(/if\s*\(!\w+\)\s*return null;/);
    }
  });

  it('fängt fehlende Klient:innen-IDs ohne weiße Route ab', () => {
    const route = read('app/office/clients/[id]/index.tsx');
    expect(route).toContain('if (!id) return <Redirect href="/office/clients" />');
  });

  it('räumt Polling-Listener auch in Test- und Native-Umgebungen sicher auf', () => {
    const polling = read('src/lib/polling/useVisibilityAwarePolling.ts');
    expect(polling).toContain('sub?.remove?.()');
  });

  it('bindet Nachrichten- und Kalender-Vorlagen an echte Datenquellen an', () => {
    const messages = read('src/screens/office/officemessagetemplatesscreen.tsx');
    const calendar = read('app/office/calendar/templates/index.tsx');
    expect(messages).toContain('MessageTemplatesScreen');
    expect(messages).not.toContain('Wird wiederhergestellt');
    expect(calendar).toContain('CalendarEventTemplatePicker');
    expect(calendar).not.toContain('Stub —');
  });

  it('verhindert tote Klicks in vorbereiteten QM- und Inventarbereichen', () => {
    const qm = read('src/screens/qm/QmDashboardScreen.tsx');
    const inventory = read('src/screens/inventory/InventoryDashboardScreen.tsx');
    expect(qm).toContain('onPress={area.liveReady ?');
    expect(inventory).toContain('onPress={area.liveReady === false ? undefined');
    expect(qm).not.toContain('title="QM preparedOnly"');
    expect(inventory).not.toContain('title="Inventar preparedOnly"');
  });

  it('verwendet im Office Reporting nur den Scrollbereich des ScreenShell', () => {
    const reporting = read('src/screens/business/office/OfficeBusinessReportingScreen.tsx');
    expect(reporting).not.toContain('<ScrollView');
  });

  it('lädt die Dokumentenablage nur einmal über die zentrale Listenkomponente', () => {
    const documents = read('src/screens/office/OfficeDocumentsListScreen.tsx');
    expect(documents).toContain('<DocumentsListView />');
    expect(documents).not.toContain('fetchOfficeDocumentList');
    expect(documents).not.toContain('useAsyncQuery');
  });
});
