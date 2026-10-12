// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ sign: vi.fn(), open: vi.fn(), platform: { OS: 'android' }, pdf: { url: 'https://example.test/original.pdf', loading: false, error: null as string | null } }));
vi.mock('react-native', () => ({ View: ({ children }: any) => <div>{children}</div>, Text: ({ children }: any) => <span>{children}</span>, StyleSheet: { create: (v: unknown) => v }, Linking: { openURL: h.open }, Platform: h.platform, useWindowDimensions: () => ({ width: 390, height: 844 }) }));
vi.mock('@/components/ui', () => ({
  SectionPanel: ({ title, children }: any) => <section><h2>{title}</h2>{children}</section>, InfoBanner: ({ message }: any) => <div>{message}</div>, PremiumBadge: ({ label }: any) => <span>{label}</span>,
  PremiumButton: ({ title, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{title}</button>,
  PremiumInput: ({ label, value, onChangeText, editable }: any) => <input aria-label={label} value={value} disabled={!editable} onInput={(e: any) => onChangeText(e.target.value)} />,
}));
vi.mock('@/components/inputs/CareSignatureModal', () => ({ CareSignatureModal: ({ disabled, onConfirm, onClose, statusMessage }: any) => <div data-modal><div>{statusMessage}</div><button disabled={disabled} onClick={() => onConfirm('data:image/png;base64,AAAA')}>Signatur speichern</button><button onClick={onClose}>Schließen</button></div> }));
vi.mock('@/components/office/DocumentHtmlPreview', () => ({ DocumentHtmlPreview: () => <div>Vollständiger Dokumentinhalt</div> }));
vi.mock('@/components/signatures', () => ({ SignatureDisplay: ({ signerName }: any) => <span>{signerName}</span> }));
vi.mock('@/hooks/usePortalSignatureSourcePdf', () => ({ usePortalSignatureSourcePdf: () => h.pdf }));
vi.mock('@/theme', () => ({ spacing: { sm: 8, md: 12, xs: 4 }, typography: { body: {}, caption: {} } }));
import { PortalSignatureCapturePanel } from '@/components/portal/PortalSignatureCapturePanel';
import { computeDocumentContentHash } from '@/lib/documents/documentHashService';
import type { PortalSignatureDocumentDetail } from '@/types/portal/documentSignatures';
let root: Root, host: HTMLDivElement;
const detail = (patch: Partial<PortalSignatureDocumentDetail> = {}): PortalSignatureDocumentDetail => ({
  id: 'document', tenantId: 'tenant', employeeId: 'employee', title: 'Arbeitsvertrag', documentSourceType: 'template', versionNumber: 1, previewHtml: '<p>Vollständiger Vertrag</p>', status: 'open', nextSignerRole: 'employee', captures: [], signatureFields: [], employeeSigned: false, clientSigned: false,
  documentType: 'arbeitsvertrag', recipientType: 'employee', clientId: null, clientName: null, signatureRequirement: 'employee', dueDate: null, priority: 'normal', requiredBeforeAssignment: false, assignmentId: null, creatorName: 'Verwaltung', createdAt: '2026-10-01T10:00:00Z', sentAt: null, completedAt: null, allowDownload: true, previewPdfUrl: null, storagePath: null, sourceDocumentId: null, auditTrail: [], ...patch,
});
const render = async (data: PortalSignatureDocumentDetail) => { await act(async () => root.render(<PortalSignatureCapturePanel detail={data} onSign={h.sign} />)); };
const button = (text: string) => [...host.querySelectorAll('button')].find(el => el.textContent === text)!;
const edit = async () => { await act(async () => { const input = host.querySelector('input')!; input.value = 'Testperson'; input.dispatchEvent(new Event('input', { bubbles: true })); }); };
beforeEach(() => { vi.clearAllMocks(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; h.platform.OS = 'android'; h.pdf.error = null; h.open.mockResolvedValue(undefined); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('personal signature capture on a mounted screen', () => {
  it('keeps failed strokes available, blocks double submits and allows a retry after a thrown failure', async () => {
    let reject!: (cause: Error) => void;
    h.sign.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    await render(detail()); await edit(); await act(async () => button('Mitarbeiter-Unterschrift erfassen').click());
    await act(async () => { button('Signatur speichern').click(); button('Signatur speichern').click(); });
    expect(h.sign).toHaveBeenCalledOnce(); expect(button('Signatur speichern').disabled).toBe(true);
    await act(async () => button('Schließen').click()); expect(host.querySelector('[data-modal]')).not.toBeNull();
    await act(async () => reject(new Error('offline')));
    expect(host.textContent).toContain('Speicherung konnte noch nicht bestätigt'); expect(host.querySelector('[data-modal]')).not.toBeNull();
    h.sign.mockResolvedValue({ ok: true }); await act(async () => button('Signatur speichern').click());
    expect(h.sign).toHaveBeenCalledTimes(2); expect(host.querySelector('[data-modal]')).toBeNull();
  });
  it('sends the version actually reviewed before an in-place document refresh', async () => {
    h.sign.mockResolvedValue({ ok: false, error: 'Fassung geändert' });
    await render(detail()); await edit(); await act(async () => button('Mitarbeiter-Unterschrift erfassen').click());
    await render(detail({ versionNumber: 2 })); await act(async () => button('Signatur speichern').click());
    expect(h.sign).toHaveBeenCalledWith(expect.objectContaining({ expectedVersionNumber: 1 }));
  });
  it('resumes a matching saved capture, but asks for a new capture after the contents changed', async () => {
    const capture = { id: 'capture', documentId: 'document', tenantId: 'tenant', signerRole: 'employee' as const, signerName: 'Already signed', payloadHash: computeDocumentContentHash('document:1:<p>Vollständiger Vertrag</p>'), signedAt: '2026-10-10T10:00:00Z', signatureHash: 'hash', auditId: 'audit', deviceInfo: null, browser: null, capturedIp: null, storagePath: 'tenant/tenant/portal/signatures/document/capture.png' };
    h.sign.mockResolvedValue({ ok: false, error: 'PDF noch nicht bestätigt' });
    await render(detail({ captures: [capture] })); await act(async () => button('Dokument fertigstellen').click());
    expect(h.sign).toHaveBeenCalledWith(expect.objectContaining({ signatureDataUrl: '', signerName: 'Already signed' }));
    await render(detail({ versionNumber: 2, captures: [capture] }));
    expect(button('Mitarbeiter-Unterschrift erfassen')).toBeDefined(); expect(button('Dokument fertigstellen')).toBeUndefined();
  });
  it('opens the exact original PDF and shows native preview failures without accepting an incomplete PDF signature', async () => {
    await render(detail({ documentSourceType: 'pdf_upload' }));
    expect(button('Mitarbeiter-Unterschrift erfassen')).toBeUndefined();
    await act(async () => button('Original-PDF öffnen').click()); expect(h.open).toHaveBeenCalledWith(h.pdf.url); expect(h.sign).not.toHaveBeenCalled();
    h.pdf.error = 'PDF konnte nicht geladen werden'; await render(detail({ documentSourceType: 'pdf_upload' }));
    expect(host.textContent).toContain(h.pdf.error);
  });
  it('clears names, open modals and previous feedback when navigating to another document', async () => {
    await render(detail()); await edit(); await act(async () => button('Mitarbeiter-Unterschrift erfassen').click());
    await render(detail({ id: 'other-document' }));
    expect(host.querySelector('[data-modal]')).toBeNull(); expect(host.querySelector('input')!.value).toBe('');
  });
});
