import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { KonnektorCertificateClient } from './connector-certificates.mjs';
import { TslOcspStatusClient } from './tsl-ocsp.mjs';
import { prepareSmcbPin, assertPreparedSmcbPin } from './connector-pin.mjs';
import { cardFingerprint } from './connector-cards.mjs';
import { connectorFail, connectorSignal } from './connector-error.mjs';
import { kimAddress } from './address.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const pending = new WeakSet();
const mime = Buffer.from('Content-Type: application/pkcs7-mime; smime-type=signed-data\r\nContent-Transfer-Encoding: binary\r\n\r\n');

/** Synthetic self roundtrip, never a medical message or dispatch. All four SOAP
 * operations must run on the provisioned peer. Caller labels cannot attest TI
 * access, physical hardware, certification or recipient acceptance. */
export async function probeSmcbCms(input = {}) {
  if (!input || Object.keys(input).some(k => !['connector', 'statusClient', 'expectedTelematikId', 'requiredRoles', 'iccsn', 'ctId', 'slotId', 'address', 'signal'].includes(k))) connectorFail('INPUT');
  const { connector, statusClient, signal } = input;
  if (!(connector instanceof KonnektorCertificateClient) || !(statusClient instanceof TslOcspStatusClient)) connectorFail('CONFIGURATION');
  connectorSignal(signal);
  let address; try { address = kimAddress(input.address); } catch { connectorFail('INPUT'); }
  if (pending.has(connector)) connectorFail('CMS_BUSY');
  const requiredRoles = Array.isArray(input.requiredRoles) ? [...input.requiredRoles] : input.requiredRoles;
  const settings = { connector, statusClient, expectedTelematikId: input.expectedTelematikId, requiredRoles,
    iccsn: input.iccsn, ctId: input.ctId, slotId: input.slotId, mandantWide: false, allowPrompt: false };
  const startedAt = Date.now(), runId = randomUUID(), challenge = randomBytes(32);
  const stop = AbortSignal.any([AbortSignal.timeout(120000), ...(signal ? [signal] : [])]);
  let fingerprint, certHashes, first, signed, inner, encrypted, decrypted, last;
  const content = Buffer.from(`Content-Type: message/rfc822\r\nMIME-Version: 1.0\r\nContent-Transfer-Encoding: binary\r\n\r\nFrom: ${address}\r\nTo: ${address}\r\nSubject: CareSuite Konnektorpruefung\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=us-ascii\r\n\r\nSynthetic challenge ${runId} ${challenge.toString('hex')}\r\n`);
  const prepare = async () => {
    const value = await prepareSmcbPin({ ...settings, signal: stop });
    if (value.state !== 'pin-verified') connectorFail('PIN_NOT_VERIFIED');
    assertPreparedSmcbPin(value, connector, statusClient);
    const card = value.bundle.selection.card, current = value.bundle.certificates.map(c => c.certificateSha256).join(':');
    if (fingerprint && (cardFingerprint(card) !== fingerprint || certHashes !== current)) connectorFail('CARD_CHANGED');
    if (!fingerprint) {
      fingerprint = cardFingerprint(card); certHashes = current; first = value;
      Object.assign(settings, { iccsn: card.iccsn, ctId: card.ctId, slotId: card.slotId });
    }
    last = value; return value;
  };
  const cert = (p, ref) => p.bundle.certificates.find(c => c.certRef === ref);
  const args = (p, ref) => ({ status: p.status, certificate: cert(p, ref).certificate, verification: cert(p, ref).verification, signal: stop });
  pending.add(connector);
  try {
    let p = await prepare();
    const recipients = [{ address, certificate: Buffer.from(cert(p, 'C.ENC').certificate) }];
    signed = await KonnektorCertificateClient.prototype.signSmcbDocument.call(connector, { ...args(p, 'C.SIG'), data: content, sender: address, recipients });
    inner = Buffer.concat([mime, Buffer.from(signed.data, 'base64')]);
    p = await prepare();
    encrypted = await KonnektorCertificateClient.prototype.encryptSmcbDocument.call(connector, { ...args(p, 'C.ENC'), data: inner, sender: address, recipients });
    p = await prepare();
    decrypted = await KonnektorCertificateClient.prototype.decryptSmcbDocument.call(connector, { ...args(p, 'C.ENC'),
      data: Buffer.from(encrypted.data, 'base64'), address, expectedSignerCertificate: cert(p, 'C.SIG').certificate });
    const restored = Buffer.from(decrypted.data, 'base64');
    try { if (!restored.equals(inner)) connectorFail('CMS_BINDING'); } finally { restored.fill(0); }
    await prepare(); connectorSignal(stop); assertPreparedSmcbPin(last, connector, statusClient);
    const transcript = [signed.job, signed, encrypted, decrypted].map(r => Object.freeze({
      operation: r.operation, requestSha256: r.requestSha256, responseSha256: r.responseSha256,
      routeSha256: r.routeSha256, contextSha256: r.contextSha256, checkedAt: r.checkedAt,
    }));
    return Object.freeze({ version: 1, runId, startedAt, completedAt: Date.now(), environment: connector.environment,
      state: 'passed', profile: 'ecc-cms-diagnostic', source: 'configured-konnektor',
      challengeSha256: hash(challenge), contentSha256: hash(content), envelopeSha256: encrypted.outputSha256,
      certificateSha256: Object.freeze(first.bundle.certificates.map(c => Object.freeze({ ref: c.certRef, sha256: c.certificateSha256 }))),
      transcript: Object.freeze(transcript), transcriptSha256: hash(JSON.stringify(transcript)),
      hardwareEvidence: 'not-attested', tiEvidence: 'not-attested', deliveryStatus: 'held-for-trust-validation' });
  } finally { pending.delete(connector); challenge.fill(0); content.fill(0); inner?.fill(0); }
}
