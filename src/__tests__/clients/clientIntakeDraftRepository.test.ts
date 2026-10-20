import { beforeEach, describe, expect, it, vi } from 'vitest';
import { upsertClientIntakeDraft, loadServerClientIntakeDraft, reconcileServerClientIntakeDraft } from '@/lib/clients/repositories/clientIntakeDraftRepository.supabase';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('@/lib/clients/clientIntakeService', () => ({ createEmptyIntakeForm: () => structuredClone(EMPTY_CLIENT_INTAKE_FORM) }));
const tenantId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const form = { ...EMPTY_CLIENT_INTAKE_FORM, firstName: 'Entwurf', intakeDocuments: [{ templateKey: 'privacy', signatures: { client: { dataUrl: 'data:image/png;base64,signature' } } }] } as typeof EMPTY_CLIENT_INTAKE_FORM;
const options = { clientId, operationId, expectedRevision: 4 };
const receipt = { contract: 'client-intake-draft-v1', clientId, operationId, revision: 5, formHash: `sha256:${'a'.repeat(64)}`, status: 'draft', replayed: false };
beforeEach(() => { vi.resetAllMocks(); mocks.rpc.mockResolvedValue({ data: receipt, error: null }); });
describe('complete revisioned intake draft RPC', () => {
  it('sends the full form including captured signatures and leaves actor identity to the server', async () => {
    expect(await upsertClientIntakeDraft(tenantId, form, { ...options, actorProfileId: 'untrusted' })).toEqual({ ok: true, data: { ...receipt, id: clientId } });
    expect(mocks.rpc).toHaveBeenCalledWith('client_intake_save_draft', { p_tenant: tenantId, p_client: clientId, p_form: form, p_expected_revision: 4, p_operation_id: operationId });
  });
  it('retains scope after a lost response and accepts the same operation replay', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('lost'));
    expect(await upsertClientIntakeDraft(tenantId, form, options)).toMatchObject({ ok: false, recoverableClientId: clientId });
    mocks.rpc.mockResolvedValueOnce({ data: { ...receipt, replayed: true }, error: null });
    expect((await upsertClientIntakeDraft(tenantId, form, options)).ok).toBe(true);
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
  });
  it.each([{ clientId: tenantId }, { operationId: clientId }, { revision: 6 }, { status: 'active' }, { formHash: 'claimed' }, { contract: 'other' }, { replayed: undefined }])('rejects inconsistent confirmation %j', async patch => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...receipt, ...patch }, error: null });
    expect((await upsertClientIntakeDraft(tenantId, form, options)).ok).toBe(false);
  });
  it('reports concurrent revision conflict without retrying a blind overwrite', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'conflict' } });
    expect(await upsertClientIntakeDraft(tenantId, form, options)).toMatchObject({ ok: false, conflict: true, recoverableClientId: clientId });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(['40003', '08007'])('keeps retry identity when SQL reports uncertain completion %s', async code => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'completion unknown' } });
    expect(await upsertClientIntakeDraft(tenantId, form, options)).toMatchObject({ ok: false, rejected: false, recoverableClientId: clientId });
  });
  it('rejects malformed identities and revisions before any request', async () => {
    expect((await upsertClientIntakeDraft('tenant', form, options)).ok).toBe(false);
    expect((await upsertClientIntakeDraft(tenantId, form, { ...options, expectedRevision: -1 })).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('loads a complete scope-checked server draft for another device', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...receipt, form, updatedAt: '2026-10-14T10:00:00Z' }, error: null });
    const result = await loadServerClientIntakeDraft(tenantId, clientId);
    expect(result).toMatchObject({ ok: true, data: { clientId, revision: 5, form: { firstName: 'Entwurf', intakeDocuments: form.intakeDocuments.map(doc => ({ ...doc, missingPlaceholders: ['Gespeichertes Dokument prüfen'], unresolvedKeys: [] })) } } });
    expect(mocks.rpc).toHaveBeenCalledWith('client_intake_load_draft', { p_tenant: tenantId, p_client: clientId });
  });
  it('reconciles only the server-identified core version without sending client-supplied field values', async () => {
    const expectedClientUpdatedAt = '2026-10-14T12:00:00.123Z';
    expect(await reconcileServerClientIntakeDraft(tenantId, { ...options, expectedClientUpdatedAt })).toEqual({ ok: true, data: { ...receipt, id: clientId } });
    expect(mocks.rpc).toHaveBeenCalledWith('client_intake_reconcile_draft', { p_tenant: tenantId, p_client: clientId,
      p_expected_revision: 4, p_expected_client_updated_at: expectedClientUpdatedAt, p_operation_id: operationId });
  });
  it('keeps uncertain reconciliation retryable and rejects wrong receipts or a concurrent core change', async () => {
    const input = { ...options, expectedClientUpdatedAt: '2026-10-14T12:00:00Z' };
    mocks.rpc.mockRejectedValueOnce(new Error('response lost'));
    expect(await reconcileServerClientIntakeDraft(tenantId, input)).toMatchObject({ ok: false, recoverableClientId: clientId, rejected: false });
    mocks.rpc.mockResolvedValueOnce({ data: { ...receipt, revision: 7 }, error: null });
    expect((await reconcileServerClientIntakeDraft(tenantId, input)).ok).toBe(false);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'new core version' } });
    expect(await reconcileServerClientIntakeDraft(tenantId, input)).toMatchObject({ ok: false, conflict: true, rejected: true });
  });
  it('exposes external core changes without turning a read into a write', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...receipt, form, updatedAt: '2026-10-14T10:00:00Z', coreChanged: true, currentClientUpdatedAt: '2026-10-14T12:00:00Z' }, error: null });
    expect(await loadServerClientIntakeDraft(tenantId, clientId)).toMatchObject({ ok: true, data: { coreChanged: true, currentClientUpdatedAt: '2026-10-14T12:00:00Z' } });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it('distinguishes a missing snapshot from invalid or foreign data', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await loadServerClientIntakeDraft(tenantId, clientId)).toEqual({ ok: true, data: null });
    mocks.rpc.mockResolvedValueOnce({ data: { ...receipt, clientId: tenantId, form, updatedAt: 'now' }, error: null });
    expect((await loadServerClientIntakeDraft(tenantId, clientId)).ok).toBe(false);
  });
});
