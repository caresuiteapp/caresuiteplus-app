import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testPki } from './pki-fixture.mjs';
import { assertSelectedSmcb } from '../../services/kim/connector-certificates.mjs';
import { inspectConnectorXml } from '../../services/kim/connector-xml.mjs';
import { connectorFixture, faultResponse } from './connector-fixture.mjs';
import { cardData, cardsResponse, eventUrl, cardsReply, EVENT } from './connector-card-fixture.mjs';

let pki;
before(async () => { pki = await testPki(); });
after(async () => { await pki?.close(); });
const code = expected => e => e?.code === 'KIM_CONNECTOR_' + expected;
async function fixture(run, handler = ({ response }) => cardsReply(response, cardsResponse())) {
  const f = await connectorFixture(pki, handler);
  try { await run({ ...f, open: changes => f.open({ eventServiceUrl: eventUrl(f.options), ...changes }) }); }
  finally { await f.close(); }
}

test('GetCards: real mTLS request binds context, service endpoint, action, filters and explicit workplace scope', async () => fixture(async ({ open, requests }) => {
  const client = open(), snapshot = await client.getCards({ ctId: 'KT<&1', slotId: 2, cardType: 'SMC-B' });
  const q = requests[0]; assert.equal(q.url, '/EventService'); assert.equal(q.authorized, true);
  assert.equal(q.headers.soapaction, `"${EVENT}#GetCards"`); assert.equal(q.bytes.includes('mandant-wide="false"'), true);
  assert.equal(q.bytes.includes('<card:CtId>KT&lt;&amp;1</card:CtId>'), true); assert.equal(q.bytes.includes('<n:MandantId>tenant-1</n:MandantId>'), true);
  const selected = client.selectSmcb(snapshot); assert.equal(selected.card.slotId, 2);
  assert.equal(assertSelectedSmcb(selected, client), selected);
  assert.deepEqual(snapshot.cards[0].cardVersion.COSVersion, [4, 5, 0]);
  assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE CARDHOLDER|K123456789/);
  assert.equal(selected.identityStatus, 'unverified');
}, ({ response }) => cardsReply(response, cardsResponse([cardData({ ctId: 'KT<&1', slotId: 2 })]))));

test('GetCards: tenant-wide scope is explicit and empty lists stay empty', async () => fixture(async ({ open, requests }) => {
  const client = open(), snapshot = await client.getCards({ mandantWide: true });
  assert.deepEqual(snapshot.cards, []); assert.equal(requests[0].bytes.includes('mandant-wide="true"'), true);
  assert.throws(() => client.selectSmcb(snapshot), code('CARD_NOT_FOUND'));
}, ({ response }) => cardsReply(response, cardsResponse([]))));

test('GetCards: non-SMC-B types remain visible but cannot be selected as institutional cards', async () => fixture(async ({ open }) => {
  const client = open(), snapshot = await client.getCards(); assert.equal(snapshot.cards[0].cardType, 'EGK');
  assert.throws(() => client.selectSmcb(snapshot), code('CARD_NOT_FOUND'));
}, ({ response }) => cardsReply(response, cardsResponse([cardData({ cardType: 'EGK', cardVersion: null, iccsn: undefined })]))));

test('GetCards: ambiguous institutional cards require an exact serial or terminal/slot choice', async () => fixture(async ({ open, requests }) => {
  const client = open(), snapshot = await client.getCards();
  assert.throws(() => client.selectSmcb(snapshot), code('CARD_AMBIGUOUS'));
  assert.equal(client.selectSmcb(snapshot, { iccsn: '80276000000000000002' }).card.cardHandle, 'SMCB-2');
  assert.equal(client.selectSmcb(snapshot, { ctId: 'KT-1', slotId: 1 }).card.cardHandle, 'SMCB-1');
  assert.throws(() => client.selectSmcb(snapshot, { iccsn: '80276000000000000003' }), code('CARD_NOT_FOUND'));
  assert.equal(requests.length, 1);
}, ({ response }) => cardsReply(response, cardsResponse([cardData(), cardData({ cardHandle: 'SMCB-2', slotId: 2, iccsn: '80276000000000000002' })]))));

for (const field of ['iccsn', 'cardVersion']) test('GetCards: missing ' + field + ' cannot establish an SMC-B selection', async () => fixture(async ({ open }) => {
  const client = open(), snapshot = await client.getCards();
  assert.throws(() => client.selectSmcb(snapshot), code('CARD_IDENTITY'));
}, ({ response }) => cardsReply(response, cardsResponse([cardData({ [field]: undefined })]))));

for (const changes of [{ cardHandle: 'SMCB-1' }, { slotId: 1 }, { iccsn: '80276000000000000001' }]) test('GetCards: duplicate ' + Object.keys(changes)[0] + ' rejects the whole list', async () => fixture(async ({ open }) => {
  await assert.rejects(open().getCards(), code('CARD_AMBIGUOUS'));
}, ({ response }) => cardsReply(response, cardsResponse([cardData(), cardData({ cardHandle: 'SMCB-2', slotId: 2, iccsn: '80276000000000000002', ...changes })]))));

