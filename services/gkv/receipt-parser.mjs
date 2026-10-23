import { mailbox } from './smtp.mjs';

// Deliberately bounded MIME/RFC 3464 subset. Unsupported or ambiguous messages go to
// review with their original bytes intact; neither text matching nor mail headers prove origin.
export class ReceiptFormatError extends Error {
  constructor(code) { super(code); this.name = 'ReceiptFormatError'; }
}
const reject = code => { throw new ReceiptFormatError(code); };
const singleId = value => {
  if (value === undefined) return undefined;
  if (!/^<[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9.-]+>$/.test(value) || value.length > 250) reject('RECEIPT_MESSAGE_ID');
  return value;
};
export const normalizedAddress = value => {
  if (!mailbox(value)) reject('RECEIPT_ADDRESS');
  const at = value.lastIndexOf('@'); return value.slice(0, at + 1) + value.slice(at + 1).toLowerCase();
};

function headers(text) {
  if (text.length > 65_536 || /[^\x09\x0d\x0a\x20-\x7e]/.test(text)) reject('RECEIPT_HEADERS');
  const map = new Map(), lines = text.split('\r\n'); let name;
  if (lines.length > 200) reject('RECEIPT_HEADER_LIMIT');
  for (const line of lines) {
    if (line.length > 998 || !line) reject('RECEIPT_HEADER_LINE');
    if (/^[ \t]/.test(line)) {
      if (!name) reject('RECEIPT_HEADER_FOLD');
      const values = map.get(name); values[values.length - 1] += ` ${line.trim()}`; continue;
    }
    const match = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+):[ \t]*(.*)$/.exec(line);
    if (!match) reject('RECEIPT_HEADER_LINE');
    name = match[1].toLowerCase(); const values = map.get(name) ?? [];
    values.push(match[2].trim()); map.set(name, values);
  }
  return {
    one(name, required = false) {
      const values = map.get(name) ?? [];
      if (values.length > 1 || (required && (!values.length || !values[0]))) reject('RECEIPT_HEADER_DUPLICATE_OR_MISSING');
      return values[0];
    },
  };
}
function entity(text) {
  const end = text.indexOf('\r\n\r\n');
  if (end < 1) reject('RECEIPT_MIME_HEADERS');
  return { headers: headers(text.slice(0, end)), body: text.slice(end + 4) };
}
function contentType(value = 'text/plain') {
  const first = /^([A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+)/.exec(value);
  if (!first) reject('RECEIPT_CONTENT_TYPE');
  let rest = value.slice(first[0].length); const params = new Map();
  while (rest.trim()) {
    const match = /^[ \t]*;[ \t]*([A-Za-z0-9!#$&^_.+-]+)[ \t]*=[ \t]*(?:"((?:[^"\\\r\n]|\\[ -~])*)"|([A-Za-z0-9!#$&^_.+\/-]+))/.exec(rest);
    if (!match) reject('RECEIPT_CONTENT_TYPE');
    const key = match[1].toLowerCase(); if (params.has(key)) reject('RECEIPT_CONTENT_TYPE_DUPLICATE');
    params.set(key, match[2] !== undefined ? match[2].replace(/\\([ -~])/g, '$1') : match[3]); rest = rest.slice(match[0].length);
  }
  return { type: first[1].toLowerCase(), params };
}
function transferEncoding(part) { return (part.headers.one('content-transfer-encoding') ?? '7bit').toLowerCase(); }
function plainText(part) {
  const type = contentType(part.headers.one('content-type'));
  if (type.type !== 'text/plain') reject('RECEIPT_TEXT_FORMAT_UNSUPPORTED');
  let body = part.body; const encoding = transferEncoding(part);
  if (encoding === 'base64') {
    const encoded = body.replace(/[\r\n\t ]/g, '');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) reject('RECEIPT_BASE64');
    const decoded = Buffer.from(encoded, 'base64'); if (decoded.toString('base64') !== encoded) reject('RECEIPT_BASE64');
    body = decoded.toString('latin1');
  } else if (encoding === 'quoted-printable') {
    if (/[^\x09\x0d\x0a\x20-\x7e]/.test(body) || /=(?![A-Fa-f0-9]{2}|\r\n)/.test(body)) reject('RECEIPT_QUOTED_PRINTABLE');
    body = body.replace(/=\r\n/g, '').replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } else if (!['7bit', '8bit'].includes(encoding)) reject('RECEIPT_ENCODING_UNSUPPORTED');
  else if (encoding === '7bit' && /[^\x09\x0d\x0a\x20-\x7e]/.test(body)) reject('RECEIPT_7BIT');
  const charset = (type.params.get('charset') ?? 'us-ascii').toLowerCase();
  if (charset === 'us-ascii') { if (/[^\x09\x0d\x0a\x20-\x7e]/.test(body)) reject('RECEIPT_CHARSET'); }
  else if (charset === 'utf-8') {
    try { body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(body, 'latin1')); } catch { reject('RECEIPT_UTF8'); }
  } else if (charset !== 'iso-8859-1') reject('RECEIPT_CHARSET_UNSUPPORTED');
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body) || /(?<!\r)\n|\r(?!\n)/.test(body)) reject('RECEIPT_TEXT_LINES');
  return body;
}
function multipart(body, boundary) {
  if (typeof boundary !== 'string' || !/^[A-Za-z0-9'()+_,./:=? -]{1,70}$/.test(boundary) || boundary.endsWith(' ')) reject('RECEIPT_BOUNDARY');
  const parts = []; let current = null, closed = false;
  for (const line of body.split('\r\n')) {
    const delimiter = line.replace(/[ \t]+$/, '');
    if (delimiter === `--${boundary}` || delimiter === `--${boundary}--`) {
      if (closed) reject('RECEIPT_BOUNDARY_REPEATED');
      if (current) parts.push(entity(current.join('\r\n')));
      if (parts.length > 3) reject('RECEIPT_PART_LIMIT');
      closed = delimiter === `--${boundary}--`; current = closed ? null : [];
    } else if (current) current.push(line);
  }
  if (!closed || parts.length < 2) reject('RECEIPT_MULTIPART');
  return parts;
}
function dsn(root, type) {
  if (type.params.get('report-type')?.toLowerCase() !== 'delivery-status' || transferEncoding(root) !== '7bit') reject('RECEIPT_REPORT_TYPE');
  const parts = multipart(root.body, type.params.get('boundary'));
  if (contentType(parts[0].headers.one('content-type')).type !== 'text/plain' || contentType(parts[1].headers.one('content-type')).type !== 'message/delivery-status'
    || transferEncoding(parts[1]) !== '7bit' || /[^\x09\x0d\x0a\x20-\x7e]/.test(parts[1].body)) reject('RECEIPT_DSN_PART');
  const blocks = parts[1].body.replace(/(?:\r\n)+$/, '').split('\r\n\r\n');
  if (blocks.length < 2 || blocks.length > 101) reject('RECEIPT_DSN_RECIPIENT_LIMIT');
  const perMessage = headers(blocks[0]);
  if (!/^dns;[ \t]*[A-Za-z0-9.-]+$/i.test(perMessage.one('reporting-mta', true))) reject('RECEIPT_REPORTING_MTA');
  const envelopeId = perMessage.one('original-envelope-id');
  // We submit an ASCII UUID ENVID; other xtext encodings cannot identify our jobs.
  if (envelopeId !== undefined && !/^[A-Za-z0-9._-]{1,100}$/.test(envelopeId)) reject('RECEIPT_ENVELOPE_ID');
  let originalMessageId = singleId(root.headers.one('in-reply-to'));
  if (parts[2]) {
    const originalType = contentType(parts[2].headers.one('content-type')).type;
    if (!['message/rfc822', 'text/rfc822-headers'].includes(originalType) || transferEncoding(parts[2]) !== '7bit') reject('RECEIPT_ORIGINAL_HEADERS');
    const text = parts[2].body.split('\r\n\r\n')[0].replace(/(?:\r\n)+$/, '');
    const returnedId = singleId(headers(text).one('message-id', true));
    if (originalMessageId && originalMessageId !== returnedId) reject('RECEIPT_CONFLICTING_MESSAGE_IDS');
    originalMessageId = returnedId;
  }
  const recipientAddress = value => {
    const match = /^rfc822;[ \t]*(.+)$/i.exec(value);
    if (!match) reject('RECEIPT_ADDRESS_TYPE'); return normalizedAddress(match[1]);
  };
  const recipients = blocks.slice(1).map(block => {
    const fields = headers(block), action = fields.one('action', true).toLowerCase(), status = fields.one('status', true);
    const expected = { delivered: '2', failed: '5', delayed: '4', relayed: '2', expanded: '2' }[action];
    if (!expected || !/^[245]\.\d{1,3}\.\d{1,3}$/.test(status) || status[0] !== expected) reject('RECEIPT_ACTION_STATUS');
    const original = fields.one('original-recipient');
    return { address: recipientAddress(fields.one('final-recipient', true)), ...(original ? { originalAddress: recipientAddress(original) } : {}), action, status };
  });
  return { type: 'dsn', originalMessageId, envelopeId, recipients };
}
function classic(root) {
  const match = /^(Annahmebestaetigung|Dateiablehnung)(?: ([ET]PFL0))? Absender: ([1-9]\d{8}) Empfaenger: ([1-9]\d{8}) Datei Nr\.: (\d{3})$/.exec(root.headers.one('subject', true));
  if (!match) reject('RECEIPT_CLASSIC_SUBJECT');
  const body = plainText(root), files = [];
  // Never derive a positive result from the quoted original request further down the message.
  for (const line of body.split('\r\n')) {
    if (/^-+[ \t]*Original Nachricht[ \t]*-+[ \t]*$/i.test(line)) break;
    if (!/^[ET]PFL/.test(line)) continue;
    const f = /^([ET]PFL\d{4}(?:\.AUF)?),[ \t]*(\d{1,12}),[ \t]*(\d{8}:\d{6})$/.exec(line);
    if (!f || Number(f[2]) < 1) reject('RECEIPT_CLASSIC_FILE');
    files.push({ name: f[1], size: Number(f[2]), stamp: f[3] });
  }
  if (files.length !== 2 || new Set(files.map(f => f.name)).size !== 2) reject('RECEIPT_CLASSIC_PAIR');
  const order = files.find(f => f.name.endsWith('.AUF')), data = files.find(f => !f.name.endsWith('.AUF'));
  if (!order || !data || order.name !== `${data.name}.AUF` || order.size !== 348 || order.stamp !== data.stamp || data.name.slice(5) !== match[5]
    || (match[2] && data.name.slice(0, 5) !== match[2])) reject('RECEIPT_CLASSIC_PAIR');
  return { type: 'classic', outcome: match[1] === 'Annahmebestaetigung' ? 'file_received' : 'file_rejected',
    originalMessageId: singleId(root.headers.one('in-reply-to')), senderIk: match[3], receiverIk: match[4], transfer: match[5], files };
}
export function parseReceipt(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 1_048_576) reject('RECEIPT_SIZE');
  const text = Buffer.from(bytes).toString('latin1');
  if (!text.endsWith('\r\n') || /(?<!\r)\n|\r(?!\n)/.test(text)) reject('RECEIPT_LINES');
  const root = entity(text), type = contentType(root.headers.one('content-type'));
  const messageId = singleId(root.headers.one('message-id'));
  if (type.type === 'multipart/report') return { ...dsn(root, type), messageId };
  if (type.type === 'text/plain') return { ...classic(root), messageId };
  // S/MIME and PFL/FEH XML require their actual signature/schema verifier, never guessed plaintext.
  reject('RECEIPT_FORMAT_UNSUPPORTED');
}
