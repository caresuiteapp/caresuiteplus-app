import { createHash, randomUUID } from 'node:crypto';
import { kimAddress, messageId } from './address.mjs';
import { readMessage, addressList, parseContentType, decodedBase64, MAX_KIM_MESSAGE, kimTimestamp } from './message.mjs';
import { createEccKimAuth, verifyReceivedEccKimAuth, unfoldAutHeader, validCmVersion, validPtVersion } from './message-auth.mjs';
import { sealEccKimPayload, openEccKimPayload, inspectEccKimPayload } from './ecc-cms.mjs';
import { readKimEnvelope } from './envelope.mjs';
import { receiveReportContext, buildKimReceiveError } from './receive-error.mjs';

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
  try { kimTimestamp(value); } catch { fail('KIM_MESSAGE_DATE'); }
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
  return processMessage({ bytes, address, recipientCertificate, privateKey, expectedSignerCertificate, expectedAuthCertificate, now });
}
function processMessage({ bytes, address, recipientCertificate, privateKey, expectedSignerCertificate,
  expectedAuthCertificate, now }, onFailure) {
  let opened, stage = 'mime', success = false;
  try {
    const outer = readMessage(bytes);
    if (outer.one('x-kom-le-version', true) !== '1.0') fail('KIM_MESSAGE_VERSION_UNSUPPORTED', stage);
    const type = parseContentType(outer.one('content-type', true));
    if (outer.one('subject', true) !== 'KOM-LE-Nachricht' || outer.one('mime-version', true) !== '1.0'
      || type.type !== 'application/pkcs7-mime' || type.params.get('smime-type')?.toLowerCase() !== 'authenticated-enveloped-data'
      || outer.one('content-transfer-encoding', true).toLowerCase() !== 'base64') fail('KIM_MESSAGE_MIME', stage);
    const cms = decodedBase64(outer.body);
    let envelope;
    try { envelope = readKimEnvelope(cms); }
    catch (e) { fail(e?.message === 'KIM_ENVELOPE_UNSUPPORTED' ? 'KIM_MESSAGE_CMS_UNSUPPORTED' : 'KIM_MESSAGE_CMS_FORMAT', stage); }
    stage = 'decrypt';
    if (!envelope.mappings.some(m => m.address === kimAddress(address))) fail('KIM_MESSAGE_RECIPIENT_UNAVAILABLE', stage);
    if (privateKey === undefined || recipientCertificate === undefined) fail('KIM_MESSAGE_KEY_UNAVAILABLE', stage);
    const decode = onFailure ? inspectEccKimPayload : openEccKimPayload;
    opened = decode({ bytes: cms, address, recipientCertificate, privateKey, expectedSignerCertificate, now });
    if (opened.signatureStatus === 'rejected') fail('KIM_MESSAGE_SIGNATURE_REJECTED', 'signature');
    stage = 'headers';
    const inner = readMessage(opened.message); validateOriginal(inner); compareHeaders(inner, outer);
    const sender = origin(inner), visible = visibleRecipients(inner), boundEnvelope = readKimEnvelope(cms, [sender, address, ...visible]);
    // Inspect again with authenticated header addresses: an encrypted copy for an unlisted
    // mailbox must not be inferred from an unsigned From/To field.
    if (!boundEnvelope.mappings.length) fail('KIM_MESSAGE_RECIPIENTS');
    stage = 'auth';
    const authentication = verifyReceivedEccKimAuth({ header: inner.one('x-kim-auth', true), sender,
      expectedCertificate: expectedAuthCertificate, cmVersion: inner.one('x-kim-cmversion', true), now });
    success = true;
    return { ...opened, messageId: inner.one('message-id'), sender, authentication,
      headerIntegrity: 'matched', deliveryStatus: 'held-for-trust-validation', identityStatus: 'unverified' };
  } catch (e) {
    const code = e?.message === 'KIM_CMS_SIGNATURE_REJECTED' ? 'KIM_MESSAGE_SIGNATURE_REJECTED'
      : stage === 'decrypt' ? 'KIM_MESSAGE_DECRYPT_REJECTED' : stage === 'auth' ? 'KIM_MESSAGE_AUTH_REJECTED'
        : stage === 'headers' ? 'KIM_MESSAGE_HEADERS_REJECTED' : 'KIM_MESSAGE_MIME';
    const error = e instanceof KimMessageError ? e : new KimMessageError(code, e?.message === 'KIM_CMS_SIGNATURE_REJECTED' ? 'signature' : stage);
    if (onFailure) return onFailure(error, { message: opened?.message, decrypted: opened !== undefined });
    throw error;
  } finally { if (!success) opened?.message?.fill(0); }
}

/** Receive facade for an already persisted local original. No SMTP send, POP3 deletion,
 * billing update or positive trust assertion occurs here. Non-KIM messages pass unchanged.
 * A valid local ECC message still yields an integrity-07 diagnostic until TI trust exists.
 * Decrypted diagnostic attachments require the explicit, default-false report option.
 */
export function receiveEccKimMessage(options, reportOptions) {
  const now = options.now ?? Date.now(), context = receiveReportContext({ ...reportOptions, bytes: options.bytes, address: options.address, now });
  let opened;
  try {
    if (context.outer && !context.outer.headers.some(h => h.name === 'x-kom-le-version')) {
      return { kind: 'unprotected', bytes: Buffer.from(context.original), originalSha256: context.originalSha256,
        identityStatus: 'unverified', deliveryStatus: 'unprotected' };
    }
    opened = processMessage({ ...options, bytes: context.original, now }, (error, state) => buildKimReceiveError(context, error, state));
    if (opened.kind === 'diagnostic') return opened;
    return buildKimReceiveError(context, new KimMessageError('KIM_MESSAGE_TRUST_UNAVAILABLE', 'trust'), { message: opened.message, decrypted: true });
  } finally { opened?.message?.fill(0); context.original.fill(0); context.verificationReport?.fill(0); }
}
