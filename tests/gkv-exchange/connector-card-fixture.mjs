import { envelope, remoteError } from './connector-fixture.mjs';

export const EVENT = 'http://ws.gematik.de/conn/EventService/v7.2';
export const CARD = 'http://ws.gematik.de/conn/CardService/v8.1';
export const CM = 'http://ws.gematik.de/conn/CardServiceCommon/v2.0';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export const cardData = changes => ({ cardHandle: 'SMCB-1', cardType: 'SMC-B', ctId: 'KT-1', slotId: 1,
  iccsn: '80276000000000000001', insertTime: '2026-10-22T00:00:00Z',
  cardVersion: { COSVersion: [4, 5, 0], ObjectSystemVersion: [4, 5, 0] }, ...changes });
export function cardsResponse(entries = [cardData()], execution = 'OK') {
  const body = entries.map(c => `<card:Card><n:CardHandle>${escape(c.cardHandle)}</n:CardHandle><cm:CardType>${escape(c.cardType)}</cm:CardType>`
    + (c.cardVersion ? `<card:CardVersion>${Object.entries(c.cardVersion).map(([name, v]) => `<card:${name}><card:Major>${v[0]}</card:Major><card:Minor>${v[1]}</card:Minor><card:Revision>${v[2]}</card:Revision></card:${name}>`).join('')}</card:CardVersion>` : '')
    + (c.iccsn === undefined ? '' : `<cm:Iccsn>${escape(c.iccsn)}</cm:Iccsn>`)
    + `<cm:CtId>${escape(c.ctId)}</cm:CtId><cm:SlotId>${c.slotId}</cm:SlotId><card:InsertTime>${escape(c.insertTime)}</card:InsertTime>`
    + '<card:CardHolderName>PRIVATE CARDHOLDER</card:CardHolderName><card:Kvnr>K123456789</card:Kvnr></card:Card>').join('');
  return envelope(`<event:GetCardsResponse xmlns:event="${EVENT}" xmlns:card="${CARD}" xmlns:cm="${CM}"><n:Status><n:Result>${execution}</n:Result>${execution === 'OK' ? '' : remoteError()}</n:Status><card:Cards>${body}</card:Cards></event:GetCardsResponse>`);
}
export const eventUrl = options => options.url.replace('/CertificateService', '/EventService');
export const cardsReply = (response, xml) => { response.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' }); response.end(xml); };
