import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testPki } from './pki-fixture.mjs';
import { connectorFixture, faultResponse, remoteError } from './connector-fixture.mjs';
import { cardData, cardsResponse, eventUrl, cardsReply } from './connector-card-fixture.mjs';
import { cardUrl, pinResponse, isPinStatus, isChangePin, isUnblockPin } from './connector-pin-fixture.mjs';
import { CARD_SERVICE, certificateRequest, inspectConnectorXml } from '../../services/kim/connector-xml.mjs';
import { assertSmcbPinStatus } from '../../services/kim/connector-certificates.mjs';

let pki;
before(async () => { pki = await testPki(); });
after(async () => { await pki?.close(); });
const code = expected => e => e?.code === 'KIM_CONNECTOR_' + expected;
const count = s => s === 'VERIFIABLE' ? 3 : s === 'BLOCKED' ? 0 : null;
const operation = bytes => isChangePin(bytes) ? 'ChangePin' : isUnblockPin(bytes) ? 'UnblockPin' : undefined;
const call = (client, action, status, signal) => action === 'unblock' ? client.unblockSmcbPin({ status, setNewPin: false, signal })
  : client.changeSmcbPin({ status, mode: action, signal });
async function fixture(run, { pinStatus = 'VERIFIABLE', handler, result = 'OK', leftTries = null } = {}) {
  const normal = event => {
    if (event.bytes.includes('<c:GetCards')) return cardsReply(event.response, cardsResponse());
    if (isPinStatus(event.bytes)) return cardsReply(event.response, pinResponse('GetPinStatus', pinStatus, count(pinStatus)));
    const op = operation(event.bytes); assert.ok(op, 'only an expected PIN mutation may reach this fixture');
    cardsReply(event.response, pinResponse(op, result, leftTries, result === 'ERROR' ? 'Warning' : 'OK'));
  };
  const f = await connectorFixture(pki, event => handler ? handler(event, normal) : normal(event));
  try { await run({ ...f, open: changes => f.open({ eventServiceUrl: eventUrl(f.options), cardServiceUrl: cardUrl(f.options), ...changes }) }); }
  finally { await f.close(); }
}
const observe = async client => client.getSmcbPinStatus({ selection: client.selectSmcb(await client.getCards({ cardType: 'SMC-B' })) });

for (const [mode, pinStatus] of [['initialize', 'TRANSPORT_PIN'], ['initialize', 'EMPTY_PIN'], ['change', 'VERIFIABLE'], ['change', 'VERIFIED']]) {
  test('PIN management: ' + mode + ' from ' + pinStatus + ' uses terminal-only ChangePin over mTLS', async () => fixture(async ({ open, requests }) => {
    const client = open(), status = await observe(client), r = await client.changeSmcbPin({ status, mode });
    assert.equal(r.operation, 'ChangePin'); assert.equal(r.mode, mode); assert.equal(r.pinResult, 'OK'); assert.equal(r.retryCounter, 'pin');
    const q = requests[2]; assert.equal(q.url, '/CardService'); assert.equal(q.authorized, true);
    assert.equal(q.headers.soapaction, `"${CARD_SERVICE}#ChangePin"`);
    assert.match(q.bytes.toString(), /<n:MandantId>tenant-1<\/n:MandantId>/);
    assert.match(q.bytes.toString(), /<n:CardHandle>SMCB-1<\/n:CardHandle><card:PinTyp>PIN.SMC<\/card:PinTyp>/);
    assert.doesNotMatch(q.bytes.toString(), /<(?:[^:>]+:)?(?:Pin|Puk|OldPin|NewPin|SetNewPin)>/);
    await assert.rejects(client.changeSmcbPin({ status, mode }), code('PIN_STATUS_STALE'));
    assert.equal(requests.length, 3); assert.equal(r.identityStatus, 'unverified'); assert.equal(r.deliveryStatus, 'held-for-trust-validation');
  }, { pinStatus }));
}

