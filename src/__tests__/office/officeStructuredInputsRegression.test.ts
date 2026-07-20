import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildBillingPeriodOptions,
  buildSystemInvoiceNumber,
  calculateDueDate,
} from '@/lib/office/invoiceSystemFields';
import {
  countInvoiceCoveredMonths,
  getInvoiceCatalogQuantities,
  parseInvoiceQuantity,
} from '@/lib/office/invoiceCreateService';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { isAllowedPersistentFreeTextPurpose } from '@/lib/forms/structuredFieldPolicy';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Office – systemgeführte Eingaben', () => {
  it('erzeugt Abrechnungszeiträume aus kontrollierten Monatswerten', () => {
    const options = buildBillingPeriodOptions(new Date(2026, 6, 20), 3);
    expect(options.map((option) => option.value)).toEqual(['2026-07', '2026-06', '2026-05']);
  });

  it('berechnet Fälligkeit und Rechnungsnummer automatisch', () => {
    expect(calculateDueDate('14', new Date(2026, 6, 20))).toBe('2026-08-03');
    expect(buildSystemInvoiceNumber('service', '2026-07', new Date(2026, 6, 20, 8, 5, 4))).toBe(
      'RE-202607-080504000',
    );
  });

  it('begrenzt persistenten Freitext auf echte Textinhalte', () => {
    expect(isAllowedPersistentFreeTextPurpose('note')).toBe(true);
    expect(isAllowedPersistentFreeTextPurpose('reason')).toBe(true);
    expect(isAllowedPersistentFreeTextPurpose('status')).toBe(false);
    expect(isAllowedPersistentFreeTextPurpose('client')).toBe(false);
  });

  it('ordnet Rechnungen über IDs und kontrollierte Auswahlen zu', () => {
    const screen = read('src/screens/office/InvoiceCreateScreen.tsx');
    expect(screen).toContain('clientId');
    expect(screen).toContain('INVOICE_TYPE_OPTIONS');
    expect(screen).toContain('PAYMENT_TERM_OPTIONS');
    expect(screen).not.toMatch(/<PremiumInput[\s\S]{0,120}label="Klient:in"/);
    expect(screen).toContain('label="Stunden *"');
  });

  it('schreibt Pflegegrade in Systemauswahlen immer als PG groß', () => {
    const screen = read('src/screens/office/InvoiceCreateScreen.tsx');
    expect(formatCareLevel('pg2')).toBe('PG2');
    expect(formatCareLevel('PG 3')).toBe('PG3');
    expect(screen).toContain('formatCareLevel(client.careLevel)');
    expect(screen).not.toContain('[client.city, client.careLevel]');
  });

  it('verwendet bei Katalogpositionen ausschließlich kontrollierte Mengen', () => {
    expect(getInvoiceCatalogQuantities('hour')).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]);
    expect(getInvoiceCatalogQuantities('km')).toContain(50);
    const create = read('src/lib/office/invoiceCreateService.ts');
    expect(create).toContain('createFromCatalogPosition');
    expect(create).toContain('getInvoiceCatalogQuantities(selected.unit).includes');
  });

  it('akzeptiert präzise Stunden mit Komma und höchstens zwei Nachkommastellen', () => {
    expect(parseInvoiceQuantity('18,52')).toBe(18.52);
    expect(parseInvoiceQuantity('4')).toBe(4);
    expect(parseInvoiceQuantity('18,521')).toBeNull();
    expect(parseInvoiceQuantity('-2')).toBeNull();
  });

  it('berechnet Monatsbudgets für Tages- und Mehrmonatszeiträume', () => {
    expect(countInvoiceCoveredMonths('2026-07-20', '2026-07-20')).toBe(1);
    expect(countInvoiceCoveredMonths('2026-07-20', '2026-09-02')).toBe(3);
    expect(countInvoiceCoveredMonths('2026-02-31', '2026-03-01')).toBe(0);
  });
});
