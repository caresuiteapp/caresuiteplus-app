import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalNoteActor, InternalNoteDraft } from '@/lib/office/notes/internalTypes.web';
const f = vi.hoisted(() => ({ client: null as unknown, getUser: vi.fn(), permissions: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.client }));
vi.mock('@/lib/supabase/permissionRepository', () => ({ fetchRuntimePermissions: (...args: unknown[]) => f.permissions(...args) }));
const TENANT = '11111111-1111-4111-8111-111111111111', USER = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE = '33333333-3333-4333-8333-333333333333', ID = '44444444-4444-4444-8444-444444444444';
const DELIVERY = '55555555-5555-4555-8555-555555555555', REQUEST = '66666666-6666-4666-8666-666666666666', OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = '2026-10-18T12:00:00.000Z';
const actor: InternalNoteActor = { tenantId: TENANT, userId: USER, roleKey: 'business_admin', permissions: ['office.access', 'communication.send_message'] };
const recipient: InternalNoteActor = { tenantId: TENANT, userId: USER, roleKey: 'employee_portal', employeeId: EMPLOYEE };
const draft = (): InternalNoteDraft => ({ title: ' Rückruf ', body: ' Bitte heute zurückrufen. ', kind: 'callback', priority: 'normal', dueDate: '', recipientEmployeeIds: [EMPLOYEE] });
const receipt = () => ({ dispatch_id: ID, created_at: NOW, tenant_id: TENANT, sender_user_id: USER });
const delivery = (changes: Record<string, unknown> = {}) => ({ id: DELIVERY, employee_id: EMPLOYEE, recipient_user_id: USER, display_name: 'Alex', status: 'open', read_at: null, response: '', revision: 1, updated_at: NOW, ...changes });
const note = (changes: Record<string, unknown> = {}) => ({ id: ID, tenant_id: TENANT, sender_user_id: USER, sender_name: 'Verwaltung', title: 'Rückruf', body: 'Bitte heute zurückrufen.', type: 'callback', priority: 'normal', due_date: null, created_at: NOW, deliveries: [delivery()], ...changes });
const response = (data: unknown) => ({ data, error: null });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
let service: typeof import('@/lib/office/notes/internalService.web');
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  f.client = { auth: { getUser: f.getUser }, rpc: f.rpc };
  f.getUser.mockResolvedValue({ data: { user: { id: USER, app_metadata: { portal_type: 'business' } } }, error: null });
  f.permissions.mockResolvedValue(['office.access', 'communication.send_message']);
  f.rpc.mockResolvedValue(response(receipt()));
  service = await import('@/lib/office/notes/internalService.web');
});

