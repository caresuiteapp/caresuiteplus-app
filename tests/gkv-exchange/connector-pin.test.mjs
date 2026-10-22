import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testPki } from './pki-fixture.mjs';
import { assertSmcbPinVerified } from '../../services/kim/connector-certificates.mjs';
import { CARD_SERVICE, inspectConnectorXml } from '../../services/kim/connector-xml.mjs';
import { connectorFixture, faultResponse } from './connector-fixture.mjs';
import { cardsResponse, eventUrl, cardsReply } from './connector-card-fixture.mjs';
import { cardUrl, pinResponse, isPinStatus, isVerifyPin } from './connector-pin-fixture.mjs';

let pki;
before(async () => { pki = await testPki(); });
after(async () => { await pki?.close(); });
const code = expected => e => e?.code === 'KIM_CONNECTOR_' + expected;
const reply = ({ response, bytes }) => cardsReply(response, bytes.includes('<c:GetCards') ? cardsResponse()
  : isPinStatus(bytes) ? pinResponse('GetPinStatus', 'VERIFIABLE', 3) : pinResponse('VerifyPin', 'OK'));
async function fixture(run, handler = reply) {
  const f = await connectorFixture(pki, handler);
  try { await run({ ...f, open: changes => f.open({ eventServiceUrl: eventUrl(f.options), cardServiceUrl: cardUrl(f.options), ...changes }) }); }
  finally { await f.close(); }
}
const selection = async client => client.selectSmcb(await client.getCards({ cardType: 'SMC-B' }));
const status = async client => client.getSmcbPinStatus({ selection: await selection(client) });

test('SMC-B PIN: real mTLS requests use CardService, exact context/handle and terminal PIN.SMC only', async () => fixture(async ({ open, requests }) => {
  const client = open(), observed = await status(client), attempt = await client.verifySmcbPin({ status: observed });
  assert.equal(attempt.pinResult, 'OK'); assert.equal(attempt.deliveryStatus, 'held-for-trust-validation');
  assert.equal(attempt.identityStatus, 'unverified'); assert.equal(observed.leftTries, 3);
  for (const [i, operation] of [[1, 'GetPinStatus'], [2, 'VerifyPin']]) {
    const q = requests[i]; assert.equal(q.authorized, true); assert.equal(q.url, '/CardService');
    assert.equal(q.headers.soapaction, `"${CARD_SERVICE}#${operation}"`);
    assert.match(q.bytes.toString(), /<n:CardHandle>SMCB-1<\/n:CardHandle><card:PinTyp>PIN.SMC<\/card:PinTyp>/);
    assert.match(q.bytes.toString(), /<n:MandantId>tenant-1<\/n:MandantId>/);
    assert.match(q.bytes.toString(), /<n:WorkplaceId>office-1<\/n:WorkplaceId>/);
    assert.doesNotMatch(q.bytes.toString(), /<(?:[^:>]+:)?(?:Pin|Puk|OldPin|NewPin)>/);
  }
  await assert.rejects(client.verifySmcbPin({ status: observed }), code('PIN_STATUS_STALE')); assert.equal(requests.length, 3);
}));

for (const [value, tries] of [['VERIFIED', null], ['BLOCKED', 0], ['TRANSPORT_PIN', null], ['EMPTY_PIN', null]]) {
  test('SMC-B PIN: ' + value + ' cannot start a redundant or unsafe terminal attempt', async () => fixture(async ({ open, requests }) => {
    const client = open(), observed = await status(client);
    if (value === 'VERIFIED') assert.equal(assertSmcbPinVerified(observed, client, observed.selection), observed);
    else assert.throws(() => assertSmcbPinVerified(observed, client, observed.selection), code('PIN_NOT_VERIFIED'));
    await assert.rejects(client.verifySmcbPin({ status: observed }), code('PIN_NOT_VERIFIABLE'));
    assert.equal(requests.length, 2);
  }, event => isPinStatus(event.bytes) ? cardsReply(event.response, pinResponse('GetPinStatus', value, tries)) : reply(event)));
}

for (const [result, tries] of [['REJECTED', 2], ['REJECTED', 1], ['NOWBLOCKED', 0], ['WASBLOCKED', null], ['TRANSPORT_PIN', null]]) {
  test('SMC-B PIN: terminal result ' + result + '/' + tries + ' is not retried or treated as VERIFIED', async () => fixture(async ({ open, requests }) => {
    const client = open(), observed = await status(client), attempt = await client.verifySmcbPin({ status: observed });
    assert.equal(attempt.pinResult, result); assert.equal(attempt.leftTries, tries);
    assert.throws(() => assertSmcbPinVerified(attempt, client, observed.selection), code('EVIDENCE_BINDING'));
    assert.equal(requests.filter(q => isVerifyPin(q.bytes)).length, 1);
  }, event => isVerifyPin(event.bytes) ? cardsReply(event.response, pinResponse('VerifyPin', result, tries)) : reply(event)));
}

