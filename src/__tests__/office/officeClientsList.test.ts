import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildClientListKpis,
  CLIENT_CARE_LEVEL_FILTERS,
  filterClientsByCareLevel,
} from '@/data/demo/clientListStats';
import { demoClients } from '@/data/demo/clients';
import { fetchClientList } from '@/lib/office/clientListService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { CLIENT_STATUS_FILTERS, CLIENT_SORT_OPTIONS } from '@/hooks/useClientList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office Klient:innen list', () => {
  it('enforcePermission schützt Client-List-Service', () => {
    expect(enforcePermission(null, 'office.clients.view' as never)).not.toBeNull();
  });

  it('fetchClientList liefert Demo-Klient:innen', async () => {
    const result = await fetchClientList(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.firstName).toBeTruthy();
    }
  });

  it('buildClientListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const kpis = buildClientListKpis(demoClients);
    expect(kpis.length).toBe(3);
    expect(kpis[0]?.value).toBe(demoClients.length);
    expect(kpis.some((k) => k.id === 'clients-kpi-intake')).toBe(true);
  });

  it('Pflegegrad-Filter schränkt Liste ein', () => {
    const pg2 = filterClientsByCareLevel(demoClients, 'PG 2');
    expect(pg2.every((c) => c.careLevel === 'PG 2')).toBe(true);
    const none = filterClientsByCareLevel(demoClients, 'none');
    expect(none.every((c) => !c.careLevel)).toBe(true);
    expect(CLIENT_CARE_LEVEL_FILTERS.some((f) => f.key === 'PG 3')).toBe(true);
  });

  it('Status- und Sortierfilter sind vollständig definiert', () => {
    expect(CLIENT_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(CLIENT_SORT_OPTIONS.some((o) => o.key === 'name_asc')).toBe(true);
  });

  it('ClientsListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/office/ClientsListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('Pflegegrad');
    expect(source).toContain('EmptyState');
    expect(source).toContain('ErrorState');
    expect(source).toContain('LoadingState');
    expect(source).toContain('clientCreateRoute');
    expect(source).toContain('clientRecordRoute');
    expect(source).not.toContain("'/office/clients/create'");
    expect(source).not.toContain('Coming Soon');
    expect(source).not.toContain('onPress={() => {}}');
  });

  it('ClientsAdaptiveScreen nutzt AdaptiveListDetail mit Summary-Panel', () => {
    const source = readSrc('src/screens/office/ClientsAdaptiveScreen.tsx');
    expect(source).toContain('AdaptiveListDetail');
    expect(source).toContain('ClientDetailSummaryPanel');
    expect(source).toContain('embedded');
    expect(source).not.toContain('ClientDetailScreen');
  });

  it('ClientDetailSummaryPanel zeigt Kontakt und Verknüpfungen', () => {
    const source = readSrc('src/components/office/ClientDetailSummaryPanel.tsx');
    expect(source).toContain('Vollständige Akte öffnen');
    expect(source).toContain('ContextCard');
    expect(source).toContain('useClientDetail');
    expect(source).not.toContain('Coming Soon');
  });

  it('ClientListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/office/ClientListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('clientListService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/office/clientListService.ts');
    expect(source).toContain('guardServiceTenant');
  });

  it('ClientsListView nutzt Desktop-Tabellenansicht ab desktop breakpoint', () => {
    const source = readSrc('src/components/office/ClientsListView.tsx');
    expect(source).toContain('useDeviceClass');
    expect(source).toContain('isDesktopClass');
    expect(source).toContain('ClientsListTable');
  });

  it('ClientsListTable hat Spalten Name, Status, Ort, Pflegegrad, Aktionen', () => {
    const source = readSrc('src/components/office/ClientsListTable.tsx');
    expect(source).toContain("label: 'Name'");
    expect(source).toContain("label: 'Status'");
    expect(source).toContain("label: 'Ort'");
    expect(source).toContain("label: 'Pflegegrad'");
    expect(source).toContain("label: 'Aktionen'");
    expect(source).toContain('PremiumDataTable');
  });

  it('PremiumDataTable ist wiederverwendbare Tabellen-Hülle', () => {
    const source = readSrc('src/components/ui/PremiumDataTable.tsx');
    expect(source).toContain('headerRow');
    expect(source).toContain('dataRowSelected');
    expect(source).toContain('designTokens.glass');
    expect(source).toContain('onSortColumn');
    expect(source).toContain('sortable');
  });

  it('ClientsListTable nutzt sortierbare Spalten', () => {
    const source = readSrc('src/components/office/ClientsListTable.tsx');
    expect(source).toContain('sortable: true');
    expect(source).toContain('onSortColumn');
  });
});
