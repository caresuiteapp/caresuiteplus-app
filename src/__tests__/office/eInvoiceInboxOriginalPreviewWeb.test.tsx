// @vitest-environment happy-dom
// Interaction coverage only; this DOM test does not establish visual layout.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OfficeEInvoiceInboxRecord } from '@/lib/office/eInvoiceInboxTypes.web';
const h = vi.hoisted(() => ({ tenant: 'tenant-a', params: {} as Record<string, string>, list: vi.fn(), original: vi.fn(), hash: vi.fn(), review: vi.fn(), validate: vi.fn(), setParams: vi.fn() }));
vi.mock('expo-router', () => ({ useIsFocused: () => true, useLocalSearchParams: () => h.params, useNavigation: () => ({ dispatch: vi.fn() }), useRouter: () => ({ setParams: h.setParams, push: vi.fn() }) }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ authReady: true, isAuthenticated: true, user: { id: 'user-a' }, portalSession: null }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: 'business_admin', permissions: ['office.invoices.view', 'office.invoices.create', 'office.invoices.status_change'], can: () => true }) }));
vi.mock('@/lib/office/eInvoiceInboxService.web', () => ({ fetchOfficeEInvoiceInbox: (...args: unknown[]) => h.list(...args), downloadOfficeEInvoiceOriginal: (...args: unknown[]) => h.original(...args), reviewOfficeEInvoiceInbox: (...args: unknown[]) => h.review(...args), validateOfficeEInvoiceInbox: (...args: unknown[]) => h.validate(...args), saveOfficeEInvoiceImport: vi.fn() }));
vi.mock('@/lib/office/eInvoiceImport.web', async () => ({ ...await vi.importActual<typeof import('@/lib/office/eInvoiceImport.web')>('@/lib/office/eInvoiceImport.web'), officeEInvoiceSha256: (...args: unknown[]) => h.hash(...args) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000, withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
import { EInvoiceInbox } from '@/components/office/invoices/EInvoiceInbox.web';
import { parseOfficeEInvoiceXml } from '@/lib/office/eInvoiceImport.web';

const hash = 'a'.repeat(64);
const originalBytes = new TextEncoder().encode(`<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"><cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID><cbc:ID>ORIGINAL-42</cbc:ID><cbc:IssueDate>2026-10-18</cbc:IssueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cac:AccountingSupplierParty><cac:Party><cac:PartyName><cbc:Name>Original Lieferant</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cac:Party><cac:PartyName><cbc:Name>Original Empfänger</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty><cac:LegalMonetaryTotal><cbc:PayableAmount>119.00</cbc:PayableAmount><cbc:TaxExclusiveAmount>100.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount>119.00</cbc:TaxInclusiveAmount></cac:LegalMonetaryTotal></Invoice>`);
function record(id = 'document-a'): OfficeEInvoiceInboxRecord {
  const preview = parseOfficeEInvoiceXml(originalBytes);
  return { id, tenantId: h.tenant, createdAt: '2026-10-18T09:00:00Z', updatedAt: '2026-10-18T09:00:00Z', originalFileName: 'original.xml', originalMimeType: 'application/xml', originalSha256: hash, xmlFileName: 'original.xml', xmlSha256: hash, originalSize: originalBytes.byteLength, sourceKind: 'xml',
    preview: { ...preview, invoiceNumber: 'MANIPULIERTE-METADATEN', seller: { ...preview.seller, name: 'Metadaten Lieferant' }, totals: { ...preview.totals, payable: '9999.99' } }, reviewStatus: 'unreviewed', reviewNote: '', validationStatus: 'valid', validationMessage: 'Die gespeicherten XML-Daten wurden geprüft.', validationFindings: [] };
}
const ok = <T,>(data: T) => ({ ok: true as const, data });
function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>(done => { resolve = done; }), resolve: (value: T) => resolve(value) }; }
let host: HTMLDivElement; let root: Root;
async function render() { await act(async () => { root.render(<EInvoiceInbox />); }); }
function detail() { const element = host.querySelector<HTMLElement>('[aria-label="Rechnungseingang im Detail"]'); if (!element) throw new Error('Detail fehlt'); return element; }
function button(name: string) { const element = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === name); if (!element) throw new Error(`Button fehlt: ${name}`); return element; }
async function change(element: HTMLSelectElement | HTMLTextAreaElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); h.tenant = 'tenant-a'; h.params = { document: 'document-a' };
  h.list.mockReset().mockResolvedValue(ok([record()])); h.original.mockReset().mockResolvedValue(ok({ bytes: originalBytes, fileName: 'original.xml', mimeType: 'application/xml' }));
  h.hash.mockReset().mockResolvedValue(hash); h.review.mockReset(); h.validate.mockReset(); h.setParams.mockReset().mockImplementation((values: Record<string, string>) => { h.params = { ...h.params, ...values }; });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