test('SMC-B PIN: copied proofs, other clients and copied selections fail before terminal action', async () => fixture(async ({ open, requests }) => {
  const a = open(), b = open(), observed = await status(a);
  await assert.rejects(a.verifySmcbPin({ status: { ...observed } }), code('EVIDENCE_BINDING'));
  await assert.rejects(b.verifySmcbPin({ status: observed }), code('EVIDENCE_BINDING'));
  await assert.rejects(a.getSmcbPinStatus({ selection: { ...observed.selection } }), code('EVIDENCE_BINDING'));
  assert.throws(() => assertSmcbPinVerified({ ...observed }, a, observed.selection), code('EVIDENCE_BINDING'));
  assert.equal(requests.length, 2);
}));

for (const action of ['expiry', 'rollback', 'refresh', 'failed-refresh', 'abort', 'close']) {
  test('SMC-B PIN: ' + action + ' invalidates a previous VERIFIED observation', async () => fixture(async ({ open }) => {
    let now = Date.now(); const client = open({ clock: () => now }), controller = new AbortController();
    const observed = await client.getSmcbPinStatus({ selection: await selection(client), signal: controller.signal });
    assertSmcbPinVerified(observed, client, observed.selection);
    if (action === 'expiry') now += 30000;
    if (action === 'rollback') now--;
    if (action === 'refresh') await client.getCards();
    if (action === 'failed-refresh') await assert.rejects(client.getCards(), code('SOAP_FAULT'));
    if (action === 'abort') controller.abort(); if (action === 'close') client.close();
    assert.throws(() => assertSmcbPinVerified(observed, client, observed.selection), code(action === 'abort' ? 'ABORTED' : action === 'close' ? 'CLOSED'
      : action.includes('refresh') ? 'CARD_SNAPSHOT_STALE' : 'EVIDENCE_EXPIRED'));
  }, event => isPinStatus(event.bytes) ? cardsReply(event.response, pinResponse()) : action === 'failed-refresh' && event.requests.length > 2
    ? cardsReply(event.response, faultResponse()) : reply(event)));
}

test('SMC-B PIN: newer failed status acquisition invalidates a previous VERIFIED observation', async () => fixture(async ({ open }) => {
  const client = open(), selected = await selection(client), first = await client.getSmcbPinStatus({ selection: selected });
  await assert.rejects(client.getSmcbPinStatus({ selection: selected }), code('SOAP_FAULT'));
  assert.throws(() => assertSmcbPinVerified(first, client, selected), code('PIN_STATUS_STALE'));
}, event => isPinStatus(event.bytes) ? cardsReply(event.response, event.requests.length === 2 ? pinResponse() : faultResponse()) : reply(event)));

test('SMC-B PIN: an older status arriving last cannot overwrite a newer observation', async () => {
  const first = Promise.withResolvers();
  await fixture(async ({ open }) => {
    const client = open(), selected = await selection(client);
    const old = client.getSmcbPinStatus({ selection: selected }).then(value => ({ value }), error => ({ error }));
    const release = await first.promise, fresh = await client.getSmcbPinStatus({ selection: selected }); release();
    assert.equal((await old).error.code, 'KIM_CONNECTOR_PIN_STATUS_STALE'); assertSmcbPinVerified(fresh, client, selected);
  }, event => {
    if (isPinStatus(event.bytes) && event.requests.length === 2) first.resolve(() => cardsReply(event.response, pinResponse()));
    else if (isPinStatus(event.bytes)) cardsReply(event.response, pinResponse()); else reply(event);
  });
});

for (const failure of ['abort', 'timeout', 'close', 'fault', 'error', 'malformed']) {
  test('SMC-B PIN: ' + failure + ' during terminal action leaves no result and blocks another attempt on this client', async () => {
    const entered = Promise.withResolvers(); let controller;
    await fixture(async ({ open, requests }) => {
      controller = new AbortController(); const client = open({ pinTimeoutMs: failure === 'timeout' ? 400 : 5000 }), observed = await status(client);
      const operation = client.verifySmcbPin({ status: observed, signal: controller.signal });
      const checked = assert.rejects(operation, code({ abort: 'ABORTED', timeout: 'TIMEOUT', close: 'CLOSED', fault: 'SOAP_FAULT', error: 'PIN_ERROR', malformed: 'XML_REJECTED' }[failure]));
      await entered.promise;
      if (failure === 'abort') controller.abort(); if (failure === 'close') client.close();
      await checked;
      await assert.rejects(client.verifySmcbPin({ status: observed }), code(failure === 'close' ? 'CLOSED' : 'PIN_OUTCOME_UNKNOWN'));
      assert.equal(requests.filter(q => isVerifyPin(q.bytes)).length, 1);
    }, event => {
      if (!isVerifyPin(event.bytes)) return reply(event);
      entered.resolve();
      if (failure === 'fault') cardsReply(event.response, faultResponse());
      if (failure === 'error') cardsReply(event.response, pinResponse('VerifyPin', 'ERROR', null, 'Warning'));
      if (failure === 'malformed') cardsReply(event.response, '<invalid');
    });
  });
}

