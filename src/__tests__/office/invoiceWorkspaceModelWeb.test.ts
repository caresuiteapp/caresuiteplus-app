import { describe, expect, it } from 'vitest';
import { addInvoiceDays, formatInvoiceDate, formatInvoiceMoney, invoiceDay, invoiceDisplayNumber, invoiceFilter, invoiceMonth, invoiceOverdue, invoiceSort, invoiceTotalHint, invoiceWorkspaceTotals, selectWorkspaceInvoices, type InvoiceWorkspaceRow } from '@/lib/office/invoiceWorkspaceModel.web';

const makeInvoice = (id: string, patch: Partial<InvoiceWorkspaceRow> = {}): InvoiceWorkspaceRow => ({ id, clientName: 'Anna Müller', invoiceNumber: `RE-${id}`, invoiceDate: '2026-10-01', dueDate: '2026-10-15', status: 'sent', amountCents: 10000, paidCents: 3000, openCents: 7000, recipient: { name: 'Beispiel Kasse', street: 'Hauptstraße', houseNumber: '1', postalCode: '12345', city: 'Ort', country: 'Deutschland', email: '' }, issues: [], ...patch });
const filter = { search: '', month: '', status: 'all' as const, sort: 'newest' as const, today: '2026-10-18' };

describe('Invoice workspace filters and truthful balances', () => {
  it('normalizes untrusted URL choices and bounds months', () => {
    expect(invoiceMonth('2026-10')).toBe('2026-10'); expect(invoiceMonth('2100-12')).toBe('2100-12');
    for (const value of ['1999-12', '2101-01', '2026-13', '2026-1', 'all', '2026-10-01']) expect(invoiceMonth(value)).toBe('');
    expect(invoiceFilter('unknown')).toBe('all'); expect(invoiceSort('unknown')).toBe('newest');
  });
  it('searches names, invoice numbers and recipients without changing source order', () => {
    const rows = [makeInvoice('10'), makeInvoice('2', { clientName: 'Ben Weiß', recipient: { ...makeInvoice('x').recipient, name: 'Andere Kasse' } })];
    expect(selectWorkspaceInvoices(rows, { ...filter, search: 'muller RE-10' }).map(row => row.id)).toEqual(['10']);
    expect(selectWorkspaceInvoices(rows, { ...filter, search: 'weiss andere' }).map(row => row.id)).toEqual(['2']);
    expect(selectWorkspaceInvoices(rows, { ...filter, sort: 'number' }).map(row => row.id)).toEqual(['10', '2']);
    expect(rows.map(row => row.id)).toEqual(['10', '2']);
  });
  it('filters by invoice month, includes unknown balances for review and excludes unissued drafts', () => {
    const rows = [makeInvoice('draft', { status: 'draft' }), makeInvoice('unknown', { openCents: null, issues: ['Zahlungsstand unklar'] }), makeInvoice('zero', { openCents: 0 }), makeInvoice('old', { invoiceDate: '2026-09-30' })];
    expect(selectWorkspaceInvoices(rows, { ...filter, month: '2026-10', status: 'open' }).map(row => row.id)).toEqual(['unknown']);
    expect(selectWorkspaceInvoices(rows, { ...filter, status: 'issues' }).map(row => row.id)).toEqual(['unknown']);
  });
  it('calculates overdue dates in Berlin and never marks paid or unissued invoices overdue', () => {
    expect(invoiceDay(new Date('2026-10-17T22:15:00Z'))).toBe('2026-10-18');
    expect(invoiceOverdue(makeInvoice('a'), '2026-10-18')).toBe(true);
    expect(invoiceOverdue(makeInvoice('a', { dueDate: '2026-10-18' }), '2026-10-18')).toBe(false);
    for (const status of ['draft', 'ready', 'paid', 'cancelled', 'written_off'] as const) expect(invoiceOverdue(makeInvoice('a', { status }), '2026-10-18')).toBe(false);
    expect(invoiceOverdue(makeInvoice('a', { openCents: 0, status: 'overdue' }), '2026-10-18')).toBe(false);
  });
  it('sums remaining balances instead of full invoice amounts and labels incomplete totals', () => {
    const totals = invoiceWorkspaceTotals([makeInvoice('a'), makeInvoice('b', { openCents: null }), makeInvoice('c', { status: 'draft' }), makeInvoice('d', { status: 'cancelled' }), makeInvoice('e', { status: 'ready' })], '2026-10-18');
    expect(totals.open).toEqual({ cents: 7000, known: 1, count: 2 }); expect(totals.overdue).toEqual(totals.open); expect(totals.drafts).toBe(1);
    expect(invoiceTotalHint(totals.open, 'Keine')).toBe('Teilsumme · 1 von 2 Beträgen bekannt');
    expect(invoiceWorkspaceTotals([], '2026-10-18').open).toEqual({ cents: 0, known: 0, count: 0 });
    expect(invoiceWorkspaceTotals([makeInvoice('paid', { openCents: 0 })], '2026-10-18').open.count).toBe(0);
  });
  it('places unknown amounts and dates last rather than treating them as money or today', () => {
    const rows = [makeInvoice('a', { amountCents: null, dueDate: null }), makeInvoice('b', { amountCents: 0 }), makeInvoice('c', { amountCents: 100 })];
    expect(selectWorkspaceInvoices(rows, { ...filter, sort: 'amount' }).map(row => row.id)).toEqual(['c', 'b', 'a']);
    expect(selectWorkspaceInvoices(rows, { ...filter, sort: 'due' }).at(-1)?.id).toBe('a');
    expect(formatInvoiceMoney(null)).toBe('—'); expect(formatInvoiceMoney(Number.NaN)).toBe('—'); expect(formatInvoiceDate(null)).toBe('—'); expect(formatInvoiceDate('2026-02-31')).toBe('—');
    expect(addInvoiceDays('2026-10-25', 14)).toBe('2026-11-08');
    expect(invoiceDisplayNumber(makeInvoice('x', { status: 'draft', invoiceNumber: 'DRAFT-uuid' }))).toBe('Entwurf');
    expect(invoiceDisplayNumber(makeInvoice('x', { status: 'sent', invoiceNumber: '' }))).toBe('Rechnungsnummer fehlt');
  });
});
