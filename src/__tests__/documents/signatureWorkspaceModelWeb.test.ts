import { describe, expect, it } from 'vitest';
import type { CsDocumentRequestListItem } from '@/types/documents/csTemplateDatabase';
import type { PortalSignatureDocument } from '@/types/portal/documentSignatures';
import { isSignatureOverdue, matchesSignatureSearch, matchesSignatureTab, signatureDate, signatureRows, type SignatureWorkspaceRow } from '@/components/office/documentSignatures/signatureWorkspaceModel.web';

function request(status: CsDocumentRequestListItem['status'], extra: Partial<CsDocumentRequestListItem> = {}): CsDocumentRequestListItem {
  return { id: `request-${status}`, ownerTenantId: 'tenant-1', title: 'Datenschutz', status, signatures: [], pendingSignatureRoles: [], createdAt: '2026-10-10T10:00:00Z', ...extra } as CsDocumentRequestListItem;
}
function portal(status: PortalSignatureDocument['status'], extra: Partial<PortalSignatureDocument> = {}): PortalSignatureDocument {
  return { id: `portal-${status}`, tenantId: 'tenant-1', title: 'Vereinbarung', status, createdAt: '2026-10-11T10:00:00Z', ...extra } as PortalSignatureDocument;
}

describe('Office signature workspace across existing request and portal records', () => {
  it('applies each filter to both sources and preserves closed records in all', () => {
    const rows = signatureRows([request('sent'), request('opened'), request('completed'), request('rejected')], [portal('open'), portal('in_progress'), portal('completed'), portal('withdrawn')]);
    expect(rows.filter((row) => matchesSignatureTab(row, 'open')).map((row) => row.item.id).sort()).toEqual(['portal-in_progress', 'portal-open', 'request-opened', 'request-sent']);
    expect(rows.filter((row) => matchesSignatureTab(row, 'in_progress')).map((row) => row.item.id).sort()).toEqual(['portal-in_progress', 'request-opened']);
    expect(rows.filter((row) => matchesSignatureTab(row, 'completed')).map((row) => row.item.id).sort()).toEqual(['portal-completed', 'request-completed']);
    expect(rows.filter((row) => matchesSignatureTab(row, 'all'))).toHaveLength(8);
  });
  it('keeps fully captured signatures open until final PDF/archive completion is confirmed', () => {
    const row: SignatureWorkspaceRow = { source: 'portal', item: portal('fully_signed') };
    expect(matchesSignatureTab(row, 'open')).toBe(true);
    expect(matchesSignatureTab(row, 'in_progress')).toBe(true);
    expect(matchesSignatureTab(row, 'completed')).toBe(false);
    expect(matchesSignatureTab({ source: 'request', item: request('archived') }, 'completed')).toBe(true);
  });
  it('marks only active records before the current day overdue', () => {
    const today = new Date(2026, 9, 15, 12);
    const before = new Date(2026, 9, 14, 12).toISOString();
    const current = new Date(2026, 9, 15, 12).toISOString();
    const rows = signatureRows([request('sent', { dueDate: before }), request('completed', { dueDate: before }), request('expired', { dueDate: before })], [portal('open', { dueDate: before }), portal('fully_signed', { dueDate: before }), portal('open', { id: 'today', dueDate: current }), portal('withdrawn', { dueDate: before })]);
    expect(rows.filter((row) => isSignatureOverdue(row, today)).map((row) => row.item.id).sort()).toEqual(['portal-fully_signed', 'portal-open', 'request-sent']);
  });
  it('searches titles and available people without case sensitivity, and sorts both sources together', () => {
    const rows = signatureRows([request('sent', { signatures: [{ id: 'signature', requestId: 'request-sent', signerRole: 'client', signerName: 'Felix Becker', status: 'signed', signedAt: null }] })], [portal('open', { clientName: 'Anna Müller' })]);
    expect(rows[0].source).toBe('portal');
    expect(rows.filter((row) => matchesSignatureSearch(row, ' MÜLLER '))).toHaveLength(1);
    expect(rows.filter((row) => matchesSignatureSearch(row, 'BECKER'))).toHaveLength(1);
    expect(rows.filter((row) => matchesSignatureSearch(row, 'Datenschutz'))).toHaveLength(1);
    expect(signatureDate('invalid')).toBe('Datum nicht verfügbar');
    expect(signatureDate(null)).toBe('Ohne Frist');
  });
});
