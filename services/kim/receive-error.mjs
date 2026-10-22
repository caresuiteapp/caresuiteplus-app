import { randomUUID, createHash } from 'node:crypto';
import { kimAddress, messageId } from './address.mjs';
import { MAX_KIM_MESSAGE, readMessage, addressList, kimTimestamp } from './message.mjs';
import { validCmVersion, validPtVersion } from './message-auth.mjs';

export const MAX_KIM_RECEIVE_REPORT = MAX_KIM_MESSAGE + 1_048_576;
const digest = b => createHash('sha256').update(b).digest('hex');
const outerCopies = new Set(['date', 'from', 'sender', 'reply-to', 'to', 'cc', 'message-id']);
const replaced = new Set(['subject', 'mime-version', 'x-kom-le-version', 'x-kim-fehlermeldung', 'x-kim-decryptionresult',
  'x-kim-integritycheckresult', 'x-kim-integritycheckrefid', 'x-kim-cmversion', 'x-kim-ptversion', 'received', 'return-path']);
const fail = code => { throw new Error(code); };
function parsed(bytes) { try { return readMessage(bytes); } catch { return undefined; } }

/** Only an internal synchronous receive context. Original bytes are copied before processing.
 * A supplied external report is an opaque attachment, bound to this original by hash.
 * It never changes trust, delivery status or the outcome of cryptographic checks.
 */
export function receiveReportContext({ bytes, address, cmVersion, ptVersion, includeDecryptedOriginal = false,
  verificationReport, now = Date.now() }) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_KIM_MESSAGE) fail('KIM_RECEIVE_INPUT_LIMIT');
  if (typeof includeDecryptedOriginal !== 'boolean' || !validCmVersion(cmVersion) || !validPtVersion(ptVersion)
    || !Number.isSafeInteger(now) || now < 0 || !Number.isFinite(new Date(now).getTime())) fail('KIM_RECEIVE_CONFIGURATION');
  const original = Buffer.from(bytes), originalSha256 = digest(original);
  let report;
  if (verificationReport !== undefined) {
    if (!verificationReport || !(verificationReport.bytes instanceof Uint8Array) || !verificationReport.bytes.length
      || verificationReport.bytes.length > 262_144 || verificationReport.sourceSha256 !== originalSha256) fail('KIM_RECEIVE_REPORT_BINDING');
    report = Buffer.from(verificationReport.bytes);
  }
  return { original, originalSha256, outer: parsed(original), address: kimAddress(address), cmVersion, ptVersion,
    includeDecryptedOriginal, verificationReport: report, now };
}

