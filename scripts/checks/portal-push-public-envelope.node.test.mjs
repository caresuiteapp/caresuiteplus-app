import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  notificationFor,
  processPortalPush,
} from '../../supabase/functions/portal-push-dispatch/worker.ts';

const now = Date.parse('2026-10-14T12:00:00.000Z');
const target = {
  expo_push_token: 'ExpoPushToken[test]',
  route: '/portal/client/documents/signatures/00000000-0000-4000-8000-000000000009',
  account_id: '00000000-0000-4000-8000-000000000001',
  tenant_id: '00000000-0000-4000-8000-000000000002',
};
const work = (event_kind) => ({
  id: '00000000-0000-4000-8000-000000000003',
  lease_token: '00000000-0000-4000-8000-000000000004',
  event_kind,
  expires_at: '2026-10-14T13:00:00.000Z',
});

test('alle Ereignisarten verwenden denselben inhaltsneutralen sichtbaren Umschlag', () => {
  const visible = new Set();
  for (const kind of ['visit', 'message', 'proof', 'proof_signed', 'document', 'notice', 'update', 'unknown']) {
    const payload = notificationFor(work(kind), target, now);
    visible.add(JSON.stringify({ title: payload.title, body: payload.body }));
    assert.equal(payload.title, 'Neue CareSuite-Mitteilung');
    assert.equal(payload.body, 'Öffnen Sie CareSuite, um die Informationen in Ihrem Portal anzusehen.');
    assert.doesNotMatch(`${payload.title} ${payload.body}`, /Einsatz|Nachricht|Leistungsnachweis|Unterschrift|Dokument|Pflege/i);
  }
  assert.equal(visible.size, 1);
});

test('Empfänger- und Routendaten stehen nur in den nicht sichtbaren Navigationsdaten', () => {
  const payload = notificationFor(work('document'), target, now);
  assert.deepEqual(payload.data, {
    notificationId: work('document').id,
    route: target.route,
    accountId: target.account_id,
    tenantId: target.tenant_id,
  });
  assert.doesNotMatch(String(payload.title), /00000000|client|document/i);
  assert.doesNotMatch(String(payload.body), /00000000|client|document/i);
});

test('abgelaufene oder beim Zielabruf entzogene Zustellung verlässt den Server nicht', async () => {
  for (const targetResult of [null, target]) {
    const item = targetResult ? { ...work('message'), expires_at: '2026-10-14T11:59:59.999Z' } : work('message');
    const calls = [];
    const queue = {
      claim: async () => [item],
      target: async () => targetResult,
      finish: async (...args) => calls.push(args),
      receipts: async () => [],
      receipt: async () => {},
    };
    const transport = {
      send: async () => { throw new Error('must not send'); },
      receipts: async () => ({}),
    };
    const summary = await processPortalPush(queue, transport, now);
    assert.equal(summary.cancelled, 1);
    assert.deepEqual(calls[0], [item, 'cancelled', null, 'no_longer_accessible']);
  }
});

test('SQL prüft Gerät, Konto, Mandant, Ablauf und Ereignisrecht unmittelbar vor Übergabe erneut', async () => {
  const sql = await readFile(new URL('../../supabase/migrations/20260906160000_portal_automatic_push.sql', import.meta.url), 'utf8');
  for (const condition of [
    /d\.id=q\.device_id/,
    /d\.portal_account_id=q\.account_id/,
    /d\.auth_user_id=q\.auth_user_id/,
    /d\.tenant_id=q\.tenant_id/,
    /q\.expires_at>now\(\)/,
    /portal_push_event_visible\(d,q\.event_kind,q\.source_id\)/,
  ]) assert.match(sql, condition);
});

test('Direkt ausführbare Rechte auf Zustell- und Sichtbarkeitsfunktionen bleiben entzogen', async () => {
  const sql = await readFile(new URL('../../supabase/migrations/20260906160000_portal_automatic_push.sql', import.meta.url), 'utf8');
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
  assert.match(sql, /'portal_push_event_visible'/);
  assert.match(sql, /'portal_push_delivery_target'/);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.portal_push_(event_visible|delivery_target).*authenticated/);
});
