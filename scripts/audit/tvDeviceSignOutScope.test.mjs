import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const TV_ID = '12345678-1234-4234-8234-123456789abc';
const PHONE_ID = '87654321-4321-4321-8321-cba987654321';
const token = (sessionId, extra = {}) => `header.${Buffer.from(JSON.stringify({ session_id: sessionId, ...extra })).toString('base64url')}.signature`;
let moduleId = 0;
const freshWeb = () => import(`../../src/lib/supabase/authSignOutScope.web.ts?test=${++moduleId}`);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
function storageWindow(initial = new Map()) {
  const storage = {
    getItem: key => initial.get(key) ?? null,
    setItem: (key, value) => initial.set(key, value),
    removeItem: key => initial.delete(key),
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  return { storage, values: initial };
}
const clientWith = accessToken => ({ auth: { getSession: async () => ({ data: { session: accessToken ? { access_token: accessToken } : null }, error: null }) } });
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete globalThis.window;
});

test('normal Web logout retains global default without reading the SDK session', async () => {
  storageWindow();
  const scope = await freshWeb();
  assert.equal(await scope.getAuthSignOutOptions({ auth: { getSession: () => { throw new Error('Must not be called'); } } }), undefined);
});

test('only the granted TV session logs out locally; storage contains no tokens', async () => {
  const { values } = storageWindow();
  const scope = await freshWeb();
  const granted = token(TV_ID);
  assert.equal(scope.markTvDeviceSession(granted), true);
  assert.deepEqual([...values.values()], [TV_ID]);
  assert.deepEqual(await scope.getAuthSignOutOptions(clientWith(granted)), { scope: 'local' });
  assert.equal(scope.isTvDeviceSession(token(PHONE_ID)), false);
  assert.equal(await scope.getAuthSignOutOptions(clientWith(token(PHONE_ID))), undefined);
  assert.equal(await scope.getAuthSignOutOptions(clientWith(null)), undefined);
});

test('token refresh and document reload retain the same TV session scope', async () => {
  storageWindow();
  const scope = await freshWeb();
  scope.markTvDeviceSession(token(TV_ID, { exp: 1 }));
  assert.deepEqual(await scope.getAuthSignOutOptions(clientWith(token(TV_ID, { exp: 2 }))), { scope: 'local' });
  const reloaded = await freshWeb();
  assert.deepEqual(await reloaded.getAuthSignOutOptions(clientWith(token(TV_ID, { exp: 3 }))), { scope: 'local' });
});

test('blocked storage uses current document memory even when an old stored value remains', async () => {
  const { storage } = storageWindow();
  const scope = await freshWeb();
  scope.markTvDeviceSession(token(PHONE_ID));
  storage.setItem = () => { throw new Error('Storage blocked'); };
  scope.markTvDeviceSession(token(TV_ID));
  assert.deepEqual(await scope.getAuthSignOutOptions(clientWith(token(TV_ID))), { scope: 'local' });
  storage.removeItem = () => { throw new Error('Storage blocked'); };
  scope.clearTvDeviceSession();
  assert.equal(scope.isTvDeviceSession(token(TV_ID)), false);
  assert.equal(scope.isTvDeviceSession(token(PHONE_ID)), false);
});

test('malformed or unrelated tokens never mark a TV session', async () => {
  const { values } = storageWindow();
  const scope = await freshWeb();
  for (const invalid of ['', 'not-a-token', 'a.!.b', token(undefined), token('true'), token(123)]) {
    assert.equal(scope.markTvDeviceSession(invalid), false);
    assert.equal(scope.isTvDeviceSession(invalid), false);
  }
  assert.equal(values.size, 0);
});

test('a failed session lookup is reported rather than widening TV logout to global', async () => {
  storageWindow();
  const scope = await freshWeb();
  scope.markTvDeviceSession(token(TV_ID));
  await assert.rejects(scope.getAuthSignOutOptions({ auth: { getSession: async () => ({ data: { session: null }, error: new Error('Lookup failed') }) } }), /Lookup failed/);
  assert.equal(scope.isTvDeviceSession(token(TV_ID)), true);
});

test('clearing a marker in another tab is respected by this document', async () => {
  storageWindow();
  const first = await freshWeb();
  const second = await freshWeb();
  first.markTvDeviceSession(token(TV_ID));
  assert.equal(second.isTvDeviceSession(token(TV_ID)), true);
  second.clearTvDeviceSession();
  assert.equal(first.isTvDeviceSession(token(TV_ID)), false);
});

test('native implementation keeps its previous global logout and ignores TV markers', async () => {
  const scope = await import('../../src/lib/supabase/authSignOutScope.ts');
  assert.equal(scope.markTvDeviceSession(token(TV_ID)), false);
  assert.equal(scope.isTvDeviceSession(token(TV_ID)), false);
  assert.equal(await scope.getAuthSignOutOptions({ auth: { getSession: () => { throw new Error('Must not be called'); } } }), undefined);
  scope.clearTvDeviceSession();
});