// Fixed diagnostic vocabulary. Native errors and attacker-controlled token/header values
// never become error prose or report fields. Uncertain failures use manufacturer codes.
function diagnosis(error, decrypted) {
  if (error.code === 'KIM_MESSAGE_DIRECTORY_BINDING_REJECTED') return { kind: 'integrity', code: 'XCS_DIRECTORY', integrity: 'XCS_DIRECTORY',
    detail: 'Die Absenderadresse konnte im konfigurierten Verzeichnis nicht eindeutig einer geprüften Zertifikatsidentität zugeordnet werden. Die Nachricht bleibt ungeprüft.' };
  if (error.code === 'KIM_MESSAGE_CERTIFICATE_STATUS_REJECTED') return { kind: 'integrity', code: 'XCS_CERT_STATUS', integrity: 'XCS_CERT_STATUS',
    detail: 'Der Sperrstatus mindestens eines Nachrichtenzertifikats wurde nicht positiv bestätigt. Der Prüfbericht unterscheidet gesperrte, unbekannte und nicht auswertbare Statusangaben. Die Nachricht bleibt ungeprüft.' };
  if (error.code === 'KIM_MESSAGE_TRUST_UNAVAILABLE') return { kind: 'integrity', code: 'XCS_TRUST', integrity: '07',
    detail: 'Die mathematischen Prüfungen waren erfolgreich. TI-Vertrauenskette, Sperrstatus und Verzeichniszuordnung sind noch nicht bestätigt.' };
  if (decrypted || ['headers', 'auth', 'signature'].includes(error.stage)) return { kind: 'integrity', code: 'XCS_INTEGRITY',
    integrity: error.stage === 'auth' ? '10' : error.stage === 'signature' ? 'XCS_SIGNATURE' : 'XCS_HEADER',
    detail: error.stage === 'auth' ? 'Die Authentisierung der Nachricht konnte nicht bestätigt werden.'
      : error.stage === 'signature' ? 'Signatur, Zertifikatsbindung oder signierte Attribute wurden nicht erfolgreich geprüft.'
        : 'Die geschützten Nachrichtenfelder oder ihre Empfängerzuordnung stimmen nicht mit der Transportnachricht überein.' };
  if (error.code === 'KIM_MESSAGE_VERSION_UNSUPPORTED') return { kind: 'version', code: '4008',
    subject: 'Die KIM-Version der empfangenen Nachricht wird nicht unterstützt',
    detail: 'Die angegebene KIM-Version kann mit diesem Clientmodul nicht verarbeitet werden. Die unveränderte Transportnachricht liegt als Anhang bei.' };
  if (error.code === 'KIM_MESSAGE_KEY_UNAVAILABLE') return { kind: 'decrypt', code: '4009', decryption: '01',
    detail: 'Der passende Empfängerschlüssel steht nicht zur Verfügung. Prüfen Sie die Schlüssel- oder Kartenanbindung. Die verschlüsselte Originalnachricht bleibt für einen erneuten Abruf erhalten.' };
  if (error.code === 'KIM_MESSAGE_RECIPIENT_UNAVAILABLE') return { kind: 'decrypt', code: 'XCS_RECIPIENT', decryption: 'XCS_RECIPIENT',
    detail: 'Die Transportnachricht enthält keine passende Zertifikatszuordnung für das abholende Postfach. Es wurde kein fremder Empfängerschlüssel verwendet.' };
  if (error.code === 'KIM_MESSAGE_CMS_UNSUPPORTED') return { kind: 'decrypt', code: 'XCS_PROFILE', decryption: 'XCS_PROFILE',
    detail: 'Die kryptografische Hülle enthält eine noch nicht unterstützte Variante. Die Originalnachricht bleibt unverändert erhalten; daraus folgt kein Nachweis einer beschädigten Nachricht.' };
  if (['KIM_MESSAGE_MIME', 'KIM_MESSAGE_CMS_FORMAT'].includes(error.code)) return { kind: 'decrypt', code: '4010', decryption: '02',
    detail: 'Die als KIM markierte Nachricht konnte wegen ihres Nachrichtenformats nicht verarbeitet werden. Bitte lassen Sie die beigefügte Originalnachricht technisch prüfen.' };
  return { kind: 'decrypt', code: 'XCS_DECRYPT', decryption: 'XCS_DECRYPT',
    detail: 'Die authentisierte Entschlüsselung ist fehlgeschlagen. Die Ursache lässt sich nicht sicher einem fehlenden Schlüssel oder einem Formatfehler zuordnen. Es wurde kein Klartext freigegeben.' };
}

