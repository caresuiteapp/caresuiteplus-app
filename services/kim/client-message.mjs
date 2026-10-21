import { createHash, randomUUID } from 'node:crypto';
import { kimAddress, messageId } from './address.mjs';
import { readMessage, addressList, parseContentType, decodedBase64, MAX_KIM_MESSAGE } from './message.mjs';
import { createEccKimAuth, verifyReceivedEccKimAuth, unfoldAutHeader, validCmVersion, validPtVersion } from './message-auth.mjs';
import { sealEccKimPayload, openEccKimPayload } from './ecc-cms.mjs';
import { readKimEnvelope } from './envelope.mjs';

const copied = new Set(['date', 'from', 'sender', 'reply-to', 'to', 'cc', 'bcc', 'message-id', 'expires']);
const replaced = new Set(['x-kim-auth', 'x-kim-cmversion', 'x-kim-ptversion']);
const reserved = new Set(['x-kim-decryptionresult', 'x-kim-integritycheckresult', 'x-kim-integritycheckrefid', 'x-kim-fehlermeldung']);
const protectedName = name => copied.has(name) || name.startsWith('x-kim-');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Internal diagnostic errors only: no original headers, tokens, body or private-key errors. */
export class KimMessageError extends Error {
  constructor(code, stage) { super(code); this.name = 'KimMessageError'; this.code = code; this.stage = stage; }
}
function fail(code, stage = 'headers') { throw new KimMessageError(code, stage); }
function compose(headers, body) {
  const bytes = Buffer.concat([Buffer.from(headers.join('\r\n') + '\r\n\r\n', 'ascii'), body]);
  if (bytes.length > MAX_KIM_MESSAGE) fail('KIM_MESSAGE_SIZE', 'mime');
  readMessage(bytes); // Final physical line, header count, header-byte and total-byte limits.
  return bytes;
}
function timestamp(value) {
  const m = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) (?:[+-](?:[01]\d|2[0-3])[0-5]\d|GMT|UT)$/.exec(value ?? '');
  if (!m || Number(m[4]) < 1900 || Number(m[5]) > 23 || Number(m[6]) > 59 || Number(m[7]) > 59) fail('KIM_MESSAGE_DATE');
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m[3]);
  const day = new Date(Date.UTC(Number(m[4]), month, Number(m[2])));
  if (day.getUTCDate() !== Number(m[2]) || day.getUTCMonth() !== month || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getUTCDay()] !== m[1] || !Number.isSafeInteger(Date.parse(value))) fail('KIM_MESSAGE_DATE');
}
function origin(message) {
  const from = addressList(message.one('from', true));
  if (from.length !== 1) fail('KIM_MESSAGE_ORIGINATOR');
  const sender = message.one('sender');
  if (sender !== undefined) {
    const senders = addressList(sender);
    if (senders.length !== 1 || senders[0] !== from[0]) fail('KIM_MESSAGE_ORIGINATOR');
  }
  const reply = message.one('reply-to'); if (reply !== undefined) addressList(reply);
  return from[0];
}
function visibleRecipients(message) {
  return ['to', 'cc', 'bcc'].flatMap(name => {
    const value = message.one(name);
    return value === undefined || (name === 'bcc' && value === '') ? [] : addressList(value);
  });
}
function validateOriginal(message) {
  timestamp(message.one('date', true));
  if (!messageId(message.one('message-id', true))) fail('KIM_MESSAGE_ID');
  message.one('subject');
  if (message.one('mime-version') !== '1.0') fail('KIM_MESSAGE_MIME', 'mime');
  parseContentType(message.one('content-type', true));
  message.one('content-transfer-encoding');
  if (message.one('x-kom-le-version') !== undefined) fail('KIM_MESSAGE_ALREADY_PROTECTED');
  for (const h of message.headers) {
    if (reserved.has(h.name)) fail('KIM_MESSAGE_RESERVED_HEADER');
    if (h.name.startsWith('x-kim-')) message.one(h.name, true);
  }
  const expires = message.one('expires'); if (expires !== undefined) timestamp(expires);
}
function destinationSet(values) {
  if (!Array.isArray(values) || !values.length || values.length > 100) fail('KIM_MESSAGE_RECIPIENTS');
  const canonical = values.map(kimAddress);
  if (new Set(canonical).size !== canonical.length) fail('KIM_MESSAGE_RECIPIENTS');
  return new Set(canonical);
}

/** Complete local ECC wire-message construction for INLINE (1.0) content only.
 * The caller supplies separate SMTP destinations and certificate bindings; neither the
 * message's visible headers nor this function establish VZD/Telematik-ID authorization.
 * Software keys are for the current internal implementation, not SMC-B key custody.
 */
