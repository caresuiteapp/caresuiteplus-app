// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvoiceOfficeDraft } from '@/lib/office/invoiceWorkspaceTypes.web';
const h = vi.hoisted(() => ({ proofs: vi.fn(), draftPdf: vi.fn(), savedPdf: vi.fn(), download: vi.fn(), changeProofs: vi.fn(), createUrl: vi.fn(), revokeUrl: vi.fn() }));
vi.mock('@/lib/office/invoicePdfService.web', () => ({ listInvoiceProofAttachments: (...args: unknown[]) => h.proofs(...args), prepareOfficeDraftPdf: (...args: unknown[]) => h.draftPdf(...args), prepareOfficeInvoicePdf: (...args: unknown[]) => h.savedPdf(...args), officeInvoiceToPdfInvoice: (value: unknown) => value, downloadInvoiceProofAttachment: vi.fn(), downloadPreparedInvoicePdf: (...args: unknown[]) => h.download(...args) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000, withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
import { InvoicePdfPreview } from '@/components/office/invoices/InvoicePdfPreview.web';
const tenantId = '11111111-1111-4111-8111-111111111111';
const sourceId = '22222222-2222-4222-8222-222222222222';
const prepared = { fileName: 'Entwurf.pdf', bytes: new Uint8Array([37, 80, 68, 70]), validation: { errors: [], warnings: [] } };
let host: HTMLDivElement; let root: Root; let draft: InvoiceOfficeDraft; let invalid: boolean; let frozen: boolean;
async function render() { await act(async () => root.render(<InvoicePdfPreview tenantId={tenantId} roleKey="billing" draft={draft} invalid={invalid} allowProofSelection={!frozen} onProofIdsChange={h.changeProofs} />)); }
function button(name: string) { const node = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === name); if (!node) throw new Error(`Button fehlt: ${name}`); return node; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); invalid = false; frozen = false;
  draft = { requestId: '33333333-3333-4333-8333-333333333333', clientId: '44444444-4444-4444-8444-444444444444', invoiceNumber: '', invoiceDate: '2026-10-18', dueDate: '2026-11-01', servicePeriodStart: '2026-10-01', servicePeriodEnd: '2026-10-31', recipient: { name: 'Ada Muster', street: 'Weg', houseNumber: '1', postalCode: '44623', city: 'Herne', country: 'Deutschland', email: '' }, recipientType: 'client', billingParty: 'self_payer', notes: '', footerText: '', includeProofs: false, selectedProofIds: [], lines: [{ description: 'Leistung', quantity: 1, unit: 'hour', unitPriceCents: 3000, taxRatePercent: 0, productKey: 'assist', serviceRecordId: sourceId }] };
  h.proofs.mockReset().mockResolvedValue({ ok: true, data: [{ id: `record:${sourceId}`, title: 'Nachweis vom 10. Oktober', serviceDate: '2026-10-10', status: 'approved', available: true }, { id: 'record:55555555-5555-4555-8555-555555555555', title: 'Anderer Nachweis', serviceDate: '2026-10-12', status: 'approved', available: true }] });
  h.draftPdf.mockReset().mockResolvedValue({ ok: true, data: prepared }); h.createUrl.mockReset().mockReturnValue('blob:invoice-preview'); h.revokeUrl.mockReset();
  class PreviewURL extends URL { static createObjectURL = h.createUrl; static revokeObjectURL = h.revokeUrl; }
  vi.stubGlobal('URL', PreviewURL); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('Invoice PDF preview interactions', () => {
  it('previews without saving, numbering or opening a popup and exposes an actual PDF iframe', async () => { await render(); await act(async () => button('PDF-Vorschau erstellen').click()); expect(h.draftPdf).toHaveBeenCalledWith(tenantId, draft, 'billing', { proofIds: [] }); expect(host.querySelector('iframe')?.getAttribute('src')).toBe('blob:invoice-preview#toolbar=1&navpanes=0'); expect(h.proofs).not.toHaveBeenCalled(); await act(async () => button('PDF herunterladen').click()); expect(h.download).toHaveBeenCalledWith(prepared); });
  it('keeps proof selection usable when a required attachment is the missing draft field', async () => { draft.includeProofs = true; invalid = true; await render(); const checkbox = host.querySelector<HTMLInputElement>('input[type=checkbox]')!; expect(checkbox.disabled).toBe(false); expect(button('PDF-Vorschau erstellen').disabled).toBe(true); await act(async () => checkbox.click()); expect(h.changeProofs).toHaveBeenCalledWith([`record:${sourceId}`]); });
  it('does not silently append every proof from the same client and period', async () => { draft.includeProofs = true; draft.selectedProofIds = [`record:${sourceId}`]; await render(); const boxes = host.querySelectorAll<HTMLInputElement>('input[type=checkbox]'); expect(boxes[0].checked).toBe(true); expect(boxes[1].checked).toBe(false); await act(async () => button('PDF-Vorschau erstellen').click()); expect(h.draftPdf.mock.calls[0][3]).toEqual({ proofIds: [`record:${sourceId}`] }); });
  it('keeps deterministic run selections fixed while leaving preview generation available', async () => { draft.includeProofs = true; draft.selectedProofIds = [`record:${sourceId}`]; frozen = true; await render(); expect(host.querySelector<HTMLInputElement>('input[type=checkbox]')?.disabled).toBe(true); expect(button('PDF-Vorschau erstellen').disabled).toBe(false); });
  it('invalidates and revokes a preview after the invoice changes', async () => { await render(); await act(async () => button('PDF-Vorschau erstellen').click()); draft = { ...draft, notes: 'Neuer Stand' }; await render(); expect(host.querySelector('iframe')).toBeNull(); expect(h.revokeUrl).toHaveBeenCalledWith('blob:invoice-preview'); });
  it('discards a completed generation when the underlying draft changed mid-request', async () => { const pending = deferred<{ ok: true; data: typeof prepared }>(); h.draftPdf.mockReturnValue(pending.promise); await render(); await act(async () => button('PDF-Vorschau erstellen').click()); draft = { ...draft, recipient: { ...draft.recipient, name: 'Neue Empfängerin' } }; await render(); await act(async () => pending.resolve({ ok: true, data: prepared })); expect(host.querySelector('iframe')).toBeNull(); expect(h.createUrl).not.toHaveBeenCalled(); });
});
