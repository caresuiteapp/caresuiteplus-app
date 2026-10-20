import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { INVOICE_MODULES, isInvoiceModuleKey } from '@/lib/office/invoiceModules';

const root = path.join(__dirname, '..', '..', '..');
const readSrc = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('Office Rechnungs-Dashboard nach Modulen', () => {
  it('führt die vier fachlichen Abrechnungsbereiche zentral', () => {
    expect(INVOICE_MODULES.map((module) => module.key)).toEqual([
      'assist',
      'pflege',
      'stationaer',
      'beratung',
    ]);
    expect(isInvoiceModuleKey('office')).toBe(false);
  });

  it('filtert Nachweise und Katalogpositionen serverseitig nach Modul', () => {
    const source = readSrc('src/lib/office/invoiceCreateService.ts');
    expect(source).toContain(".eq('product_key', billingModule)");
    expect(source).toContain('selected.moduleKey !== billingModule');
    expect(source).toContain("billingModule === 'assist'");
  });

  it('übergibt das gewählte Modul vom Dashboard bis zur Anlage', () => {
    const dashboard = readSrc('src/screens/office/OfficeBillingScreen.tsx');
    const create = readSrc('src/screens/office/InvoiceCreateScreen.tsx');
    expect(dashboard).toContain('/office/invoices/create?module=');
    expect(dashboard).toContain('Modul-Dashboard');
    expect(create).toContain('Abrechnungsmodul');
    expect(create).toContain('billingModule,');
  });
});
