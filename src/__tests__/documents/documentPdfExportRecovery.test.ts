// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientDocumentRecord } from '@/types/modules/client';

const f = vi.hoisted(() => ({ canvas: vi.fn(), download: vi.fn(), bucket: vi.fn(), load: vi.fn() }));
vi.mock('html2canvas', () => ({ default: f.canvas }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ storage: { from: f.bucket } }) }));
vi.mock('@/lib/clients/clientDocumentContentService', () => ({ loadClientDocumentContent: f.load,
  MISSING_DOCUMENT_CONTENT_MESSAGE: 'Der gespeicherte Dokumentinhalt fehlt. Bitte das Original als PDF hochladen.' }));
import { prepareDocumentPdf } from '@/lib/documents/documentPdfService';

function doc(overrides: Partial<ClientDocumentRecord> = {}): ClientDocumentRecord {
  return { id: 'stored-1', tenantId: 'tenant-1', clientId: 'client-1', title: 'Kundenvertrag', fileName: 'client_contract_assist.html',
    mimeType: 'text/html', category: 'vertrag', storagePath: null, status: 'abgeschlossen', sensitivity: 'care', uploadedBy: null,
    validUntil: null, createdAt: '2026-06-17T10:00:00Z', updatedAt: '2026-06-17T10:00:00Z', documentSource: 'intake', intakeDocumentId: 'intake-1', ...overrides };
}
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';
beforeEach(() => {
  vi.clearAllMocks();
  f.canvas.mockResolvedValue({ width: 1, height: 1, toDataURL: () => png });
  f.bucket.mockReturnValue({ download: f.download });
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
});

describe('PDF export recovery with the real jsPDF writer', () => {
  it('writes real PDF bytes from the persisted signed HTML', async () => {
    const html = '<p>Originalvertrag für Müller</p><img src="data:image/png;base64,original-signature">';
    f.load.mockResolvedValue({ ok: true, data: doc({ previewHtml: html }) });
    const result = await prepareDocumentPdf({ doc: doc(), clientLastName: 'Müller' });
    if (!result.ok) throw new Error(result.error);
    expect(atob(result.data.base64).startsWith('%PDF-')).toBe(true);
    expect(result.data.fileName).toBe('Kundenvertrag_Mueller.pdf');
    expect(f.canvas.mock.calls[0][0].innerHTML).toContain('original-signature');
    expect(f.canvas.mock.calls[0][0].innerHTML).toContain('Originalvertrag für Müller');
    expect(document.body.children).toHaveLength(0);
  });
  it('decodes stored HTML as UTF-8 before rendering it', async () => {
    const html = '<p>Vertrag mit Ä, ü und €</p>';
    const bytes = new TextEncoder().encode(html);
    f.download.mockResolvedValue({ data: { arrayBuffer: async () => bytes.buffer }, error: null });
    const result = await prepareDocumentPdf({ doc: doc({ mimeType: 'text/html; charset=utf-8', storagePath: 'tenant/original.html' }) });
    if (!result.ok) throw new Error(result.error);
    expect(atob(result.data.base64)).toMatch(/^%PDF-/);
    expect(f.canvas.mock.calls[0][0].innerHTML).toBe(html);
    expect(f.download).toHaveBeenCalledWith('tenant/original.html');
    expect(f.load).not.toHaveBeenCalled();
  });
  it('keeps an original stored PDF unchanged instead of treating it as an image', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7 original stored bytes');
    f.load.mockResolvedValue({ ok: true, data: doc({ mimeType: 'application/pdf', storagePath: 'tenant/original.pdf' }) });
    f.download.mockResolvedValue({ data: { arrayBuffer: async () => bytes.buffer }, error: null });
    const result = await prepareDocumentPdf({ doc: doc() });
    if (!result.ok) throw new Error(result.error);
    expect(atob(result.data.base64)).toBe('%PDF-1.7 original stored bytes');
    expect(f.canvas).not.toHaveBeenCalled();
  });
  it('fails clearly for a missing original and never generates a replacement contract', async () => {
    f.load.mockResolvedValue({ ok: true, data: doc({ intakeStatus: 'not_started' }) });
    const result = await prepareDocumentPdf({ doc: doc() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Original als PDF hochladen');
    expect(f.canvas).not.toHaveBeenCalled();
    expect(f.download).not.toHaveBeenCalled();
  });
  it('removes its temporary render element after a render failure', async () => {
    f.canvas.mockRejectedValueOnce(new Error('Canvas failed'));
    const result = await prepareDocumentPdf({ doc: doc({ previewHtml: '<p>Vertrag</p>' }) });
    expect(result.ok).toBe(false);
    expect(document.body.children).toHaveLength(0);
  });
});