test('SMC-B PIN: concurrent prompt/status calls cannot duplicate the terminal action', async () => {
  const entered = Promise.withResolvers();
  await fixture(async ({ open, requests }) => {
    const client = open(), observed = await status(client), attempt = client.verifySmcbPin({ status: observed });
    const release = await entered.promise;
    await assert.rejects(client.verifySmcbPin({ status: observed }), code('PIN_BUSY'));
    await assert.rejects(client.getSmcbPinStatus({ selection: observed.selection }), code('PIN_BUSY'));
    release(); assert.equal((await attempt).pinResult, 'OK'); assert.equal(requests.length, 3);
  }, event => isVerifyPin(event.bytes) ? entered.resolve(() => cardsReply(event.response, pinResponse('VerifyPin', 'OK'))) : reply(event));
});

test('SMC-B PIN: a card refresh during terminal entry invalidates its old card binding', async () => {
  const entered = Promise.withResolvers();
  await fixture(async ({ open }) => {
    const client = open(), observed = await status(client), attempt = client.verifySmcbPin({ status: observed });
    const check = assert.rejects(attempt, code('CARD_SNAPSHOT_STALE')), release = await entered.promise;
    await client.getCards(); release(); await check;
  }, event => isVerifyPin(event.bytes) ? entered.resolve(() => cardsReply(event.response, pinResponse('VerifyPin', 'OK'))) : reply(event));
});

test('SMC-B PIN: separate bounded human timeout permits a 45s logical wait without extending card proof freshness', async () => fixture(async ({ open }) => {
  const client = open({ clock: () => now, timeoutMs: 10000, pinTimeoutMs: 120000 }), observed = await status(client);
  const attempt = await client.verifySmcbPin({ status: observed }); assert.equal(attempt.checkedAt - attempt.startedAt, 45000);
  assert.throws(() => assertSmcbPinVerified(observed, client, observed.selection), code('EVIDENCE_EXPIRED'));
}, event => { if (isVerifyPin(event.bytes)) now += 45000; reply(event); }));
let now = Date.now();

test('SMC-B PIN: no missing/foreign route, PIN values, arbitrary PIN type or invalid timeout reaches the network', async () => fixture(async ({ open, options, requests }) => {
  const client = open(), selected = await selection(client);
  await assert.rejects(open({ cardServiceUrl: undefined }).getSmcbPinStatus({ selection: selected }), code('CARD_UNCONFIGURED'));
  for (const change of [{ cardServiceUrl: cardUrl(options).replace('localhost.test', 'foreign.test') }, { cardServiceUrl: cardUrl(options) + '?x=1' },
    { pinTimeoutMs: 180001 }, { pinTimeoutMs: 0 }, { pinTimeoutMs: '120000' }]) assert.throws(() => open(change), code('CONFIGURATION'));
  for (const extra of [{ pin: '123456' }, { pinTyp: 'PIN.QES' }, { puk: '12345678' }]) {
    await assert.rejects(client.getSmcbPinStatus({ selection: selected, ...extra }), code('INPUT'));
    await assert.rejects(client.verifySmcbPin({ ...extra }), code('INPUT'));
  }
  assert.equal(requests.length, 1);
}));

const xmlAttacks = [
  ['wrong namespace', x => x.replaceAll(CARD_SERVICE, CARD_SERVICE.replace('8.1', '8.2'))],
  ['foreign operation', x => x.replaceAll('GetPinStatusResponse', 'VerifyPinResponse')],
  ['missing state', x => x.replace('<c:PinStatus>VERIFIED</c:PinStatus>', '')],
  ['duplicate state', x => x.replace('</c:PinStatus>', '</c:PinStatus><c:PinStatus>VERIFIED</c:PinStatus>')],
  ['unknown state', () => pinResponse('GetPinStatus', 'DISABLED')],
  ['warning success', () => pinResponse('GetPinStatus', 'VERIFIED', null, 'Warning')],
  ['contradictory verified counter', () => pinResponse('GetPinStatus', 'VERIFIED', 1)],
  ['missing retry count', () => pinResponse('GetPinStatus', 'VERIFIABLE')],
  ['excessive retry count', () => pinResponse('GetPinStatus', 'VERIFIABLE', 4)],
  ['zero retries without blocked', () => pinResponse('GetPinStatus', 'VERIFIABLE', 0)],
  ['blocked with retries', () => pinResponse('GetPinStatus', 'BLOCKED', 1)],
  ['huge retry count', () => pinResponse('GetPinStatus', 'VERIFIABLE', '999999999999999999999')],
];
for (const [name, change] of xmlAttacks) test('SMC-B PIN XML rejects ' + name, async () => {
  await assert.rejects(inspectConnectorXml(Buffer.from(change(pinResponse())), { operation: 'GetPinStatus', mode: 'response' }), e => /^KIM_CONNECTOR_/.test(e.code));
});
for (const [result, tries] of [['REJECTED', null], ['REJECTED', 0], ['OK', 1], ['NOWBLOCKED', 2]]) {
  test('SMC-B PIN XML rejects contradictory VerifyPin ' + result + '/' + tries, async () => {
    await assert.rejects(inspectConnectorXml(Buffer.from(pinResponse('VerifyPin', result, tries)), { operation: 'VerifyPin', mode: 'response' }), code('PIN_RESULT'));
  });
}
