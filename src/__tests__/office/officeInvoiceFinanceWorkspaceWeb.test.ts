import { describe, expect, it, vi } from 'vitest';
import type { OfficeInvoice } from '@/lib/office/invoiceWorkspaceTypes.web';
import { buildOfficeInvoiceMonthSummary, mapOfficeInvoiceDunning, mapOfficeInvoicePayments } from '@/lib/office/invoiceFinanceWorkspaceService.web';
vi.mock('@/lib/office/invoiceWorkspaceService.web', () => ({ fetchOfficeInvoices: vi.fn() }));

function invoice(overrides: Partial<OfficeInvoice> = {}): OfficeInvoice {
  return { id: 'invoice', tenantId: 'tenant', clientId: 'client', clientName: 'Klient Beispiel', clientNumber: 'K-1', insuranceNumber: 'TEST-1', officeManaged: true,
    invoiceNumber: 'RE-2026-001', status: 'sent', invoiceDate: '2026-10-01', dueDate: '2026-10-15', servicePeriodStart: '2026-09-01', servicePeriodEnd: '2026-09-30',
    amountCents: 10000, paidCents: 2500, openCents: 7500, billingModule: 'assist', updatedAt: '2026-10-01T10:00:00Z', createdAt: '2026-10-01T10:00:00Z',
    recipient: { name: 'Pflegekasse Beispiel', street: 'Weg 1', houseNumber: '', postalCode: '12345', city: 'Ort', country: 'Deutschland', email: '' },
    recipientType: 'care_insurance', billingParty: 'care_insurance', notes: '', footerText: '', includeProofs: false, selectedProofIds: [], lines: [], issues: [],
    pdfFilePath: 'invoice.pdf', cancellationReason: null, companySnapshot: null, ...overrides };
}

describe('Web Rechnungsfinanzen – belegte Beträge und Monatsabgrenzung', () => {
  it('grenzt Monatsübersichten nach Rechnungsdatum ab und bezeichnet keine Zahlungsbewegungen als Monatsumsatz', () => {
    const october = invoice();
    const september = invoice({ id: 'september', invoiceDate: '2026-09-30', servicePeriodStart: '2026-10-01', amountCents: 20000 });
    const result = buildOfficeInvoiceMonthSummary('2026-10', [october, september]);
    expect(result.invoices.map(row => row.id)).toEqual(['invoice']);
    expect(result).toMatchObject({ issuedCount: 1, draftCount: 0, totalCents: 10000, paidCents: 2500, openCents: 7500 });
  });
  it('nimmt Entwürfe, Stornos und Abschreibungen nicht in ausgestellte aktive Summen auf', () => {
    const result = buildOfficeInvoiceMonthSummary('2026-10', [invoice(), invoice({ id: 'draft', status: 'draft' }),
      invoice({ id: 'cancelled', status: 'cancelled' }), invoice({ id: 'written', status: 'written_off' })]);
    expect(result.invoices).toHaveLength(4);
    expect(result).toMatchObject({ draftCount: 1, issuedCount: 1, totalCents: 10000, openCents: 7500 });
  });
  it('zeigt unvollständige Salden als unbekannt und erhält unabhängig bekannte Beträge', () => {
    const result = buildOfficeInvoiceMonthSummary('2026-10', [invoice({ openCents: null })]);
    expect(result.openCents).toBeNull(); expect(result.totalCents).toBe(10000); expect(result.paidCents).toBe(2500); expect(result.unknownCount).toBe(1);
    expect(buildOfficeInvoiceMonthSummary('2026-08', [invoice()])).toMatchObject({ totalCents: 0, paidCents: 0, openCents: 0 });
  });
  it('verknüpft echte Zahlungen mit Rechnung und Empfänger und bewahrt den Buchungsstatus', () => {
    const rows = mapOfficeInvoicePayments([{ id: 'payment', invoice_id: 'invoice', payment_date: '2026-10-10', value_date: '2026-10-11',
      amount: '25.00', currency: 'EUR', status: 'returned', payment_method: 'bank_transfer', reference: 'Rücklastschrift' }], [invoice()]);
    expect(rows[0]).toMatchObject({ amountCents: 2500, invoiceNumber: 'RE-2026-001', clientName: 'Klient Beispiel', recipientName: 'Pflegekasse Beispiel',
      status: 'returned', paymentDate: '2026-10-10', valueDate: '2026-10-11' });
    expect(rows[0].issues).toEqual([]);
  });
  it('wandelt Fremdwährungen nicht stillschweigend in Euro um und erfindet keine fehlenden Beträge', () => {
    const rows = mapOfficeInvoicePayments([{ id: 'usd', invoice_id: 'invoice', payment_date: '2026-10-10', amount: 25, currency: 'USD' },
      { id: 'missing', invoice_id: null, payment_date: '', amount: null, currency: 'EUR' }], [invoice()]);
    expect(rows[0].amountCents).toBeNull(); expect(rows[0].issues.join(' ')).toContain('keine Umrechnung');
    expect(rows[1].amountCents).toBeNull(); expect(rows[1].issues.join(' ')).toContain('Zahlungsdatum');
    expect(rows[1].invoiceId).toBeNull();
  });
  it('zeigt bei Mahnungen den historischen Mahnbetrag ohne ihn als heutigen offenen Saldo auszugeben', () => {
    const rows = mapOfficeInvoiceDunning([{ id: 'dunning', invoice_id: 'invoice', due_date: '2026-10-25', level: 2, open_amount_at_creation: '100.00', status: 'sent' }], [invoice({ openCents: 1000 })]);
    expect(rows[0]).toMatchObject({ openCents: 10000, level: 2, status: 'sent' });
    const invalid = mapOfficeInvoiceDunning([{ id: 'broken', invoice_id: 'missing', level: null, open_amount_at_creation: null }], []);
    expect(invalid[0].openCents).toBeNull(); expect(invalid[0].level).toBeNull(); expect(invalid[0].issues).toHaveLength(3);
  });
});
