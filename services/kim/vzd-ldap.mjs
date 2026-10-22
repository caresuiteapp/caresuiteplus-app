import { tlv, sequence, octets } from './cms-codec.mjs';
import { kimAddress } from './address.mjs';
import { validTelematikId } from './certificate-admission.mjs';

export class VzdError extends Error {
  constructor(code) { super(code); this.name = 'VzdError'; this.code = code; }
}
export const vzdFail = suffix => { throw new VzdError('KIM_VZD_' + suffix); };
export const MAX_VZD_RESPONSE = 2_097_152;
const integer = (n, tag = 2) => tlv(tag, Buffer.from([n]));
const string = s => octets(Buffer.from(s, 'utf8'));
const message = (id, tag, ...nodes) => sequence(integer(id), tlv(tag, Buffer.concat(nodes)));
export const vzdBindRequest = () => message(1, 0x60, integer(3), string(''), tlv(0x80, Buffer.alloc(0)));
export function vzdSearchRequest(address, seconds) {
  address = kimAddress(address);
  // ASN.1 assertions, never interpolated LDAP filter text. A literal '*' in a
  // mailbox remains literal; kimData's initial component includes the comma.
  const filter = tlv(0xa1, Buffer.concat([
    tlv(0xa3, Buffer.concat([string('mail'), string(address)])),
    tlv(0xa4, Buffer.concat([string('kimData'), sequence(tlv(0x80, Buffer.from(address + ',')))])),
  ]));
  return message(2, 0x63, string('dc=data,dc=vzd'), integer(2, 10), integer(0, 10),
    integer(2), integer(seconds), tlv(1, Buffer.from([0])), filter,
    sequence(...['telematikID', 'mail', 'kimData', 'komLeData', 'userCertificate;binary'].map(string)));
}

