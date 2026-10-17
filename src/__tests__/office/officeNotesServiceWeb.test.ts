import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteDraft, NotesActor, OfficeNote } from '@/lib/office/notes/types.web';

type QueryCall = { table: string; operations: [string, unknown[]][] };
const f = vi.hoisted(() => ({ client: {} as object | null, getUser: vi.fn(), permissions: vi.fn(), resolve: vi.fn(), calls: [] as QueryCall[] }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.client }));
vi.mock('@/lib/supabase/permissionRepository', () => ({ fetchRuntimePermissions: (...args: unknown[]) => f.permissions(...args) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const call: QueryCall = { table, operations: [] }; f.calls.push(call);
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is', 'not', 'order', 'range', 'insert', 'update', 'delete']) chain[method] = (...args: unknown[]) => { call.operations.push([method, args]); return chain; };
  chain.maybeSingle = () => Promise.resolve().then(() => f.resolve(call));
  chain.then = (resolve: (result: unknown) => void, reject: (error: unknown) => void) => Promise.resolve().then(() => f.resolve(call)).then(resolve, reject);
  return chain;
} }));
import { createNoteDraft, noteToDraft } from '@/lib/office/notes/model.web';
import { deleteNote, listNotes, loadNote, saveNote, setNoteArchived } from '@/lib/office/notes/service.web';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';
const FOREIGN = '44444444-4444-4444-8444-444444444444';
const actor: NotesActor = { tenantId: TENANT, userId: OWNER, roleKey: 'business_admin', permissions: ['office.access'] };
const draft = (): NoteDraft => ({ ...createNoteDraft(), title: 'Private Übergabe', content: { ...createNoteDraft().content, text: 'Rückruf vorbereiten' } });
const row = (changes: Record<string, unknown> = {}, content = draft()) => ({
  id: ID, tenant_id: TENANT, owner_user_id: OWNER, title: content.title, category: content.category, format: content.format,
  status: content.status, tags: content.tags, due_date: content.dueDate || null, pinned: content.pinned, content: content.content,
  revision: 1, created_at: '2026-10-17T10:00:00.000Z', updated_at: '2026-10-17T10:01:00.000Z', archived_at: null, ...changes,
});
const record = (changes: Partial<OfficeNote> = {}): OfficeNote => ({ ...draft(), id: ID, tenantId: TENANT, ownerUserId: OWNER, revision: 1, createdAt: '2026-10-17T10:00:00.000Z', updatedAt: '2026-10-17T10:01:00.000Z', archivedAt: null, ...changes });
const scope = [['eq', ['tenant_id', TENANT]], ['eq', ['owner_user_id', OWNER]]] as const;
const queryPayload = (call: QueryCall, action: string) => call.operations.find(([method]) => method === action)?.[1][0] as Record<string, unknown>;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => {
  vi.clearAllMocks(); f.calls = []; f.client = { auth: { getUser: f.getUser } };
  f.getUser.mockResolvedValue({ data: { user: { id: OWNER, app_metadata: { portal_type: 'business' } } }, error: null });
  f.permissions.mockResolvedValue(['office.access']);
  f.resolve.mockResolvedValue({ data: row(), error: null });
});