for (const setNewPin of [false, true]) test('PIN management: UnblockPin explicitly sends SetNewPin=' + setNewPin + ' without a PUK or PIN value', async () => fixture(async ({ open, requests }) => {
  const client = open(), status = await observe(client), r = await client.unblockSmcbPin({ status, setNewPin });
  const q = requests[2]; assert.equal(q.authorized, true); assert.equal(q.url, '/CardService');
  assert.equal(q.headers.soapaction, `"${CARD_SERVICE}#UnblockPin"`); assert.equal(q.bytes.includes(`<c:SetNewPin>${setNewPin}</c:SetNewPin>`), true);
  assert.match(q.bytes.toString(), /<card:PinTyp>PIN.SMC<\/card:PinTyp>/); assert.equal(r.setNewPin, setNewPin);
  assert.doesNotMatch(q.bytes.toString(), /<(?:[^:>]+:)?(?:Pin|Puk|OldPin|NewPin)>/); assert.equal(r.retryCounter, 'puk');
  await assert.rejects(client.unblockSmcbPin({ status, setNewPin }), code('PIN_STATUS_STALE')); assert.equal(requests.length, 3);
}, { pinStatus: 'BLOCKED' }));

const states = ['TRANSPORT_PIN', 'EMPTY_PIN', 'VERIFIABLE', 'VERIFIED', 'BLOCKED'];
for (const action of ['initialize', 'change', 'unblock']) for (const pinStatus of states) {
  if ((action === 'initialize' ? states.slice(0, 2) : action === 'change' ? states.slice(2, 4) : ['BLOCKED']).includes(pinStatus)) continue;
  test('PIN management: ' + action + ' cannot use state ' + pinStatus, async () => fixture(async ({ open, requests }) => {
    const client = open(), status = await observe(client);
    await assert.rejects(call(client, action, status), code('PIN_MAINTENANCE_STATE')); assert.equal(requests.length, 2);
  }, { pinStatus }));
}

for (const [action, tries] of [['change', 2], ['change', 1], ['unblock', 9], ['unblock', 1]]) {
  test('PIN management: rejected ' + action + ' reports its own counter ' + tries + ' without retry', async () => fixture(async ({ open, requests }) => {
    const client = open(), status = await observe(client), r = await call(client, action, status);
    assert.equal(r.pinResult, 'REJECTED'); assert.equal(r.leftTries, tries); assert.equal(r.retryCounter, action === 'unblock' ? 'puk' : 'pin');
    assert.equal(requests.length, 3);
  }, { pinStatus: action === 'unblock' ? 'BLOCKED' : 'VERIFIABLE', result: 'REJECTED', leftTries: tries }));
}

for (const result of ['WASBLOCKED', 'NOWBLOCKED']) test('PIN management: ' + result + ' PUK cannot be retried after refreshing the same ICCSN', async () => fixture(async ({ open, requests }) => {
  const client = open(), r = await call(client, 'unblock', await observe(client));
  assert.equal(r.pinResult, result); const refreshed = await observe(client);
  await assert.rejects(call(client, 'unblock', refreshed), code('PIN_PUK_BLOCKED'));
  assert.equal(requests.filter(q => isUnblockPin(q.bytes)).length, 1);
}, { pinStatus: 'BLOCKED', result, leftTries: 0 }));

test('PIN management: known blocked PUK belongs to its ICCSN and is not silently transferred to another card', async () => fixture(async ({ open, requests }) => {
  const client = open(); await call(client, 'unblock', await observe(client));
  const other = await observe(client); assert.equal(other.selection.card.iccsn, '80276000000000000002');
  assert.equal((await call(client, 'unblock', other)).pinResult, 'OK'); assert.equal(requests.filter(q => isUnblockPin(q.bytes)).length, 2);
}, { pinStatus: 'BLOCKED', handler: (event, normal) => {
  if (event.bytes.includes('<c:GetCards') && event.requests.length > 3) return cardsReply(event.response, cardsResponse([cardData({ iccsn: '80276000000000000002', cardHandle: 'SMCB-2' })]));
  if (isUnblockPin(event.bytes) && event.requests.length === 3) return cardsReply(event.response, pinResponse('UnblockPin', 'WASBLOCKED', 0));
  normal(event);
} }));

