// @vitest-environment happy-dom
// Interaction coverage only; component doubles do not prove browser layout.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClientDocumentRecord } from '@/types/modules/client';

const f = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/clients/clientDocumentContentService', () => ({ loadClientDocumentContent: f.load }));
vi.mock('@/components/ui', () => ({
  SectionPanel: ({ title, subtitle, children }: any) => <section><h2>{title}</h2><p>{subtitle}</p>{children}</section>,
  LoadingState: ({ message }: any) => <p>{message}</p>,
  ErrorState: ({ message, onRetry }: any) => <div>{message}<button onClick={onRetry}>Erneut laden</button></div>,
  PremiumButton: ({ title, onPress }: any) => <button onClick={onPress}>{title}</button>,
}));
vi.mock('@/components/office/DocumentHtmlPreview', () => ({ DocumentHtmlPreview: ({ previewHtml, fallbackLabel }: any) => <p>{previewHtml || fallbackLabel}</p> }));
vi.mock('@/components/office/DocumentDeliveryActions', async () => {
  const { isDocumentPdfDownloadSupported } = await import('@/lib/documents/documentPdfLogic');
  return { DocumentDeliveryActions: ({ document }: { document: ClientDocumentRecord }) => <button disabled={!isDocumentPdfDownloadSupported(document)}>PDF herunterladen</button> };
});
import { ClientDocumentPreview } from '@/components/office/ClientDocumentPreview';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function doc(clientId = 'client-1'): ClientDocumentRecord {
  return { id: `stored-${clientId}`, tenantId: 'tenant-1', clientId, title: 'Kundenvertrag', fileName: 'client_contract_assist.html',
    mimeType: 'text/html', category: 'vertrag', storagePath: null, status: 'abgeschlossen', sensitivity: 'care', uploadedBy: null,
    validUntil: null, createdAt: '2026-06-17T10:00:00Z', updatedAt: '2026-06-17T10:00:00Z', documentSource: 'intake', intakeDocumentId: `intake-${clientId}` };
}
let root: Root | null = null; let host: HTMLDivElement;
async function render(document: ClientDocumentRecord) {
  if (!root) { host = window.document.createElement('div'); window.document.body.append(host); root = createRoot(host); }
  await act(async () => { root!.render(<ClientDocumentPreview document={document} tenantId="tenant-1" clientId={document.clientId} />); });
}
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; host?.remove(); vi.clearAllMocks(); });

describe('client document preview content states', () => {
  it('loads the original into both preview and download action', async () => {
    f.load.mockResolvedValue({ ok: true, data: { ...doc(), previewHtml: '<p>Original signiert</p>', intakeStatus: 'finalized' } });
    await render(doc());
    expect(host.textContent).toContain('Original signiert');
    expect((host.querySelector('button') as HTMLButtonElement).disabled).toBe(false);
  });
  it('shows a missing original explicitly and leaves download disabled', async () => {
    f.load.mockResolvedValue({ ok: true, data: { ...doc(), previewHtml: null, intakeStatus: 'not_started', status: 'fehlerhaft' } });
    await render(doc());
    expect(host.textContent).toContain('Inhalt fehlt');
    expect(host.textContent).toContain('Original als PDF hochladen');
    expect((host.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });
  it('never shows an earlier client body while the next client is loading', async () => {
    f.load.mockResolvedValueOnce({ ok: true, data: { ...doc(), previewHtml: '<p>Vertrag A</p>' } });
    await render(doc());
    let finish: (result: any) => void = () => {};
    f.load.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await render(doc('client-2'));
    expect(host.textContent).not.toContain('Vertrag A');
    expect(host.textContent).toContain('wird geladen');
    await act(async () => finish({ ok: true, data: { ...doc('client-2'), previewHtml: '<p>Vertrag B</p>' } }));
    expect(host.textContent).toContain('Vertrag B');
  });
});