describe('internal note service scope and receipts', () => {
  it('requires a real current session and both sender permissions without trusting a private-note owner field', async () => {
    for (const restricted of [{ ...actor, permissions: ['office.access'] as const }, { ...actor, permissions: [] }, { ...actor, roleKey: 'employee_portal' as const }, { ...actor, readOnly: true }]) expect((await service.sendInternalNote(restricted, REQUEST, draft())).ok).toBe(false);
    f.getUser.mockResolvedValue({ data: { user: { id: OTHER, app_metadata: {} } }, error: null });
    expect((await service.sendInternalNote(actor, REQUEST, draft())).ok).toBe(false);
    f.getUser.mockResolvedValue({ data: { user: { id: USER, app_metadata: { portal_type: 'client' } } }, error: null });
    expect((await service.sendInternalNote(actor, REQUEST, draft())).ok).toBe(false);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('loads effective permissions when absent and never claims local success without a connection', async () => {
    f.permissions.mockResolvedValue(['office.access']);
    expect((await service.sendInternalNote({ ...actor, permissions: undefined }, REQUEST, draft())).ok).toBe(false);
    expect(f.permissions).toHaveBeenCalledWith('business_admin', TENANT);
    f.client = null;
    expect((await service.sendInternalNote(actor, REQUEST, draft())).ok).toBe(false);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('sends only the reviewed allowlisted copy using caller UUID, canonical recipient order and actual server receipt', async () => {
    const source = { ...draft(), recipientEmployeeIds: [OTHER.toUpperCase(), EMPLOYEE], ownerUserId: 'PRIVATE', sourceNoteId: 'PRIVATE', content: { strokes: ['PRIVATE'], summary: 'PRIVATE' } };
    expect(await service.sendInternalNote(actor, REQUEST, source)).toEqual({ ok: true, data: { dispatchId: ID, createdAt: NOW } });
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith('office_internal_note_send', { p_tenant_id: TENANT, p_sender_user_id: USER, p_request_id: REQUEST, p_payload: { title: 'Rückruf', body: 'Bitte heute zurückrufen.', type: 'callback', priority: 'normal', due_date: null, recipient_employee_ids: [EMPLOYEE, OTHER] } });
    expect(JSON.stringify(f.rpc.mock.calls)).not.toContain('PRIVATE');
  });
  it('snapshots editable inputs and deduplicates identical in-flight sends, while rechecking changed permissions', async () => {
    const gate = deferred<ReturnType<typeof response>>(); f.rpc.mockImplementationOnce(() => gate.promise);
    const source = draft(), first = service.sendInternalNote(actor, REQUEST, source), second = service.sendInternalNote(actor, REQUEST, draft());
    source.body = 'Later editing'; source.recipientEmployeeIds.push(OTHER);
    const denied = await service.sendInternalNote({ ...actor, permissions: [] }, REQUEST, draft());
    expect(denied.ok).toBe(false);
    await vi.waitFor(() => expect(f.rpc).toHaveBeenCalledTimes(1));
    expect(f.rpc.mock.calls[0][1].p_payload.body).toBe('Bitte heute zurückrufen.');
    gate.resolve(response(receipt())); expect(await first).toEqual(await second);
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it('retains an uncertain send and only retries its unchanged UUID/payload, including after a later definitive error', async () => {
    f.rpc.mockRejectedValueOnce(new Error('network lost'));
    expect(await service.sendInternalNote(actor, REQUEST, draft())).toMatchObject({ ok: false, uncertain: true });
    expect(await service.sendInternalNote(actor, OTHER, draft())).toMatchObject({ ok: false, uncertain: true, conflict: true });
    expect(await service.sendInternalNote(actor, REQUEST, { ...draft(), body: 'Changed' })).toMatchObject({ ok: false, uncertain: true, conflict: true });
    expect(f.rpc).toHaveBeenCalledTimes(1);
    f.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    expect(await service.sendInternalNote(actor, REQUEST, draft())).toMatchObject({ ok: false, uncertain: true });
    expect(await service.sendInternalNote(actor, OTHER, draft())).toMatchObject({ ok: false, uncertain: true });
    f.rpc.mockResolvedValueOnce(response(receipt()));
    expect(await service.sendInternalNote(actor, REQUEST, draft())).toMatchObject({ ok: true });
    expect(f.rpc.mock.calls.map(call => call[1].p_request_id)).toEqual([REQUEST, REQUEST, REQUEST]);
    expect((await service.sendInternalNote(actor, OTHER, draft())).ok).toBe(true);
  });
  it('treats missing or malformed send receipts as uncertain, not as successful deliveries', async () => {
    for (const data of [null, {}, { ...receipt(), created_at: 'invalid' }, { ...receipt(), sender_user_id: OTHER }, { ...receipt(), tenant_id: OTHER }]) {
      f.rpc.mockResolvedValueOnce(response(data));
      expect(await service.sendInternalNote(actor, REQUEST, draft())).toMatchObject({ ok: false, uncertain: true });
    }
  });
  it('restores an unconfirmed reviewed copy only to the matching authorized account and keeps the internal copy immutable', async () => {
    f.rpc.mockRejectedValueOnce(new Error('network lost'));
    await service.sendInternalNote(actor, REQUEST, draft());
    const recovered = await service.recoverPendingInternalNoteSend(actor);
    expect(recovered).toEqual({ ok: true, data: { requestId: REQUEST, draft: { ...draft(), title: 'Rückruf', body: 'Bitte heute zurückrufen.' } } });
    if (!recovered.ok || !recovered.data) throw new Error('Expected recovery');
    recovered.data.draft.body = 'Changed outside'; recovered.data.draft.recipientEmployeeIds.push(OTHER);
    expect(await service.recoverPendingInternalNoteSend({ ...actor, permissions: [] })).toMatchObject({ ok: false });
    expect(await service.recoverPendingInternalNoteSend({ ...actor, userId: OTHER })).toMatchObject({ ok: false });
    f.getUser.mockResolvedValueOnce({ data: { user: { id: OTHER, app_metadata: { portal_type: 'business' } } }, error: null });
    expect(await service.recoverPendingInternalNoteSend({ ...actor, userId: OTHER })).toEqual({ ok: true, data: null });
    expect(await service.recoverPendingInternalNoteSend(actor)).toMatchObject({ ok: true, data: { requestId: REQUEST, draft: { body: 'Bitte heute zurückrufen.', recipientEmployeeIds: [EMPLOYEE] } } });
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it('awaits an in-flight send before recovery without sending again and rechecks a changed session after the wait', async () => {
    const gate = deferred<ReturnType<typeof response>>(); f.rpc.mockImplementationOnce(() => gate.promise);
    const sending = service.sendInternalNote(actor, REQUEST, draft());
    await vi.waitFor(() => expect(f.rpc).toHaveBeenCalledTimes(1));
    const recovery = service.recoverPendingInternalNoteSend(actor);
    await vi.waitFor(() => expect(f.getUser).toHaveBeenCalledTimes(2));
    gate.resolve({ data: null, error: { message: 'connection lost' } });
    expect(await sending).toMatchObject({ ok: false, uncertain: true });
    expect(await recovery).toMatchObject({ ok: true, data: { requestId: REQUEST } });
    f.rpc.mockResolvedValueOnce(response(receipt()));
    await service.sendInternalNote(actor, REQUEST, draft());
    expect(await service.recoverPendingInternalNoteSend(actor)).toEqual({ ok: true, data: null });
    expect(f.rpc).toHaveBeenCalledTimes(2);
  });
  it('does not expose pending text when login changes while recovery waits for the old send', async () => {
    const gate = deferred<ReturnType<typeof response>>(); f.rpc.mockImplementationOnce(() => gate.promise);
    const sending = service.sendInternalNote(actor, REQUEST, draft());
    await vi.waitFor(() => expect(f.rpc).toHaveBeenCalledTimes(1));
    const recovery = service.recoverPendingInternalNoteSend(actor);
    await vi.waitFor(() => expect(f.getUser).toHaveBeenCalledTimes(2));
    f.getUser.mockResolvedValue({ data: { user: { id: OTHER, app_metadata: {} } }, error: null });
    gate.resolve({ data: null, error: { message: 'connection lost' } });
    await sending;
    expect(await recovery).toMatchObject({ ok: false });
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it('distinguishes missing rollout, denied access, invalid input and transport errors without echoing SQL details', async () => {
    for (const code of ['PGRST202', '42883', '42501', '22023']) {
      f.rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'PRIVATE SERVER DETAIL' } });
      const result = await service.sendInternalNote(actor, REQUEST, draft());
      expect(result).toMatchObject({ ok: false }); expect(result).not.toHaveProperty('uncertain'); expect(JSON.stringify(result)).not.toContain('PRIVATE');
    }
  });
  it('loads only active backend-provided recipient rows and paginates without accepting partial or changing lists', async () => {
    f.rpc.mockResolvedValueOnce(response({ items: [{ employee_id: EMPLOYEE, display_name: 'Alex' }], total: 1 }));
    expect(await service.listInternalRecipients(actor)).toEqual({ ok: true, data: [{ employeeId: EMPLOYEE, displayName: 'Alex' }] });
    expect(f.rpc).toHaveBeenLastCalledWith('office_internal_note_recipients', { p_tenant_id: TENANT, p_query: '', p_limit: 100, p_offset: 0 });
    f.rpc.mockResolvedValueOnce(response({ items: [{ employee_id: EMPLOYEE, display_name: 'Alex' }], total: 2 }));
    expect((await service.listInternalRecipients(actor)).ok).toBe(false);
    f.rpc.mockResolvedValueOnce(response({ items: [{ employee_id: 'invalid', display_name: 'Alex' }], total: 1 }));
    expect((await service.listInternalRecipients(actor)).ok).toBe(false);
  });
  it('checks sender scope and recipient-specific inbox identity without giving the receiver other deliveries', async () => {
    f.rpc.mockResolvedValueOnce(response({ items: [note()], total: 1 }));
    expect(await service.listInternalNotes(actor, 'sent')).toMatchObject({ ok: true, data: [{ senderUserId: USER, tenantId: TENANT, dueDate: '' }] });
    f.rpc.mockResolvedValueOnce(response({ items: [note({ sender_user_id: OTHER })], total: 1 }));
    expect((await service.listInternalNotes(actor, 'sent')).ok).toBe(false);
    f.getUser.mockResolvedValue({ data: { user: { id: USER, app_metadata: { portal_type: 'employee' } } }, error: null });
    f.rpc.mockResolvedValueOnce(response({ items: [note({ sender_user_id: OTHER })], total: 1 }));
    expect((await service.listInternalNotes(recipient, 'inbox')).ok).toBe(true);
    for (const changes of [{ tenant_id: OTHER }, { deliveries: [delivery(), delivery({ id: OTHER, employee_id: OTHER })] }, { deliveries: [delivery({ recipient_user_id: OTHER })] }, { deliveries: [delivery({ employee_id: OTHER })] }, { deliveries: [delivery({ revision: 0 })] }]) {
      f.rpc.mockResolvedValueOnce(response({ items: [note(changes)], total: 1 }));
      expect((await service.listInternalNotes(recipient, 'inbox')).ok).toBe(false);
    }
  });
  it('requires a linked employee for receiving and blocks read-only mutations before RPC', async () => {
    expect((await service.listInternalNotes({ ...recipient, employeeId: undefined }, 'inbox')).ok).toBe(false);
    expect((await service.updateInternalDelivery({ ...recipient, readOnly: true }, { deliveryId: DELIVERY, employeeId: EMPLOYEE, expectedRevision: 1, action: 'read' })).ok).toBe(false);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('updates only the current employee delivery with revision checks and preserves versus clears the response explicitly', async () => {
    f.rpc.mockResolvedValueOnce(response(delivery({ read_at: NOW, revision: 2 })));
    expect(await service.updateInternalDelivery(recipient, { deliveryId: DELIVERY, employeeId: EMPLOYEE, expectedRevision: 1, action: 'read' })).toMatchObject({ ok: true, data: { readAt: NOW, revision: 2 } });
    expect(f.rpc).toHaveBeenLastCalledWith('office_internal_note_delivery_update', { p_tenant_id: TENANT, p_delivery_id: DELIVERY, p_expected_revision: 1, p_action: 'read', p_status: null, p_response: null });
    f.rpc.mockResolvedValueOnce(response(delivery({ read_at: NOW, status: 'done', response: 'Bestehende Antwort', revision: 3 })));
    expect((await service.updateInternalDelivery(recipient, { deliveryId: DELIVERY, employeeId: EMPLOYEE, expectedRevision: 2, action: 'status', status: 'done' })).ok).toBe(true);
    expect(f.rpc.mock.calls.at(-1)?.[1].p_response).toBeNull();
    f.rpc.mockResolvedValueOnce(response(delivery({ read_at: NOW, status: 'done', revision: 4 })));
    expect((await service.updateInternalDelivery(recipient, { deliveryId: DELIVERY, employeeId: EMPLOYEE, expectedRevision: 3, action: 'status', status: 'done', response: '' })).ok).toBe(true);
    expect(f.rpc.mock.calls.at(-1)?.[1].p_response).toBe('');
  });
  it('requires reload after a conflict or uncertain status write and rejects wrong result identity/revision', async () => {
    const operation = { deliveryId: DELIVERY, employeeId: EMPLOYEE, expectedRevision: 1, action: 'status' as const, status: 'done' as const, response: 'Erledigt' };
    f.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001' } });
    expect(await service.updateInternalDelivery(recipient, operation)).toMatchObject({ ok: false, conflict: true });
    for (const changes of [{ employee_id: OTHER }, { recipient_user_id: OTHER }, { revision: 7 }, { status: 'open' }, { response: 'Andere Antwort' }]) {
      f.rpc.mockResolvedValueOnce(response(delivery({ read_at: NOW, revision: 2, status: 'done', response: 'Erledigt', ...changes })));
      expect(await service.updateInternalDelivery(recipient, operation)).toMatchObject({ ok: false, uncertain: true });
    }
  });
  it('deduplicates concurrent identical delivery writes and blocks changed intent until the pending result arrives', async () => {
    const gate = deferred<ReturnType<typeof response>>(); f.rpc.mockImplementationOnce(() => gate.promise);
    const operation = { deliveryId: DELIVERY, employeeId: EMPLOYEE, expectedRevision: 1, action: 'read' as const };
    const first = service.updateInternalDelivery(recipient, operation), second = service.updateInternalDelivery(recipient, operation);
    await vi.waitFor(() => expect(f.rpc).toHaveBeenCalledTimes(1));
    expect(await service.updateInternalDelivery(recipient, { ...operation, action: 'status', status: 'done' })).toMatchObject({ ok: false, conflict: true });
    gate.resolve(response(delivery({ read_at: NOW, revision: 2 }))); expect(await first).toEqual(await second);
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
});