for (const action of ['change', 'unblock']) test('PIN management: copied and foreign ' + action + ' status cannot start a terminal action', async () => fixture(async ({ open, requests }) => {
  const client = open(), status = await observe(client);
  await assert.rejects(call(client, action, { ...status }), code('EVIDENCE_BINDING'));
  await assert.rejects(call(open(), action, status), code('EVIDENCE_BINDING'));
  await client.getCards(); await assert.rejects(call(client, action, status), code('CARD_SNAPSHOT_STALE'));
  assert.equal(requests.length, 3);
}, { pinStatus: action === 'unblock' ? 'BLOCKED' : 'VERIFIABLE' }));

for (const action of ['change', 'unblock']) for (const failure of ['abort', 'timeout', 'fault', 'error', 'close']) {
  test('PIN management: ' + failure + ' during ' + action + ' leaves an uncertain outcome and cannot repeat', async () => {
    const entered = Promise.withResolvers();
    await fixture(async ({ open, requests }) => {
      const client = open({ pinTimeoutMs: failure === 'timeout' ? 1200 : 5000 }), controller = new AbortController(), status = await observe(client);
      const attempt = call(client, action, status, controller.signal);
      const check = assert.rejects(attempt, e => {
        assert.equal(code({ abort: 'ABORTED', timeout: 'TIMEOUT', fault: 'SOAP_FAULT', error: 'PIN_ERROR', close: 'CLOSED' }[failure])(e), true);
        assert.doesNotMatch(JSON.stringify(e) + e.message, /PRIVATE|SECRET/); return true;
      });
      await entered.promise; if (failure === 'abort') controller.abort(); if (failure === 'close') client.close(); await check;
      await assert.rejects(call(client, action, status), code(failure === 'close' ? 'CLOSED' : 'PIN_OUTCOME_UNKNOWN'));
      assert.equal(requests.filter(q => operation(q.bytes)).length, 1);
    }, { pinStatus: action === 'unblock' ? 'BLOCKED' : 'VERIFIABLE', handler: (event, normal) => {
      if (!operation(event.bytes)) return normal(event); entered.resolve();
      if (failure === 'fault') cardsReply(event.response, faultResponse());
      if (failure === 'error') cardsReply(event.response, pinResponse(operation(event.bytes), 'ERROR', null, 'Warning'));
    } });
  });
}

for (const action of ['change', 'unblock']) test('PIN management: running ' + action + ' excludes other mutation types and status reads', async () => {
  const entered = Promise.withResolvers();
  await fixture(async ({ open, requests }) => {
    const client = open(), status = await observe(client), attempt = call(client, action, status), release = await entered.promise;
    await assert.rejects(call(client, 'change', status), code('PIN_BUSY'));
    await assert.rejects(call(client, 'unblock', status), code('PIN_BUSY'));
    await assert.rejects(client.verifySmcbPin({ status }), code('PIN_BUSY'));
    await assert.rejects(client.getSmcbPinStatus({ selection: status.selection }), code('PIN_BUSY'));
    release(); assert.equal((await attempt).pinResult, 'OK'); assert.equal(requests.length, 3);
  }, { pinStatus: action === 'unblock' ? 'BLOCKED' : 'VERIFIABLE', handler: (event, normal) => operation(event.bytes) ? entered.resolve(() => normal(event)) : normal(event) });
});

for (const action of ['change', 'unblock']) test('PIN management: card refresh during ' + action + ' reports prior terminal OK without claiming an unchanged PIN', async () => {
  const entered = Promise.withResolvers();
  await fixture(async ({ open }) => {
    const client = open(), status = await observe(client), attempt = call(client, action, status);
    const checked = assert.rejects(attempt, e => code('PIN_MAINTENANCE_UNCONFIRMED')(e) && e.reportedPinResult === 'OK'
      && e.causeCode === 'KIM_CONNECTOR_CARD_SNAPSHOT_STALE' && e.operation === (action === 'unblock' ? 'UnblockPin' : 'ChangePin'));
    const release = await entered.promise; await client.getCards(); release(); await checked;
  }, { pinStatus: action === 'unblock' ? 'BLOCKED' : 'VERIFIABLE', handler: (event, normal) => operation(event.bytes) ? entered.resolve(() => normal(event)) : normal(event) });
});

