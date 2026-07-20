import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildBillingPeriodOptions,
  buildSystemInvoiceNumber,
  calculateDueDate,
} from '@/lib/office/invoiceSystemFields';
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
    expect(screen).not.toContain('<PremiumInput');
  });
});