// LDAP uses BER, not DER. Definite long lengths may be non-minimal (RFC 4511
// section 5.1); indefinite lengths, high tags and constructed strings are not
// part of this bounded LDAP subset. Do not weaken the certificate DER parser.
function header(bytes, offset, limit) {
  if (limit - offset < 2) return;
  let at = offset, tag = bytes[at++], size = bytes[at++];
  if ((tag & 31) === 31) vzdFail('LDAP_FORMAT');
  if (size & 128) {
    const count = size & 127;
    if (!count || count > 4) vzdFail('LDAP_FORMAT');
    if (limit - at < count) return;
    size = 0;
    for (let i = 0; i < count; i++) size = size * 256 + bytes[at++];
  }
  if (size > MAX_VZD_RESPONSE || at - offset + size > MAX_VZD_RESPONSE) vzdFail('RESPONSE_SIZE');
  return { tag, start: at, end: at + size };
}
export function vzdFrameSize(bytes) {
  if (bytes.length && bytes[0] !== 48) vzdFail('LDAP_FORMAT');
  const h = header(bytes, 0, bytes.length);
  return h && h.end <= bytes.length ? h.end : undefined;
}
function node(bytes, offset, limit) {
  const h = header(bytes, offset, limit);
  if (!h || h.end > limit) vzdFail('LDAP_FORMAT');
  return { tag: h.tag, value: bytes.subarray(h.start, h.end), end: h.end, children() {
    const values = []; let at = h.start;
    while (at < h.end) {
      if (values.length >= 1001) vzdFail('LDAP_FORMAT');
      const child = node(bytes, at, h.end); values.push(child); at = child.end;
    }
    return values;
  } };
}
function fields(n, tag, count) {
  if (n?.tag !== tag) vzdFail('LDAP_FORMAT');
  const f = n.children();
  if (count !== undefined && f.length !== count) vzdFail('LDAP_FORMAT');
  return f;
}
function number(n, tag = 2) {
  if (n?.tag !== tag || !n.value.length || n.value.length > 4 || n.value[0] & 128
    || (n.value.length > 1 && n.value[0] === 0 && !(n.value[1] & 128))) vzdFail('LDAP_FORMAT');
  let value = 0; for (const b of n.value) value = value * 256 + b; return value;
}
function text(n, max = 2048, empty = false) {
  if (n?.tag !== 4 || n.value.length > max || (!empty && !n.value.length)) vzdFail('LDAP_FORMAT');
  let value;
  try { value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(n.value); }
  catch { vzdFail('LDAP_FORMAT'); }
  if (/[\p{Cc}\p{Cf}]/u.test(value)) vzdFail('LDAP_FORMAT');
  return value;
}
export function readVzdResponse(bytes, expectedId) {
  try {
    const root = node(bytes, 0, bytes.length), f = fields(root, 48, 2);
    if (root.end !== bytes.length || number(f[0]) !== expectedId) vzdFail('LDAP_MESSAGE');
    const operation = f[1];
    if (operation.tag === 0x73) vzdFail('LDAP_REFERRAL'); // Never follow search references.
    if ([0x61, 0x65].includes(operation.tag)) {
      const r = fields(operation, operation.tag);
      if (r.length !== 3 || r[1]?.tag !== 4 || r[2]?.tag !== 4) vzdFail('LDAP_FORMAT');
      // Do not reflect or log a server-supplied diagnosticMessage or matchedDN.
      if (number(r[0], 10) !== 0) vzdFail('LDAP_RESULT');
      return { kind: operation.tag === 0x61 ? 'bound' : 'done' };
    }
    if (operation.tag !== 0x64) vzdFail('LDAP_MESSAGE');
    const e = fields(operation, 0x64, 2); text(e[0]);
    const attrs = fields(e[1], 48), attributes = new Map();
    if (attrs.length > 5) vzdFail('ENTRY_FORMAT');
    for (const a of attrs) {
      const [type, values] = fields(a, 48, 2), rawName = text(type, 64).toLowerCase();
      const name = rawName === 'usercertificate;binary' ? 'usercertificate' : rawName;
      if (!['telematikid', 'mail', 'kimdata', 'komledata', 'usercertificate'].includes(name) || attributes.has(name)) vzdFail('ENTRY_FORMAT');
      const list = fields(values, 49), max = name === 'usercertificate' ? 50 : name === 'telematikid' ? 1 : 1000;
      if (!list.length || list.length > max || list.some(v => v.tag !== 4 || !v.value.length || v.value.length > (name === 'usercertificate' ? 12_000 : 2048))) vzdFail('ENTRY_FORMAT');
      attributes.set(name, list);
    }
    return { kind: 'entry', attributes };
  } catch (e) { if (e instanceof VzdError) throw e; vzdFail('LDAP_FORMAT'); }
}
function metadata(values, modern) {
  const result = new Map();
  for (const v of values ?? []) {
    const parts = text(v).split(',');
    if ((modern ? ![2, 3].includes(parts.length) : parts.length !== 2)) vzdFail('ENTRY_FORMAT');
    const address = kimAddress(parts[modern ? 0 : 1]), version = parts[modern ? 1 : 0];
    if (!/^1\.(?:0|5)\+?$/.test(version) || result.has(address)) vzdFail('ENTRY_FORMAT');
    const appTags = parts.length === 3 ? parts[2].split('|') : undefined;
    if (appTags && (!appTags.length || appTags.length > 100 || new Set(appTags).size !== appTags.length
      || appTags.some(t => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(t)))) vzdFail('ENTRY_FORMAT');
    result.set(address, { version, appTags: appTags && Object.freeze(appTags) });
  }
  return result;
}
export function readVzdEntry(attributes, address) {
  try {
    const tids = attributes.get('telematikid');
    if (tids?.length !== 1) vzdFail('ENTRY_IDENTITY');
    const telematikId = text(tids[0], 128);
    if (!validTelematikId(telematikId)) vzdFail('ENTRY_IDENTITY');
    const mails = (attributes.get('mail') ?? []).map(v => kimAddress(text(v, 254)));
    if (new Set(mails).size !== mails.length) vzdFail('ENTRY_FORMAT');
    const modern = metadata(attributes.get('kimdata'), true), legacy = metadata(attributes.get('komledata'), false);
    for (const [a, m] of modern) {
      const old = legacy.get(a);
      if (old && old.version.replace(/\+$/, '') !== m.version.replace(/\+$/, '')) vzdFail('ENTRY_CONFLICT');
    }
    // komLeData alone cannot establish ownership. kimData also covers addresses
    // hidden from mail. providedBy/domainID/Subject/SAN are never used as aliases.
    if (!mails.includes(address) && !modern.has(address)) vzdFail('ADDRESS_MISMATCH');
    const data = modern.get(address) ?? legacy.get(address) ?? { version: '1.0' };
    const certificates = (attributes.get('usercertificate') ?? []).map(v => Buffer.from(v.value));
    if (!certificates.length || new Set(certificates.map(c => c.toString('base64'))).size !== certificates.length) vzdFail('CERTIFICATES');
    return Object.freeze({ address, telematikId, version: data.version, appTags: data.appTags,
      certificates: Object.freeze(certificates) });
  } catch (e) { if (e instanceof VzdError) throw e; vzdFail('ENTRY_FORMAT'); }
}