test('PIN management: unknown modes, implicit reset flags, PINs and PUKs fail before network', async () => fixture(async ({ open, requests }) => {
  const client = open();
  for (const extra of [{}, { mode: 'reset' }, { mode: ['change'] }, { mode: 'change', pin: '123456' },
    { mode: 'change', oldPin: '123456' }, { mode: 'change', newPin: '987654' }, { mode: 'change', setNewPin: true }]) {
    await assert.rejects(client.changeSmcbPin(extra), code('INPUT'));
  }
  for (const extra of [{}, { setNewPin: 'true' }, { setNewPin: null }, { setNewPin: false, puk: '12345678' }, { setNewPin: true, pinTyp: 'PIN.QES' }]) {
    await assert.rejects(client.unblockSmcbPin(extra), code('INPUT'));
  }
  assert.equal(requests.length, 0);
}));

test('PIN management: ChangePin invalidates a prior observed VERIFIED status immediately', async () => {
  const entered = Promise.withResolvers();
  await fixture(async ({ open }) => {
    const client = open(), status = await observe(client), pending = call(client, 'change', status), release = await entered.promise;
    assert.throws(() => assertSmcbPinStatus(status, client, status.selection), code('PIN_BUSY'));
    release(); await pending; assert.throws(() => assertSmcbPinStatus(status, client, status.selection), code('PIN_STATUS_STALE'));
  }, { pinStatus: 'VERIFIED', handler: (event, normal) => operation(event.bytes) ? entered.resolve(() => normal(event)) : normal(event) });
});

const context = { mandantId: 'tenant', clientSystemId: 'CareSuite', workplaceId: 'office' };
for (const pinStatus of ['TRANSPORT_PIN', 'EMPTY_PIN']) test('PIN management: ' + pinStatus + ' with zero remaining attempts cannot start initialization', async () => fixture(async ({ open, requests }) => {
  await assert.rejects(observe(open()), code('PIN_RESULT'));
  assert.equal(requests.some(q => isChangePin(q.bytes)), false);
}, { handler: (event, normal) => isPinStatus(event.bytes)
  ? cardsReply(event.response, pinResponse('GetPinStatus', pinStatus, 0)) : normal(event) }));

for (const [name, mutate] of [
  ['missing reset flag', x => x.replace('<c:SetNewPin>false</c:SetNewPin>', '')],
  ['numeric flag outside profile', x => x.replace('<c:SetNewPin>false', '<c:SetNewPin>0')],
  ['foreign flag namespace', x => x.replaceAll('c:SetNewPin', 'card:SetNewPin')],
  ['duplicate flag', x => x.replace('</c:SetNewPin>', '</c:SetNewPin><c:SetNewPin>true</c:SetNewPin>')],
  ['foreign PIN type', x => x.replace('PIN.SMC', 'PIN.CH')],
  ['PUK value', x => x.replace('</c:UnblockPin>', '<c:Puk>12345678</c:Puk></c:UnblockPin>')],
]) test('PIN management XML rejects UnblockPin ' + name, async () => {
  const request = certificateRequest('UnblockPin', context, { cardHandle: 'SMCB-1', setNewPin: false });
  await assert.rejects(inspectConnectorXml(Buffer.from(mutate(request.toString())), { operation: 'UnblockPin', mode: 'request' }), e => /^KIM_CONNECTOR_/.test(e.code));
});

for (const [op, value, tries] of [['ChangePin', 'TRANSPORT_PIN', null], ['UnblockPin', 'TRANSPORT_PIN', null],
  ['ChangePin', 'REJECTED', 9], ['UnblockPin', 'REJECTED', 11], ['UnblockPin', 'REJECTED', 0], ['UnblockPin', 'REJECTED', null],
  ['UnblockPin', 'NOWBLOCKED', 1], ['ChangePin', 'WASBLOCKED', 1], ['UnblockPin', 'OK', 3]]) {
  test('PIN management XML rejects ' + op + ' ' + value + '/' + tries, async () => {
    await assert.rejects(inspectConnectorXml(Buffer.from(pinResponse(op, value, tries)), { operation: op, mode: 'response' }), code('PIN_RESULT'));
  });
}
for (const op of ['ChangePin', 'UnblockPin']) test('PIN management XML rejects ' + op + ' ERROR without a structured reason', async () => {
  await assert.rejects(inspectConnectorXml(Buffer.from(pinResponse(op, 'ERROR', null, 'Warning').replace(remoteError(4064), '')),
    { operation: op, mode: 'response' }), code('PIN_RESULT'));
});
