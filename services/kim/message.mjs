import { kimAddress, messageId } from './address.mjs';
import { inspectKimEnvelope } from './envelope.mjs';

export const MAX_KIM_MESSAGE = 22_020_096;
export function readMessage(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_KIM_MESSAGE) throw new Error('KIM_MESSAGE_FORMAT');
  const buffer = Buffer.from(bytes), end = buffer.indexOf('\r\n\r\n');
  if (end < 0 || end > 65_536) throw new Error('KIM_MESSAGE_FORMAT');
  const head = buffer.subarray(0, end).toString('latin1');
  if (/[^\x09\x0a\x0d\x20-\x7e]|(?<!\r)\n|\r(?!\n)/.test(head)) throw new Error('KIM_MESSAGE_FORMAT');
  const headers = new Map(); let name, count = 0;
  for (const line of head.split('\r\n')) {
    if (line.length > 998 || ++count > 500) throw new Error('KIM_MESSAGE_FORMAT');
    if (/^[ \t]/.test(line)) {
      if (!name) throw new Error('KIM_MESSAGE_FORMAT');
      const values = headers.get(name); values[values.length - 1] += ' ' + line.trim();
    } else {
      const m = /^([A-Za-z0-9-]+):[ \t]*(.*)$/.exec(line); if (!m) throw new Error('KIM_MESSAGE_FORMAT');
      name = m[1].toLowerCase(); headers.set(name, [...(headers.get(name) ?? []), m[2].trim()]);
    }
  }
  const one = (name, required = false) => {
    const values = headers.get(name) ?? [];
    if (values.length > 1 || (required && values.length !== 1)) throw new Error('KIM_MESSAGE_FORMAT');
    return values[0];
  };
  return { one, body: buffer.subarray(end + 4) };
}
function addressList(value) {
  if (typeof value !== 'string' || !value) throw new Error('KIM_ORIGINATOR');
  const list = []; let start = 0, quoted = false, escaped = false;
  for (let i = 0; i <= value.length; i++) {
    const c = value[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && quoted) { escaped = true; continue; }
    if (c === '"') quoted = !quoted;
    if ((!quoted && c === ',') || i === value.length) {
      const part = value.slice(start, i).trim(), bracket = /^(?:"(?:[^"\\]|\\.)*"|[^<>"(),;:]*)\s*<([^<>]+)>$/.exec(part);
      list.push(kimAddress(bracket ? bracket[1] : part)); start = i + 1;
    }
  }
  if (quoted || escaped || list.length > 100) throw new Error('KIM_ORIGINATOR'); return list;
}
export function parseContentType(value) {
  if (typeof value !== 'string') throw new Error('KIM_CONTENT_TYPE');
  const m = /^([A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+)((?:\s*;\s*[A-Za-z0-9-]+\s*=\s*(?:"[^"\r\n\\]*"|[A-Za-z0-9!#$&^_.+-]+))*)\s*$/.exec(value);
  if (!m) throw new Error('KIM_CONTENT_TYPE');
  const params = new Map();
  for (const p of m[2].matchAll(/;\s*([A-Za-z0-9-]+)\s*=\s*(?:"([^"\\]*)"|([A-Za-z0-9!#$&^_.+-]+))/g)) {
    const key = p[1].toLowerCase(); if (params.has(key)) throw new Error('KIM_CONTENT_TYPE'); params.set(key, p[2] ?? p[3]);
  }
  return { type: m[1].toLowerCase(), params };
}
function decodedBase64(body) {
  const text = body.toString('latin1');
  if (/[^A-Za-z0-9+/=\r\n\t ]/.test(text)) throw new Error('KIM_ENVELOPE_INVALID');
  const clean = text.replace(/[\r\n\t ]/g, ''), bytes = Buffer.from(clean, 'base64');
  if (!clean || bytes.toString('base64') !== clean) throw new Error('KIM_ENVELOPE_INVALID');
  return bytes;
}
/** Read only the outer transport profile. No decrypted payload or billing status is inferred. */
export function verifySubmission(bytes, { sender, recipients, authVerifier, now }) {
  const message = readMessage(bytes), one = message.one, id = one('message-id', true);
  if (!messageId(id) || !Number.isSafeInteger(now)) throw new Error('KIM_MESSAGE_FORMAT');
  const self = recipients.length === 1 && kimAddress(recipients[0].address) === kimAddress(sender);
  if (!self) {
    try {
      const from = addressList(one('from', true)), author = one('sender'), reply = one('reply-to');
      if (from.some(a => a !== kimAddress(sender)) || (author && (addressList(author).length !== 1 || addressList(author)[0] !== kimAddress(sender)))) throw new Error('KIM_ORIGINATOR');
      if (reply) addressList(reply);
      authVerifier.verify(one('x-kim-auth', true), sender);
    } catch (e) {
      if (e.message === 'KIM_AUTH_TRUST_UNAVAILABLE') throw e;
      throw new Error('KIM_ORIGINATOR');
    }
  }
  let expires = now + 90 * 86_400_000;
  const headerExpiry = one('expires');
  if (headerExpiry !== undefined) {
    // Require a full RFC-style timestamp with a timezone, never JS's permissive date-only parser.
    if (!/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} (?:[+-]\d{4}|GMT|UT)$/.test(headerExpiry)) throw new Error('KIM_MESSAGE_FORMAT');
    expires = Date.parse(headerExpiry);
    if (!Number.isSafeInteger(expires) || expires <= now || expires > now + 90 * 86_400_000) throw new Error('KIM_MESSAGE_EXPIRED');
  }
  const result = { id, expires };
  if (one('x-kim-fehlermeldung') !== undefined) {
    // fdgerr_6's required text copy is supported only for unambiguous single-part plain text.
    // Other MIME forms remain temporarily unavailable rather than losing/revealing arbitrary parts.
    const content = parseContentType(one('content-type', true)), transfer = one('content-transfer-encoding')?.toLowerCase() ?? '7bit';
    if (content.type !== 'text/plain' || (content.params.has('charset') && !['utf-8', 'us-ascii'].includes(content.params.get('charset').toLowerCase())) || !['7bit', '8bit', 'base64'].includes(transfer)) throw new Error('KIM_ENVELOPE_UNSUPPORTED');
    const body = transfer === 'base64' ? decodedBase64(message.body) : message.body;
    if (body.length > 65_536) throw new Error('KIM_ENVELOPE_UNSUPPORTED');
    const notificationText = new TextDecoder('utf-8', { fatal: true }).decode(body);
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(notificationText)) throw new Error('KIM_MESSAGE_FORMAT');
    return { ...result, errorCode: 'fdgerr_6', notificationText };
  }
  if (one('subject') !== 'KOM-LE-Nachricht') return { ...result, errorCode: 'fdgerr_2' };
  if (!['1.0', '1.5'].includes(one('x-kom-le-version'))) return { ...result, errorCode: 'fdgerr_3' };
  let content;
  try { content = parseContentType(one('content-type')); } catch { return { ...result, errorCode: 'fdgerr_4' }; }
  if (content.type !== 'application/pkcs7-mime' || content.params.get('smime-type')?.toLowerCase() !== 'authenticated-enveloped-data') return { ...result, errorCode: 'fdgerr_4' };
  try {
    if (one('content-transfer-encoding')?.toLowerCase() !== 'base64' || one('mime-version') !== '1.0') throw new Error('KIM_ENVELOPE_INVALID');
    inspectKimEnvelope(decodedBase64(message.body), [sender, ...recipients.map(r => r.address)]);
  } catch (e) {
    if (e.message === 'KIM_ENVELOPE_UNSUPPORTED') throw e;
    return { ...result, errorCode: 'fdgerr_1' };
  }
  return result;
}