for (const filter of [{ ctId: 'different' }, { ctId: 'KT-1', slotId: 2 }, { cardType: 'HBA' }]) test('GetCards: ignored server filter ' + JSON.stringify(filter) + ' rejects instead of choosing a fallback', async () => fixture(async ({ open }) => {
  await assert.rejects(open().getCards(filter), code('CARD_BINDING'));
}));

for (const input of [{ slotId: 1 }, { ctId: 'x', slotId: 0 }, { ctId: 'x', slotId: 65536 }, { ctId: 'x', slotId: 1.5 },
  { ctId: 'x\n' }, { cardType: 'AUTO' }, { mandantWide: 'true' }]) test('GetCards: invalid request ' + JSON.stringify(input) + ' fails before network', async () => fixture(async ({ open, requests }) => {
  await assert.rejects(open().getCards(input), code('INPUT')); assert.equal(requests.length, 0);
}));

test('GetCards: absent or foreign EventService configuration cannot borrow another endpoint or credentials', async () => fixture(async ({ open, options, requests }) => {
  await assert.rejects(open({ eventServiceUrl: undefined }).getCards(), code('EVENT_UNCONFIGURED'));
  for (const url of [eventUrl(options).replace('localhost.test', 'other.test'), eventUrl(options) + '?x=1', eventUrl(options).replace('https:', 'http:')]) {
    assert.throws(() => open({ eventServiceUrl: url }), code('CONFIGURATION'));
  }
  assert.equal(requests.length, 0);
}));

test('GetCards: copied lists/selections and another client cannot establish a card session', async () => fixture(async ({ open }) => {
  const a = open(), b = open(), snapshot = await a.getCards(), selected = a.selectSmcb(snapshot);
  assert.throws(() => a.selectSmcb({ ...snapshot }), code('EVIDENCE_BINDING'));
  assert.throws(() => b.selectSmcb(snapshot), code('EVIDENCE_BINDING'));
  assert.throws(() => assertSelectedSmcb({ ...selected }, a), code('EVIDENCE_BINDING'));
  assert.throws(() => assertSelectedSmcb(selected, b), code('EVIDENCE_BINDING'));
}));

for (const action of ['expired', 'rollback', 'abort', 'close']) test('GetCards: ' + action + ' invalidates existing selections', async () => fixture(async ({ open }) => {
  let now = Date.now(); const controller = new AbortController(), client = open({ clock: () => now });
  const selected = client.selectSmcb(await client.getCards({ signal: controller.signal }));
  if (action === 'expired') now += 30000; if (action === 'rollback') now--;
  if (action === 'abort') controller.abort(); if (action === 'close') client.close();
  assert.throws(() => assertSelectedSmcb(selected, client), code(action === 'abort' ? 'ABORTED' : action === 'close' ? 'CLOSED' : 'EVIDENCE_EXPIRED'));
}));

test('GetCards: a failed refresh invalidates the previous selection without retaining its handle', async () => fixture(async ({ open }) => {
  const client = open(), selected = client.selectSmcb(await client.getCards());
  await assert.rejects(client.getCards(), code('SOAP_FAULT'));
  assert.throws(() => assertSelectedSmcb(selected, client), code('CARD_SNAPSHOT_STALE'));
}, ({ response, requests }) => cardsReply(response, requests.length === 1 ? cardsResponse() : faultResponse())));

test('GetCards: an older response arriving last cannot replace a newer card snapshot', async () => {
  const first = Promise.withResolvers();
  await fixture(async ({ open }) => {
    const client = open(), old = client.getCards().then(value => ({ value }), error => ({ error }));
    const release = await first.promise;
    const current = await client.getCards(); release();
    const result = await old; assert.equal(result.value, undefined); assert.equal(result.error.code, 'KIM_CONNECTOR_CARD_SNAPSHOT_STALE');
    assertSelectedSmcb(client.selectSmcb(current), client);
  }, ({ response, requests }) => { if (requests.length === 1) first.resolve(() => cardsReply(response, cardsResponse())); else cardsReply(response, cardsResponse()); });
});

const xmlAttacks = [
  ['wrong namespace', x => x.replaceAll(EVENT, EVENT.replace('7.2', '7.0'))],
  ['foreign operation', x => x.replaceAll('GetCardsResponse', 'GetCardTerminalsResponse')],
  ['duplicate list', x => x.replace('</card:Cards>', '</card:Cards><card:Cards/>')],
  ['wrong card namespace', x => x.replace('CardService/v8.1', 'CardService/v8.2')],
  ['invalid slot', x => x.replace('<cm:SlotId>1', '<cm:SlotId>0')],
  ['unknown type', x => x.replace('<cm:CardType>SMC-B', '<cm:CardType>OTHER')],
  ['unbounded count', () => cardsResponse(Array.from({ length: 65 }, () => cardData()))],
  ['local insert time', x => x.replace('2026-10-22T00:00:00Z', '2026-10-22T00:00:00')],
  ['warning', () => cardsResponse([cardData()], 'Warning')],
];
for (const [name, change] of xmlAttacks) test('GetCards XML rejects ' + name, async () => {
  await assert.rejects(inspectConnectorXml(Buffer.from(change(cardsResponse())), { operation: 'GetCards', mode: 'response' }), e => /^KIM_CONNECTOR_/.test(e.code));
});