export function createEccKimMessage({ message, sender, envelopeRecipients, recipients, signingCertificate, signingKey,
  authCertificate, authKey, cmVersion, ptVersion, now = Date.now() }) {
  let prepared;
  try {
    if (!Number.isSafeInteger(now) || now < 0 || !validCmVersion(cmVersion) || !validPtVersion(ptVersion)) fail('KIM_MESSAGE_CONFIGURATION', 'prepare');
    sender = kimAddress(sender);
    const targets = destinationSet(envelopeRecipients), source = readMessage(message);
    if (origin(source) !== sender) fail('KIM_MESSAGE_ORIGINATOR');
    if (visibleRecipients(source).some(a => !targets.has(a))) fail('KIM_MESSAGE_RECIPIENTS');
    if (!Array.isArray(recipients) || !recipients.length || recipients.length > 1000) fail('KIM_MESSAGE_RECIPIENTS');
    const certificateAddresses = new Set(recipients.map(r => kimAddress(r.address))), needed = new Set([sender, ...targets]);
    if (certificateAddresses.size !== needed.size || [...needed].some(a => !certificateAddresses.has(a))) fail('KIM_MESSAGE_RECIPIENTS');
    // Always replace every stale client-supplied token, including duplicate token fields.
    const lines = source.headers.filter(h => !replaced.has(h.name)).map(h => h.raw);
    if (source.one('date') === undefined) lines.push(`Date: ${new Date(now).toUTCString().replace('GMT', '+0000')}`);
    if (source.one('message-id') === undefined) lines.push(`Message-ID: <${randomUUID()}@${sender.split('@')[1]}>`);
    const auth = createEccKimAuth({ sender, certificate: authCertificate, privateKey: authKey, cmVersion, now });
    lines.push(`X-KIM-CMVersion: ${cmVersion}`, `X-KIM-PTVersion: ${ptVersion}`, `X-KIM-Auth: ${auth.match(/.{1,76}/g).join('\r\n ')}`);
    prepared = compose(lines, source.body);
    const inner = readMessage(prepared); validateOriginal(inner);
    const cms = sealEccKimPayload({ message: prepared, sender, recipients, signingCertificate, signingKey, now });
    const headers = inner.headers.filter(h => protectedName(h.name)).map(h => h.raw);
    headers.push('Subject: KOM-LE-Nachricht', 'X-KOM-LE-Version: 1.0', 'MIME-Version: 1.0',
      'Content-Type: application/pkcs7-mime; smime-type=authenticated-enveloped-data', 'Content-Transfer-Encoding: base64');
    const bytes = compose(headers, Buffer.from(cms.toString('base64').match(/.{1,76}/g).join('\r\n') + '\r\n'));
    return { bytes, messageId: inner.one('message-id'), sender, recipients: [...targets],
      protectedMessageSha256: sha256(prepared), identityStatus: 'unverified' };
  } catch (e) {
    if (e instanceof KimMessageError) throw e;
    fail('KIM_MESSAGE_PREPARATION_REJECTED', 'prepare');
  } finally { prepared?.fill(0); }
}

function compareHeaders(inner, outer) {
  const names = new Set([...inner.headers, ...outer.headers].filter(h => protectedName(h.name)).map(h => h.name));
  for (const name of names) {
    const a = inner.one(name), b = outer.one(name);
    if (a === undefined || b === undefined) fail('KIM_MESSAGE_HEADER_MISMATCH');
    if (name === 'x-kim-auth' ? unfoldAutHeader(a) !== unfoldAutHeader(b) : a !== b) fail('KIM_MESSAGE_HEADER_MISMATCH');
  }
}

/** Opens a bounded inline message for internal analysis. NEVER yields a delivery approval:
 * identityStatus remains unverified and deliveryStatus held-for-trust-validation.
 * Receiving AUT checks do not reuse the FD submission TTL. Errors contain no plaintext.
 */
export function openEccKimMessage({ bytes, address, recipientCertificate, privateKey, expectedSignerCertificate,
  expectedAuthCertificate, now = Date.now() }) {
  let opened, stage = 'mime', success = false;
  try {
    const outer = readMessage(bytes);
    if (outer.one('x-kom-le-version', true) !== '1.0') fail('KIM_MESSAGE_VERSION_UNSUPPORTED', stage);
    const type = parseContentType(outer.one('content-type', true));
    if (outer.one('subject', true) !== 'KOM-LE-Nachricht' || outer.one('mime-version', true) !== '1.0'
      || type.type !== 'application/pkcs7-mime' || type.params.get('smime-type')?.toLowerCase() !== 'authenticated-enveloped-data'
      || outer.one('content-transfer-encoding', true).toLowerCase() !== 'base64') fail('KIM_MESSAGE_MIME', stage);
    const cms = decodedBase64(outer.body);
    stage = 'decrypt';
    opened = openEccKimPayload({ bytes: cms, address, recipientCertificate, privateKey, expectedSignerCertificate, now });
    stage = 'headers';
    const inner = readMessage(opened.message); validateOriginal(inner); compareHeaders(inner, outer);
    const sender = origin(inner), visible = visibleRecipients(inner), envelope = readKimEnvelope(cms, [sender, address, ...visible]);
    // Inspect again with authenticated header addresses: an encrypted copy for an unlisted
    // mailbox must not be inferred from an unsigned From/To field.
    if (!envelope.mappings.length) fail('KIM_MESSAGE_RECIPIENTS');
    stage = 'auth';
    const authentication = verifyReceivedEccKimAuth({ header: inner.one('x-kim-auth', true), sender,
      expectedCertificate: expectedAuthCertificate, cmVersion: inner.one('x-kim-cmversion', true), now });
    success = true;
    return { ...opened, messageId: inner.one('message-id'), sender, authentication,
      headerIntegrity: 'matched', deliveryStatus: 'held-for-trust-validation', identityStatus: 'unverified' };
  } catch (e) {
    if (e instanceof KimMessageError) throw e;
    const code = e.message === 'KIM_CMS_SIGNATURE_REJECTED' ? 'KIM_MESSAGE_SIGNATURE_REJECTED'
      : stage === 'decrypt' ? 'KIM_MESSAGE_DECRYPT_REJECTED' : stage === 'auth' ? 'KIM_MESSAGE_AUTH_REJECTED'
        : stage === 'headers' ? 'KIM_MESSAGE_HEADERS_REJECTED' : 'KIM_MESSAGE_MIME';
    fail(code, e.message === 'KIM_CMS_SIGNATURE_REJECTED' ? 'signature' : stage);
  } finally { if (!success) opened?.message.fill(0); }
}
