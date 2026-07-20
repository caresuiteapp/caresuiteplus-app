import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseTenantServiceCatalogId,
  tenantServiceCatalogId,
} from '@/lib/catalog/catalogService';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Office Rechnungsdetail und Leistungskatalog', () => {
  it('übergibt die Rechnungs-ID aus der Vorschau an die eingebettete Detailansicht', () => {
    const modal = read('src/components/office/invoicedetailmodal.tsx');
    const detail = read('src/screens/office/InvoiceDetailScreen.tsx');

    expect(modal).toContain('<InvoiceDetailScreen invoiceId={invoiceId} embedded />');
    expect(detail).toContain('const id = invoiceId ?? normalizedRouteId;');
    expect(detail).toContain('type InvoiceDetailScreenProps');
  });

  it('verwendet im Office denselben mandantenscharfen Katalog wie die Rechnungserstellung', () => {
    const service = read('src/lib/catalog/catalogService.ts');
    const hero = read('src/components/catalog/CatalogsListHero.tsx');

    expect(service).toContain("fromUnknownTable(client, 'tenant_service_catalog')");
    expect(service).toContain("fromUnknownTable(client, 'tenant_service_prices')");
    expect(service).toContain('INVOICE_MODULES.flatMap');
    expect(hero).toContain('dieselben Positionen werden bei der Rechnungserstellung verwendet');
    expect(hero).not.toContain('Migration 0025–0026');
  });

  it('bildet stabile virtuelle Katalog-IDs je Leistungsmodul', () => {
    expect(tenantServiceCatalogId('assist')).toBe('tenant-service:assist');
    expect(parseTenantServiceCatalogId('tenant-service:pflege')).toBe('pflege');
    expect(parseTenantServiceCatalogId('tenant-service:unbekannt')).toBeNull();
    expect(parseTenantServiceCatalogId('legacy-id')).toBeNull();
  });
});