describe('Rechnungseingang liest Details erneut aus dem Original', () => {
  it('shows actual XML data instead of client metadata beside a valid format result', async () => {
    await render();
    expect(h.original).toHaveBeenCalledWith('tenant-a', 'document-a', 'xml', 'business_admin');
    expect(h.hash).toHaveBeenCalledWith(originalBytes);
    expect(detail().textContent).toContain('ORIGINAL-42'); expect(detail().textContent).toContain('Original Lieferant');
    expect(detail().textContent).not.toContain('MANIPULIERTE-METADATEN'); expect(detail().textContent).not.toContain('Metadaten Lieferant'); expect(detail().textContent).not.toContain('9.999,99');
    expect(detail().textContent).toContain('weichen vom Original-XML ab'); expect(detail().textContent).toContain('Formatprüfung bestanden');
  });
  it('does not expose metadata as detail while the original is still loading', async () => {
    const pending = deferred<ReturnType<typeof ok<{ bytes: Uint8Array; fileName: string; mimeType: string }>>>(); h.original.mockReturnValueOnce(pending.promise);
    await render(); expect(detail().querySelector('.ei-preview')).toBeNull(); expect(button('Original noch nicht verfügbar').disabled).toBe(true);
    await act(async () => { pending.resolve(ok({ bytes: originalBytes, fileName: 'original.xml', mimeType: 'application/xml' })); });
    expect(detail().textContent).toContain('Original Lieferant');
  });
  it('blocks details and factual review when the selected hash differs', async () => {
    h.hash.mockResolvedValue('b'.repeat(64)); await render();
    expect(detail().textContent).toContain('stimmt nicht mit der ausgewählten Rechnung überein');
    expect(detail().querySelector('.ei-preview')).toBeNull(); expect(button('Original noch nicht verfügbar').disabled).toBe(true); expect(h.review).not.toHaveBeenCalled();
  });
  it('shows a read failure with retry rather than falling back to stored preview metadata', async () => {
    h.original.mockResolvedValueOnce({ ok: false, error: 'Original derzeit nicht erreichbar' }); await render();
    expect(detail().textContent).toContain('Original derzeit nicht erreichbar'); expect(detail().querySelector('.ei-preview')).toBeNull();
    await act(async () => button('Original erneut laden').click());
    expect(detail().textContent).toContain('Original Lieferant'); expect(h.original).toHaveBeenCalledTimes(2);
  });
  it('keeps note edits separate from loaded original data and sends the expected review revision', async () => {
    await render(); const select = detail().querySelector<HTMLSelectElement>('.ei-review select')!; const note = detail().querySelector<HTMLTextAreaElement>('textarea')!;
    await change(select, 'reviewed'); await change(note, 'Mit Original abgeglichen');
    expect(button('Format erneut prüfen').disabled).toBe(true); expect(note.value).toBe('Mit Original abgeglichen');
    h.review.mockResolvedValue(ok({ ...record(), updatedAt: '2026-10-18T10:00:00Z', reviewStatus: 'reviewed', reviewNote: 'Mit Original abgeglichen' }));
    await act(async () => button('Prüfstand speichern').click());
    expect(h.review).toHaveBeenCalledWith('tenant-a', 'document-a', { status: 'reviewed', note: 'Mit Original abgeglichen', expectedUpdatedAt: '2026-10-18T09:00:00Z' }, 'business_admin');
    expect(detail().querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Mit Original abgeglichen'); expect(detail().textContent).toContain('Original Lieferant');
    expect(h.original).toHaveBeenCalledTimes(1);
  });
  it('ignores a late original after changing the tenant', async () => {
    const pending = deferred<ReturnType<typeof ok<{ bytes: Uint8Array; fileName: string; mimeType: string }>>>(); h.original.mockReturnValueOnce(pending.promise);
    await render(); h.tenant = 'tenant-b'; h.list.mockResolvedValue(ok([])); await render();
    await act(async () => { pending.resolve(ok({ bytes: originalBytes, fileName: 'original.xml', mimeType: 'application/xml' })); });
    expect(host.querySelector('[aria-label="Rechnungseingang im Detail"]')).toBeNull(); expect(host.textContent).not.toContain('Original Lieferant');
  });
});
