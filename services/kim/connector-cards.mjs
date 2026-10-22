import { createHash } from 'node:crypto';
import { connectorText } from './connector-xml.mjs';
import { connectorFail } from './connector-error.mjs';

const types = ['EGK', 'HBA-qSig', 'HBA', 'SMC-B', 'HSM-B', 'SMC-KT', 'KVK', 'ZOD_2.0', 'UNKNOWN', 'HBAx', 'SM-B'];
export function cardFilters({ ctId, slotId, cardType, mandantWide = false } = {}) {
  if (typeof mandantWide !== 'boolean' || (cardType !== undefined && !types.includes(cardType))
    || (slotId !== undefined && (!Number.isInteger(slotId) || slotId < 1 || slotId > 65535 || ctId === undefined))) connectorFail('INPUT');
  return Object.freeze({ mandantWide, ...(ctId === undefined ? {} : { ctId: connectorText(ctId) }),
    ...(slotId === undefined ? {} : { slotId }), ...(cardType === undefined ? {} : { cardType }) });
}
export function cardSelector({ iccsn, ctId, slotId } = {}) {
  const { mandantWide: _unused, ...filters } = cardFilters({ ctId, slotId });
  if (iccsn !== undefined && (typeof iccsn !== 'string' || !/^[0-9]{20}$/.test(iccsn))) connectorFail('INPUT');
  return Object.freeze({ ...filters, ...(iccsn === undefined ? {} : { iccsn }) });
}
export function checkedCards(entries, filters) {
  const handles = new Set(), slots = new Set(), serials = new Set();
  return Object.freeze(entries.map(entry => {
    let cardHandle, ctId;
    try { cardHandle = connectorText(entry.cardHandle, 128); ctId = connectorText(entry.ctId); }
    catch { connectorFail('CARD_FORMAT'); }
    if (!types.includes(entry.cardType) || !Number.isInteger(entry.slotId) || entry.slotId < 1 || entry.slotId > 65535
      || !Number.isFinite(Date.parse(entry.insertTime)) || (entry.iccsn !== undefined && !/^[0-9]{20}$/.test(entry.iccsn))) connectorFail('CARD_FORMAT');
    const slot = JSON.stringify([ctId, entry.slotId]);
    if (handles.has(cardHandle) || slots.has(slot) || (entry.iccsn !== undefined && serials.has(entry.iccsn))) connectorFail('CARD_AMBIGUOUS');
    handles.add(cardHandle); slots.add(slot); if (entry.iccsn !== undefined) serials.add(entry.iccsn);
    if (['ctId', 'slotId', 'cardType'].some(k => filters[k] !== undefined && entry[k] !== filters[k])) connectorFail('CARD_BINDING');
    return Object.freeze({ cardHandle, cardType: entry.cardType, ctId, slotId: entry.slotId,
      // Keep every timestamp digit for the later card-session comparison.
      ...(entry.iccsn === undefined ? {} : { iccsn: entry.iccsn }), insertTime: entry.insertTime,
      cardVersion: Object.freeze(Object.fromEntries(Object.entries(entry.cardVersion).map(([name, value]) => [name, Object.freeze(value)]))) });
  }));
}
export function selectSmcbCard(cards, selector) {
  const found = cards.filter(c => c.cardType === 'SMC-B' && Object.entries(selector).every(([k, v]) => c[k] === v));
  if (!found.length) connectorFail('CARD_NOT_FOUND');
  if (found.length !== 1) connectorFail('CARD_AMBIGUOUS');
  if (!found[0].iccsn || !found[0].cardVersion.COSVersion || !found[0].cardVersion.ObjectSystemVersion) connectorFail('CARD_IDENTITY');
  return found[0];
}
export const cardFingerprint = card => createHash('sha256').update(JSON.stringify(card)).digest('hex');