describe('durable personal Office note service', () => {
  it('requires a real session, effective permission and administration role before touching note data', async () => {
    expect((await listNotes({ ...actor, permissions: [] })).ok).toBe(false);
    expect((await listNotes({ ...actor, roleKey: 'employee_portal' })).ok).toBe(false);
    expect((await listNotes({ ...actor, userId: 'profile-id' })).ok).toBe(false);
    f.getUser.mockResolvedValue({ data: { user: { id: FOREIGN, app_metadata: {} } }, error: null });
    expect((await listNotes(actor)).ok).toBe(false);
    f.getUser.mockResolvedValue({ data: { user: { id: OWNER, app_metadata: { portal_type: 'employee' } } }, error: null });
    expect((await listNotes(actor)).ok).toBe(false);
    expect(f.calls).toEqual([]);
  });

  it('loads runtime permissions when absent and respects a denial', async () => {
    f.permissions.mockResolvedValue([]);
    expect((await listNotes({ ...actor, permissions: undefined })).ok).toBe(false);
    expect(f.permissions).toHaveBeenCalledWith('business_admin', TENANT);
    expect(f.calls).toEqual([]);
  });

  it('does not invent local success without a connection, a table or an allowed RLS response', async () => {
    f.client = null;
    expect(await saveNote(actor, { id: ID, expectedRevision: null, draft: draft() })).toMatchObject({ ok: false });
    expect(f.calls).toEqual([]);
    f.client = { auth: { getUser: f.getUser } };
    for (const code of ['PGRST205', '42P01', '42501', 'PGRST301']) {
      f.resolve.mockResolvedValue({ data: null, error: { code, message: 'English server details' } });
      const result = await saveNote(actor, { id: ID, expectedRevision: null, draft: draft() });
      expect(result).toMatchObject({ ok: false });
      expect(result).not.toHaveProperty('uncertain');
    }
    expect(f.calls).toHaveLength(4);
  });

  it('paginates all owned notes including the archive and scopes every request', async () => {
    const first = Array.from({ length: 100 }, (_, index) => row({ id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}` }));
    f.resolve.mockResolvedValueOnce({ data: first, error: null }).mockResolvedValueOnce({ data: [row({ archived_at: '2026-10-17T10:02:00Z' })], error: null });
    const result = await listNotes(actor);
    expect(result.ok && result.data).toHaveLength(101);
    expect(f.calls[0].operations).toContainEqual(['range', [0, 99]]);
    expect(f.calls[1].operations).toContainEqual(['range', [100, 199]]);
    for (const call of f.calls) {
      expect(call.table).toBe('office_private_notes');
      expect(call.operations).toEqual(expect.arrayContaining(scope));
      expect(call.operations.some(([method]) => method === 'is')).toBe(false);
    }
  });

  it('rejects wrong-owner or malformed server records and returns null for absent IDs', async () => {
    f.resolve.mockResolvedValueOnce({ data: row({ owner_user_id: FOREIGN }), error: null });
    expect((await loadNote(actor, ID)).ok).toBe(false);
    f.resolve.mockResolvedValueOnce({ data: row({ updated_at: 'invalid' }), error: null });
    expect((await loadNote(actor, ID)).ok).toBe(false);
    f.resolve.mockResolvedValueOnce({ data: null, error: null });
    expect(await loadNote(actor, ID)).toEqual({ ok: true, data: null });
    expect(f.calls[2].operations).toEqual(expect.arrayContaining([...scope, ['eq', ['id', ID]]]));
  });

  it('creates the supplied stable ID and returns actual server timestamps and revision', async () => {
    const result = await saveNote(actor, { id: ID, expectedRevision: null, draft: draft() });
    expect(result).toMatchObject({ ok: true, data: { id: ID, revision: 1, updatedAt: '2026-10-17T10:01:00.000Z', ownerUserId: OWNER } });
    expect(queryPayload(f.calls[0], 'insert')).toMatchObject({ id: ID, tenant_id: TENANT, owner_user_id: OWNER, revision: 1 });
    expect(queryPayload(f.calls[0], 'insert')).not.toHaveProperty('updated_at');
  });

  it('uses expected revision and active-only update filters, preserving caller draft after conflict', async () => {
    const edited = draft(); edited.content.text = 'Geänderte Fassung';
    const original = JSON.stringify(edited);
    f.resolve.mockResolvedValue({ data: null, error: null });
    expect(await saveNote(actor, { id: ID, expectedRevision: 3, draft: edited })).toMatchObject({ ok: false, conflict: true });
    expect(JSON.stringify(edited)).toBe(original);
    expect(queryPayload(f.calls[0], 'update')).toMatchObject({ revision: 4, content: { text: 'Geänderte Fassung' } });
    expect(f.calls[0].operations).toEqual(expect.arrayContaining([...scope, ['eq', ['id', ID]], ['eq', ['revision', 3]], ['is', ['archived_at', null]]]));
  });

  it('reconciles lost creation receipts and duplicate-ID retries without inserting a second note', async () => {
    for (const error of [{ message: 'Failed to fetch' }, { code: '23505', message: 'duplicate key' }]) {
      f.resolve.mockResolvedValueOnce({ data: null, error }).mockResolvedValueOnce({ data: row(), error: null });
      expect(await saveNote(actor, { id: ID, expectedRevision: null, draft: draft() })).toMatchObject({ ok: true, data: { id: ID } });
    }
    expect(f.calls.filter(call => queryPayload(call, 'insert'))).toHaveLength(2);
    expect(f.calls.filter(call => !queryPayload(call, 'insert'))).toHaveLength(2);
  });

  it('never overwrites a different saved version during duplicate or interrupted request recovery', async () => {
    f.resolve.mockResolvedValueOnce({ data: null, error: { code: '23505' } }).mockResolvedValueOnce({ data: row({ title: 'Andere Fassung' }), error: null });
    expect(await saveNote(actor, { id: ID, expectedRevision: null, draft: draft() })).toMatchObject({ ok: false, conflict: true });
    f.resolve.mockRejectedValue(new Error('network offline'));
    expect(await saveNote(actor, { id: ID, expectedRevision: null, draft: draft() })).toMatchObject({ ok: false, uncertain: true });
    expect(f.calls.some(call => queryPayload(call, 'update'))).toBe(false);
  });

  it('requires a matching persisted revision and content rather than trusting any success response', async () => {
    f.resolve.mockResolvedValue({ data: row({ revision: 9 }), error: null });
    expect(await saveNote(actor, { id: ID, expectedRevision: 1, draft: draft() })).toMatchObject({ ok: false, uncertain: true });
    f.resolve.mockResolvedValue({ data: row({ title: 'Wrong content' }), error: null });
    expect(await saveNote(actor, { id: ID, expectedRevision: null, draft: draft() })).toMatchObject({ ok: false, uncertain: true });
  });

  it('deduplicates identical in-flight requests, queues different writes and snapshots the caller draft', async () => {
    const gate = deferred<{ data: ReturnType<typeof row>; error: null }>();
    f.resolve.mockImplementationOnce(() => gate.promise).mockResolvedValueOnce({ data: null, error: null });
    const firstDraft = draft();
    const first = saveNote(actor, { id: ID, expectedRevision: null, draft: firstDraft });
    const duplicate = saveNote(actor, { id: ID, expectedRevision: null, draft: draft() });
    const changed = draft(); changed.title = 'Zweite Fassung';
    const next = saveNote(actor, { id: ID, expectedRevision: 1, draft: changed });
    firstDraft.title = 'Spätere Eingabe';
    await vi.waitFor(() => expect(f.calls).toHaveLength(1));
    expect(queryPayload(f.calls[0], 'insert').title).toBe('Private Übergabe');
    gate.resolve({ data: row(), error: null });
    const results = await Promise.all([first, duplicate, next]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].ok).toBe(true);
    expect(results[2]).toMatchObject({ ok: false, conflict: true });
    expect(f.calls).toHaveLength(2);
    expect(queryPayload(f.calls[1], 'update').title).toBe('Zweite Fassung');
  });

  it('does not deduplicate away changed effective permission denial', async () => {
    const gate = deferred<{ data: ReturnType<typeof row>; error: null }>();
    f.resolve.mockImplementationOnce(() => gate.promise);
    const first = saveNote(actor, { id: ID, expectedRevision: null, draft: draft() });
    const denied = saveNote({ ...actor, permissions: [] }, { id: ID, expectedRevision: null, draft: draft() });
    await vi.waitFor(() => expect(f.calls).toHaveLength(1));
    gate.resolve({ data: row(), error: null });
    expect((await first).ok).toBe(true);
    expect((await denied).ok).toBe(false);
    expect(f.calls).toHaveLength(1);
  });

  it('archives and restores using revision receipts without changing note content', async () => {
    const archivedAt = '2026-10-17T12:00:00.000Z';
    f.resolve.mockResolvedValueOnce({ data: row({ revision: 2, archived_at: archivedAt }), error: null });
    const result = await setNoteArchived(actor, record(), true);
    expect(result).toMatchObject({ ok: true, data: { revision: 2, archivedAt } });
    expect(f.calls[0].operations).toEqual(expect.arrayContaining([...scope, ['eq', ['revision', 1]]]));
    expect(queryPayload(f.calls[0], 'update')).not.toHaveProperty('content');
    if (!result.ok) throw new Error('Expected archived note');
    f.resolve.mockResolvedValueOnce({ data: row({ revision: 3, archived_at: null }), error: null });
    expect(await setNoteArchived(actor, result.data, false)).toMatchObject({ ok: true, data: { revision: 3, archivedAt: null } });
    expect(noteToDraft(result.data)).toEqual(draft());
  });

  it('deletes only the owned archive revision and never claims an absent receipt succeeded', async () => {
    f.resolve.mockResolvedValueOnce({ data: row({ revision: 4, archived_at: '2026-10-17T12:00:00Z' }), error: null });
    expect(await deleteNote(actor, ID, 4)).toEqual({ ok: true, data: { id: ID } });
    expect(f.calls[0].operations).toEqual(expect.arrayContaining([...scope, ['eq', ['id', ID]], ['eq', ['revision', 4]], ['not', ['archived_at', 'is', null]]]));
    f.resolve.mockResolvedValueOnce({ data: null, error: null });
    expect(await deleteNote(actor, ID, 4)).toMatchObject({ ok: false, conflict: true });
    f.resolve.mockResolvedValueOnce({ data: row({ archived_at: null }), error: null });
    expect(await deleteNote(actor, ID, 1)).toMatchObject({ ok: false, uncertain: true });
  });
});
