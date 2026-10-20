import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntakeDocumentState } from '@/features/intakeDocuments/intakeDocumentTypes';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';

const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], writes: [] as { table: string; action: string; patch: Record<string, unknown>; filters: [string, unknown][] }[], readError: null as unknown, conflict: false }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: (table: string) => {
  let action = 'read'; let patch: Record<string, unknown> = {};
  const filters: [string, unknown][] = [];
  const selected = () => state.rows.filter((row) => filters.every(([key, value]) => row[key] === value));
  const result = (single: boolean) => {
    if (action === 'read') return { data: single ? selected()[0] ?? null : selected(), error: state.readError };
    state.writes.push({ table, action, patch, filters });
    if (table === 'client_intake_documents' && action === 'update' && (state.conflict || selected().length === 0)) return { data: null, error: null };
    if (table === 'client_intake_documents') {
      const row = { ...(action === 'update' ? selected()[0] : { id: `new-${patch.template_key}` }), ...patch };
      state.rows = [...state.rows.filter((r) => r.id !== row.id), row];
      return { data: { id: row.id }, error: null };
    }
    return { data: { id: 'written' }, error: null };
  };
  const q = { select: () => q, eq: (key: string, value: unknown) => { filters.push([key, value]); return q; },
    insert: (value: Record<string, unknown>) => { action = 'insert'; patch = value; return q; },
    update: (value: Record<string, unknown>) => { action = 'update'; patch = value; return q; },
    upsert: (value: Record<string, unknown>) => { action = 'upsert'; patch = value; return q; },
    single: async () => result(true), maybeSingle: async () => result(true),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result(false)).then(resolve),
  }; return q;
} }) }));
import { persistIntakeDocumentsForClient } from '@/features/intakeDocuments/intakeDocumentRepository';

function doc(overrides: Partial<IntakeDocumentState> = {}): IntakeDocumentState {
  return { templateKey: 'client_contract_assist', documentType: 'client_contract', title: 'Kundenvertrag', isRequired: true,
    status: 'not_started', source: 'system', tenantTemplateId: null, version: 3, missingPlaceholders: [], unresolvedKeys: [],
    previewHtml: null, finalizedHtml: null, renderedPdfPath: null, signatures: {}, previewOpenedAt: null, finalizedAt: null, ...overrides };
}
function saved(overrides: Record<string, unknown> = {}) {
  return { id: 'intake-1', tenant_id: 'tenant-1', client_id: 'client-1', template_key: 'client_contract_assist', status: 'finalized',
    finalized_html: '<p>Original signiert</p>', preview_html: '<p>Original signiert</p>', rendered_pdf_path: null,
    finalized_at: '2026-06-17T10:00:00Z', updated_at: '2026-06-17T10:00:00Z', ...overrides };
}
const save = (document: IntakeDocumentState) => persistIntakeDocumentsForClient('tenant-1', 'client-1', { ...EMPTY_CLIENT_INTAKE_FORM, intakeContractType: '', intakeDocuments: [document] });
beforeEach(() => { state.rows = []; state.writes = []; state.readError = null; state.conflict = false; });

