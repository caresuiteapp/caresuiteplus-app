import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import {
  mapKIMMessageEvidenceRow,
  projectKIMMessageVerification,
} from '../../src/lib/ti/kimMessageEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenantId = id(1);
const mailboxId = id(2);
const row = (overrides = {}) => ({
  id: id(3),
  tenant_id: tenantId,
  mailbox_id: mailboxId,
  sender: ' kim-praxis@example.test ',
  sender_name: ' Praxis Original ',
  subject: ' Befund unverändert ',
  preview: ' Vorschau unverändert ',
  body: ' Nachricht\nmit Originalabstand ',
  status: 'read',
  received_at: '2026-10-14T08:00:00.000001+02:00',
  has_attachments: false,
  is_medical: true,
  created_at: '2026-10-14T06:00:00.000002Z',
  updated_at: '2026-10-14T06:00:00.000003Z',
  ...overrides,
});
const context = { tenantId, mailboxId };

test('strict KIM mapping preserves native IDs, original strings, offsets and microseconds', () => {
  const input = row();
  const result = mapKIMMessageEvidenceRow(input, context);
  assert.equal(result.id, id(3));
  assert.equal(result.sender, input.sender);
  assert.equal(result.body, input.body);
  assert.equal(result.receivedAt, input.received_at);
  assert.equal(result.createdAt, input.created_at);
  assert.ok(Object.isFrozen(result));
});

test('invalid or foreign message, tenant and mailbox UUIDs reject the row', () => {
  for (const changed of [
    { id: '3' },
    { tenant_id: id(9) },
    { mailbox_id: id(9) },
    { mailbox_id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' },
  ]) assert.throws(() => mapKIMMessageEvidenceRow(row(changed), context));
  assert.throws(() => mapKIMMessageEvidenceRow(row(), { tenantId: 'bad', mailboxId }));
});

test('missing or mistyped original strings, status and booleans never receive defaults or coercion', () => {
  const missing = row();
  delete missing.body;
  for (const changed of [
    missing,
    row({ sender: null }),
    row({ sender_name: undefined }),
    row({ status: 'delivered' }),
    row({ has_attachments: 0 }),
    row({ is_medical: 'true' }),
  ]) assert.throws(() => mapKIMMessageEvidenceRow(changed, context));
});

test('missing, typeless, timezone-free and impossible timestamps are rejected instead of replaced', () => {
  const missing = row();
  delete missing.received_at;
  for (const changed of [
    missing,
    row({ created_at: null }),
    row({ updated_at: '2026-10-14T06:00:00Z' }),
    row({ updated_at: '2026-10-14T06:00:00.1234567Z' }),
    row({ received_at: '2026-02-30T08:00:00.000001+02:00' }),
  ]) assert.throws(() => mapKIMMessageEvidenceRow(changed, context));
});

test('received, stored and updated times must retain a possible microsecond order', () => {
  assert.throws(() => mapKIMMessageEvidenceRow(row({
    updated_at: '2026-10-14T06:00:00.000001Z',
  }), context), /Originalzeitfolge/);
  assert.throws(() => mapKIMMessageEvidenceRow(row({
    created_at: '2026-10-14T05:59:59.999999Z',
  }), context), /Originalzeitfolge/);
});

test('read and archived messages prove neither sender, certificate, delivery nor task completion', () => {
  for (const status of ['read', 'archived']) {
    const message = mapKIMMessageEvidenceRow(row({ status }), context);
    assert.deepEqual(projectKIMMessageVerification(message), {
      messageId: id(3), tenantId, nativeMailboxId: mailboxId,
      senderAddress: row().sender, messageStatus: status,
      storedKIMMessage: 'confirmed', senderIdentity: 'not_verified', certificate: 'not_verified',
      deliveryReceipt: 'not_provided', taskCompletion: 'not_determined',
    });
  }
});

test('repository binds optional mailbox in the query and rejects a foreign delivered row as a whole result', async () => {
  const source = readFileSync(new URL('../../src/lib/ti/repositories/kimMessages.supabase.ts', import.meta.url), 'utf8');
  const executable = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, ''));
  const state = { rows: [row()], filters: [], order: null };
  class Query {
    select() { return this; }
    eq(key, value) { state.filters.push([key, value]); return this; }
    order(key, options) { state.order = [key, options]; return Promise.resolve({ data: state.rows, error: null }); }
  }
  const deps = {
    getSupabaseClient: () => ({ from: () => new Query() }),
    toGermanSupabaseError: () => 'sdk',
    SERVICE_ERRORS: { supabaseUnavailable: 'unavailable' },
    assertKIMMessageEvidenceContext: (value) => {
      mapKIMMessageEvidenceRow(row(), value.mailboxId === undefined ? { tenantId: value.tenantId } : value);
    },
    mapKIMMessageEvidenceRow,
  };
  const repository = new Function(...Object.keys(deps), `${executable}; return kimMessagesSupabaseRepository;`)(...Object.values(deps));
  const ok = await repository.list(tenantId, mailboxId);
  assert.equal(ok.ok, true, ok.error);
  assert.deepEqual(state.filters, [['tenant_id', tenantId], ['mailbox_id', mailboxId]]);
  assert.deepEqual(state.order, ['received_at', { ascending: false }]);
  state.rows = [row({ mailbox_id: id(9) })];
  const blocked = await repository.list(tenantId, mailboxId);
  assert.deepEqual(blocked, { ok: false, error: 'KIM-Nachrichtenbestand ist widersprüchlich.' });
});