function encodedSubject(value) {
  const chunks = []; let current = '';
  for (const c of value) {
    if (Buffer.byteLength(current + c) > 39) { chunks.push(current); current = ''; }
    current += c;
  }
  if (current) chunks.push(current);
  return chunks.map(c => `=?UTF-8?B?${Buffer.from(c).toString('base64')}?=`).join('\r\n ');
}
function quotedPrintable(text) {
  // Encode every UTF-8 octet: no trailing-space ambiguity, bare newline or byte split.
  const bytes = Buffer.from(text), lines = [];
  for (let start = 0; start < bytes.length; start += 25) lines.push([...bytes.subarray(start, start + 25)].map(b => '=' + b.toString(16).toUpperCase().padStart(2, '0')).join(''));
  return Buffer.from(lines.join('=\r\n'));
}
function base64(bytes) { return Buffer.from(bytes.toString('base64').match(/.{1,76}/g).join('\r\n')); }
function part(headers, body) { return Buffer.concat([Buffer.from(headers.join('\r\n') + '\r\n\r\n', 'ascii'), body]); }
function attachment(type, name, bytes) {
  return part([`Content-Type: ${type}; name="${name}"`, `Content-Disposition: attachment; filename="${name}"`,
    `Content-Transfer-Encoding: ${type === 'message/rfc822' ? 'binary' : 'base64'}`], type === 'message/rfc822' ? bytes : base64(bytes));
}
function reportHeaders(context, inner, integrity, id) {
  const source = integrity ? (inner ?? context.outer) : context.outer, omitted = [], entries = [];
  if (source) for (const h of source.headers) {
    if (replaced.has(h.name) || h.name.startsWith('content-')) continue;
    if (!integrity && !outerCopies.has(h.name) && !h.name.startsWith('x-kim-')) continue;
    // Ambiguous fields are preserved only in the original evidence, never in the report envelope.
    if (source.headers.filter(p => p.name === h.name).length !== 1) { omitted.push(h.name); continue; }
    if (h.name === 'message-id' && !messageId(h.value)) { omitted.push(h.name); continue; }
    try {
      if (h.name === 'date') kimTimestamp(h.value);
      if (['from', 'sender', 'reply-to', 'to', 'cc', 'bcc'].includes(h.name) && !(h.name === 'bcc' && h.value === '')) {
        const addresses = addressList(h.value);
        if (['from', 'sender'].includes(h.name) && addresses.length !== 1) throw new Error();
      }
    } catch { omitted.push(h.name); continue; }
    entries.push(h);
  }
  const lines = entries.map(h => h.raw), names = new Set(entries.map(h => h.name));
  if (!names.has('date')) lines.push(`Date: ${new Date(context.now).toUTCString().replace('GMT', '+0000')}`);
  if (!names.has('from')) lines.push(`From: ${context.address}`);
  if (!names.has('to')) lines.push(`To: ${context.address}`);
  if (!names.has('message-id')) lines.push(`Message-ID: <${id}@${context.address.split('@')[1]}>`);
  // CM-generated envelopes carry only the outer transport's Return-Path and Received.
  // Those fields remain untrusted transport metadata, not signed identity evidence.
  const paths = context.outer?.headers.filter(h => h.name === 'return-path') ?? [];
  if (paths.length === 1) lines.unshift(paths[0].raw);
  if (paths.length > 1) omitted.push('return-path');
  lines.unshift(...(context.outer?.headers.filter(h => h.name === 'received').map(h => h.raw) ?? []));
  return { lines, omitted: [...new Set(omitted)].sort(), headerSource: inner && integrity ? 'decrypted' : source ? 'outer' : 'fallback' };
}

/** Local receive result only. Never send this diagnostic to the original sender or another
 * mailbox automatically. A_23165's decrypted original is an explicit opt-in, default false.
 * The external XML is kept opaque; no XSD, report authenticity or TI trust is inferred.
 */