describe('signed intake snapshot preservation', () => {
  it('leaves a finalized original and its signatures untouched when an empty form is saved', async () => {
    state.rows = [saved()];
    expect((await save(doc())).ok).toBe(true);
    expect(state.rows[0].finalized_html).toContain('Original signiert');
    expect(state.writes).toEqual([]);
  });
  it('keeps the finalized version when a stale browser submits a different regenerated body', async () => {
    state.rows = [saved()];
    expect((await save(doc({ status: 'finalized', finalizedHtml: '<p>Aktuelle Vorlage</p>', previewHtml: '<p>Aktuelle Vorlage</p>' }))).ok).toBe(true);
    expect(state.writes).toEqual([]);
  });
  it('preserves a signed preview against a regression to not_started', async () => {
    state.rows = [saved({ status: 'signed', finalized_at: null, finalized_html: null })];
    expect((await save(doc({ previewHtml: '<p>Neuer Entwurf</p>' }))).ok).toBe(true);
    expect(state.writes).toEqual([]);
  });
  it('rejects a signed/finalized document with no content before writing anything', async () => {
    const result = await save(doc({ status: 'finalized', signatures: { client: { role: 'client', dataUrl: 'data:image/png;base64,test', signedAt: '2026-06-17T10:00:00Z' } } }));
    expect(result.ok).toBe(false);
    expect(state.writes).toEqual([]);
  });
  it('rejects a signature placeholder without creating completion evidence', async () => {
    const result = await save(doc({ status: 'finalized', finalizedHtml: '<p>Vertrag mit echter Signatur</p>', previewHtml: '<p>Vertrag mit echter Signatur</p>',
      signatures: { client: { role: 'client', dataUrl: 'data:image/png;base64,existing', signedAt: '2026-06-17T10:00:00Z' } } }));
    expect(result.ok).toBe(false);
    expect(state.rows).toEqual([]);
    expect(state.writes).toEqual([]);
  });
  it('does not report a new original as completed before trusted atomic server completion exists, even with a real PNG', async () => {
    // A valid one-pixel PNG proves that the guard does not merely check the
    // data URL prefix. Image validity alone is no server completion receipt.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const result = await save(doc({ status: 'finalized', finalizedHtml: `<p>Original<img src="${png}"></p>`,
      signatures: { client: { role: 'client', dataUrl: png, signedAt: '2026-06-17T10:00:00Z' } } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('atomaren Serverabschluss');
    expect(state.writes).toEqual([]);
  });
  it('rejects a concurrent revision change without writing events or signatures', async () => {
    state.rows = [saved({ status: 'preview_open', finalized_html: null, finalized_at: null })]; state.conflict = true;
    const result = await save(doc({ status: 'preview_open', previewHtml: '<p>Neuer Entwurf</p>' }));
    expect(result.ok).toBe(false);
    const write = state.writes[0];
    expect(write.filters).toContainEqual(['tenant_id', 'tenant-1']);
    expect(write.filters).toContainEqual(['client_id', 'client-1']);
    expect(write.filters).toContainEqual(['updated_at', '2026-06-17T10:00:00Z']);
    expect(state.writes).toHaveLength(1);
    expect(state.rows[0].preview_html).toContain('Original');
  });
  it('fails closed if the persisted revision cannot be read', async () => {
    state.readError = { code: '42501', message: 'permission denied' };
    expect((await save(doc({ status: 'signed', previewHtml: '<p>Test</p>' }))).ok).toBe(false);
    expect(state.writes).toEqual([]);
  });
  it('keeps consent status finalized when another document is saved alongside an empty stale contract', async () => {
    state.rows = [saved()];
    const result = await persistIntakeDocumentsForClient('tenant-1', 'client-1', { ...EMPTY_CLIENT_INTAKE_FORM, intakeContractType: '',
      intakeDocuments: [doc(), doc({ templateKey: 'privacy_consent_default', documentType: 'privacy_consent', status: 'preview_open', previewHtml: '<p>Einwilligung</p>' })] });
    expect(result.ok).toBe(true);
    expect(state.rows.find((row) => row.id === 'intake-1')?.finalized_html).toContain('Original signiert');
    expect(state.writes.find((w) => w.table === 'client_consent_status')?.patch).toMatchObject({ contract_status: 'finalized', contract_finalized_at: '2026-06-17T10:00:00Z' });
  });
  it('allows an explicit revocation while retaining the original signed body and advancing its revision', async () => {
    state.rows = [saved()];
    expect((await save(doc({ status: 'revoked' }))).ok).toBe(true);
    expect(state.rows[0].status).toBe('revoked');
    expect(state.rows[0].finalized_html).toContain('Original signiert');
    expect(state.rows[0].updated_at).not.toBe('2026-06-17T10:00:00Z');
    expect(state.writes.some((w) => w.table === 'client_document_signatures')).toBe(false);
  });
});
