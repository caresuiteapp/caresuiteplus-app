import { describe, expect, it } from 'vitest';
import { invoiceEditorDueDate, invoiceEditorMonthPeriod, parseInvoiceEditorDecimal, validateInvoiceEditorLineText } from '@/components/office/invoices/invoiceEditorModel.web';

describe('Invoice editor input values', () => {
  it('accepts explicit German and decimal-point values without treating blanks as zero', () => {
    expect(parseInvoiceEditorDecimal('32,75')).toBe(32.75);
    expect(parseInvoiceEditorDecimal(' 0.00 ')).toBe(0);
    for (const input of ['', ' ', '-1', '1e3', '1.234,56', '12,345', 'Infinity', '12x']) expect(parseInvoiceEditorDecimal(input)).toBeNull();
  });
  it('rejects unfinished quantities, excessive tax and sub-cent prices', () => {
    expect(validateInvoiceEditorLineText({ quantity: '0', price: '1', tax: '0' })).toContain('größer als 0');
    expect(validateInvoiceEditorLineText({ quantity: '1,25', price: '10,001', tax: '0' })).toContain('Einzelpreis');
    expect(validateInvoiceEditorLineText({ quantity: '1', price: '10', tax: '100,01' })).toContain('Umsatzsteuer');
    expect(validateInvoiceEditorLineText({ quantity: '1,25', price: '32,75', tax: '19' })).toBeNull();
  });
  it('calculates payment terms from the invoice date across month and DST boundaries', () => {
    expect(invoiceEditorDueDate('2026-10-18', 14)).toBe('2026-11-01');
    expect(invoiceEditorDueDate('2026-03-25', 7)).toBe('2026-04-01');
    expect(invoiceEditorDueDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(invoiceEditorDueDate('2026-02-30', 14)).toBe('');
  });
  it('uses the full calendar month including leap-year February', () => {
    expect(invoiceEditorMonthPeriod('2028-02-29')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(invoiceEditorMonthPeriod('2026-10-18')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
  });
});
