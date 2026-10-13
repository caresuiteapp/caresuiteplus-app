import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientDocumentRecord } from '@/types/modules/client';

const db = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], error: null as unknown, reads: [] as [string, unknown][] }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  const filters: [string, unknown][] = [];
  const q = { select: () => q,
    eq: (key: string, value: unknown) => { filters.push([key, value]); db.reads.push([key, value]); return q; },
    maybeSingle: async () => ({ data: db.rows.find((row) => filters.every(([key, value]) => row[key] === value)) ?? null, error: db.error }),
  };
  return q;
} }));
import { loadClientDocumentContent, MISSING_DOCUMENT_CONTENT_MESSAGE } from '@/lib/clients/clientDocumentContentService';
import { enrichClientDocumentWithIntakeRows, mergeClientRecordDocuments } from '@/lib/clients/clientDocumentMerge';
import { buildClientDocumentPreviewFallback, buildDocumentPreviewStatusSubtitle } from '@/lib/office/officeDocumentDisplay';
import { resolveDocumentPdfSource, isDocumentPdfDownloadSupported } from '@/lib/documents/documentPdfLogic';

function document(overrides: Partial<ClientDocumentRecord> = {}): ClientDocumentRecord {
  return { id: 'stored-1', tenantId: 'tenant-1', clientId: 'client-1', title: 'Kundenvertrag', fileName: 'client_contract_assist.html',
    mimeType: 'text/html', category: 'vertrag', storagePath: null, status: 'abgeschlossen', sensitivity: 'care', uploadedBy: null,
    validUntil: null, createdAt: '2026-06-17T10:00:00Z', updatedAt: '2026-06-17T10:00:00Z', documentSource: 'intake', intakeDocumentId: 'intake-1', ...overrides };
}
function row(overrides: Record<string, unknown> = {}) {
  return { id: 'intake-1', tenant_id: 'tenant-1', client_id: 'client-1', template_key: 'client_contract_assist', document_type: 'client_contract',
    title: 'Kundenvertrag', status: 'finalized', finalized_html: '<p>Gespeicherter Vertrag mit Unterschrift</p>', preview_html: '<p>Alter Entwurf</p>',
    rendered_pdf_path: null, finalized_at: '2026-06-17T10:00:00Z', created_at: '2026-06-17T10:00:00Z', updated_at: '2026-06-17T10:00:00Z', ...overrides };
}
beforeEach(() => { db.rows = []; db.error = null; db.reads = []; });

describe('document content recovery', () => {
  it('loads the linked persisted snapshot in the exact client and tenant scope', async () => {
    db.rows = [row({ client_id: 'other-client', finalized_html: '<p>Fremd</p>' }), row()];
    const result = await loadClientDocumentContent({ doc: document({ previewHtml: ' ' }), tenantId: 'tenant-1', clientId: 'client-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.previewHtml).toContain('Gespeicherter Vertrag');
    expect(db.reads).toEqual([['tenant_id', 'tenant-1'], ['client_id', 'client-1'], ['id', 'intake-1']]);
  });
  it('rejects a foreign client before performing a read', async () => {
    expect((await loadClientDocumentContent({ doc: document(), tenantId: 'tenant-1', clientId: 'other-client' })).ok).toBe(false);
    expect(db.reads).toEqual([]);
  });
  it('keeps a missing signed snapshot missing and disables export instead of inventing contract text', async () => {
    db.rows = [row({ status: 'not_started', finalized_html: null, preview_html: null, finalized_at: null })];
    const result = await loadClientDocumentContent({ doc: document(), tenantId: 'tenant-1', clientId: 'client-1' });
    if (!result.ok) throw new Error(result.error);
    expect(result.data.previewHtml).toBeNull();
    expect(result.data.status).toBe('fehlerhaft');
    expect(isDocumentPdfDownloadSupported(result.data)).toBe(false);
    expect(buildDocumentPreviewStatusSubtitle(result.data)).toContain('Inhalt fehlt');
    expect(buildClientDocumentPreviewFallback(result.data)).toBe(MISSING_DOCUMENT_CONTENT_MESSAGE);
  });
  it('preserves storage PDFs and reports read failures', async () => {
    db.rows = [row({ finalized_html: null, preview_html: null, rendered_pdf_path: 'tenant/clients/client-1/original.pdf' })];
    const result = await loadClientDocumentContent({ doc: document(), tenantId: 'tenant-1', clientId: 'client-1' });
    if (!result.ok) throw new Error(result.error);
    expect(resolveDocumentPdfSource(result.data)).toBe('storage');
    expect(result.data.storagePath).toContain('original.pdf');
    db.error = { message: 'network error', code: '08006' };
    expect((await loadClientDocumentContent({ doc: document(), tenantId: 'tenant-1', clientId: 'client-1' })).ok).toBe(false);
  });
  it('prefers the finalized snapshot and falls back from empty fields to an existing preview', () => {
    const source = row() as Parameters<typeof enrichClientDocumentWithIntakeRows>[1][number];
    expect(enrichClientDocumentWithIntakeRows(document({ previewHtml: '<p>Unsigned</p>' }), [source]).previewHtml).toContain('Gespeicherter Vertrag');
    expect(enrichClientDocumentWithIntakeRows(document({ previewHtml: ' ' }), [{ ...source, finalized_html: ' ', preview_html: '<p>Signiert</p>' }]).previewHtml).toContain('Signiert');
  });
  it('never replaces an explicit missing link with another template instance', () => {
    const other = row({ id: 'another-intake' }) as Parameters<typeof enrichClientDocumentWithIntakeRows>[1][number];
    expect(enrichClientDocumentWithIntakeRows(document(), [other]).previewHtml).toBeUndefined();
  });
  it('matches equal template keys to their own clients when merging a tenant list', () => {
    const a = row();
    const b = row({ id: 'intake-2', client_id: 'client-2', finalized_html: '<p>Vertrag B</p>' });
    const merged = mergeClientRecordDocuments([document({ intakeDocumentId: null })], [a, b] as Parameters<typeof mergeClientRecordDocuments>[1]);
    expect(merged.find((doc) => doc.clientId === 'client-1')?.previewHtml).toContain('Gespeicherter Vertrag');
    expect(merged.find((doc) => doc.clientId === 'client-2')?.previewHtml).toContain('Vertrag B');
  });
});