export function buildKimReceiveError(context, error, { message, decrypted = false, certificateStatus } = {}) {
  const d = diagnosis(error, decrypted), id = randomUUID(), integrity = d.kind === 'integrity', inner = message ? parsed(message) : undefined;
  const h = reportHeaders(context, inner, integrity, id), attachments = [];
  const added = [];
  if (integrity) {
    if (context.includeDecryptedOriginal && message) {
      const name = `${id}.eml`; attachments.push(attachment('message/rfc822', name, message)); added.push(name);
    }
    if (context.verificationReport) {
      const name = `VerificationReport_${id}.xml`; attachments.push(attachment('application/xml', name, context.verificationReport)); added.push(name);
    }
  } else {
    const name = `EncryptedMessage_${id}.eml`; attachments.push(attachment('message/rfc822', name, context.original)); added.push(name);
  }
  const diagnostic = { schema: 'caresuite.kim.receive-error.v1', referenceId: id, kind: d.kind, errorCode: d.code,
    ...(d.decryption ? { decryptionResult: d.decryption } : decrypted ? { decryptionResult: '00' } : {}),
    ...(d.integrity ? { integrityResult: d.integrity } : {}), originalSha256: context.originalSha256,
    originalBytes: context.original.length, identityStatus: 'unverified', deliveryStatus: 'diagnostic-only',
    headerSource: h.headerSource, omittedHeaderNames: h.omitted, decryptedOriginalAttached: integrity && context.includeDecryptedOriginal && Boolean(message),
    externalReportSha256: integrity && context.verificationReport ? digest(context.verificationReport) : undefined,
    ...(integrity && certificateStatus ? { certificateStatus } : {}),
    processedAt: new Date(context.now).toISOString() };
  if (integrity) {
    const name = `IntegrityReport_${id}.json`;
    attachments.push(attachment('application/json', name, Buffer.from(JSON.stringify(diagnostic, null, 2) + '\n'))); added.push(name);
  }
  const text = (integrity ? 'Die technische Integrität dieser KIM-Nachricht konnte nicht vollständig bestätigt werden. Die Nachricht ist bis zur Klärung als ungeprüft zu behandeln.\r\n\r\n' : '')
    + `${d.detail}\r\n\r\nReferenz: ${id}\r\nFehlercode: ${d.code}\r\n\r\nAnhänge:\r\n${added.map(n => '- ' + n).join('\r\n')}\r\n`
    + (diagnostic.decryptedOriginalAttached ? '\r\nDer entschlüsselte Originalanhang ist ungeprüft. Öffnen oder verarbeiten Sie ihn erst nach einer geeigneten Sicherheitsprüfung.\r\n' : '')
    + (integrity ? `\r\nNur Anhänge mit der Referenz ${id} gehören zu diesem Prüfvorgang. Wenden Sie sich zur Klärung an Ihre Systembetreuung.\r\n` : '');
  const parts = [part(['Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: quoted-printable'], quotedPrintable(text)), ...attachments];
  let boundary;
  for (let n = 0; n < 8; n++) {
    const candidate = 'cs-kim-' + randomUUID().replaceAll('-', '');
    if (parts.every(p => !p.includes(Buffer.from(candidate)))) { boundary = candidate; break; }
  }
  if (!boundary) fail('KIM_RECEIVE_BOUNDARY');
  const headers = [...h.lines, `Subject: ${encodedSubject(d.subject ?? (integrity ? 'Fehler bei der Integritätsprüfung festgestellt' : 'Die Nachricht konnte nicht entschluesselt werden'))}`,
    `X-KIM-CMVersion: ${context.cmVersion}`, `X-KIM-PTVersion: ${context.ptVersion}`, `X-KIM-Fehlermeldung: ${d.code}`,
    ...(diagnostic.decryptionResult ? [`X-KIM-DecryptionResult: ${diagnostic.decryptionResult}`] : []),
    ...(integrity ? [`X-KIM-IntegrityCheckResult: ${d.integrity}`, `X-KIM-IntegrityCheckRefID: ${id}`] : []),
    'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, 'Content-Transfer-Encoding: binary'];
  const head = Buffer.from(headers.join('\r\n') + '\r\n\r\n', 'ascii');
  try { readMessage(head); } catch { fail('KIM_RECEIVE_REPORT_LIMIT'); }
  // The CRLF immediately before each boundary is MIME framing, never part of the attachment.
  // Always append it, even when the original itself already ended in CRLF.
  const result = Buffer.concat([head, ...parts.flatMap(p => [Buffer.from(`--${boundary}\r\n`), p, Buffer.from('\r\n')]), Buffer.from(`--${boundary}--\r\n`)]);
  if (result.length > MAX_KIM_RECEIVE_REPORT) fail('KIM_RECEIVE_REPORT_LIMIT');
  return { kind: 'diagnostic', bytes: result, diagnostic, originalSha256: context.originalSha256,
    identityStatus: 'unverified', deliveryStatus: 'diagnostic-only' };
}
