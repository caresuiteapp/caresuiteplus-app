import { createHash } from 'node:crypto';
import { KonnektorCertificateClient } from './connector-certificates.mjs';
import { prepareSmcbPin, assertPreparedSmcbPin } from './connector-pin.mjs';
import { cardFingerprint } from './connector-cards.mjs';
import { buildEccKimAuthInput } from './message-auth.mjs';
import { connectorFail, connectorSignal, KonnektorError } from './connector-error.mjs';

const pending = new WeakSet(), signatures = new WeakMap(), tokens = new WeakMap();
const baseOptions = ['connector', 'statusClient', 'prepared', 'signal'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function options(input, extra) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(k => ![...baseOptions, ...extra].includes(k))) connectorFail('INPUT');
}

/** Authentication bytes only, never CMS/document signatures. A previously
 * prepared PIN observation is consumed by exactly one operation. A successful
 * signature must then survive a fresh full card/certificate/PIN preflight.
 */
export async function signSmcbAuthentication(input = {}) {
  options(input, ['data']);
  const { connector, statusClient, prepared, data, signal } = input;
  connectorSignal(signal);
  assertPreparedSmcbPin(prepared, connector, statusClient);
  if (!(data instanceof Uint8Array) || !data.length || data.length > 16384) connectorFail('INPUT');
  if (pending.has(connector)) connectorFail('AUTH_BUSY');
  const bytes = Buffer.from(data), fingerprint = cardFingerprint(prepared.bundle.selection.card);
  const hashes = prepared.bundle.certificates.map(c => c.certificateSha256);
  const { iccsn, ctId, slotId } = prepared.bundle.selection.card;
  const auth = prepared.bundle.certificates.find(c => c.certRef === 'C.AUT');
  const deadline = AbortSignal.timeout(60000), stop = AbortSignal.any([prepared.signal, deadline, ...(signal ? [signal] : [])]);
  const stopped = () => {
    if (signal?.aborted || prepared.signal.aborted) connectorFail('ABORTED');
    if (deadline.aborted) connectorFail('TIMEOUT');
  };
  pending.add(connector);
  try {
    const attempt = await KonnektorCertificateClient.prototype.externalAuthenticateSmcb.call(connector, {
      status: prepared.status, certificate: auth.certificate, verification: auth.verification, data: bytes, signal: stop,
    });
    stopped();
    const after = await prepareSmcbPin({ connector, statusClient, expectedTelematikId: prepared.bundle.telematikId,
      requiredRoles: prepared.bundle.professionOids, iccsn, ctId, slotId,
      mandantWide: false, allowPrompt: false, signal: stop });
    // A mandant-wide preflight cannot silently widen the postcheck. An absent
    // workplace card fails closed and must be resolved by host provisioning.
    if (after.state !== 'pin-verified') connectorFail('AUTH_POSTCONDITION');
    if (cardFingerprint(after.bundle.selection.card) !== fingerprint) connectorFail('CARD_CHANGED');
    if (after.bundle.certificates.some((c, i) => c.certificateSha256 !== hashes[i])
      || attempt.certificateSha256 !== auth.certificateSha256 || attempt.dataSha256 !== hash(bytes)) connectorFail('CERTIFICATE_BINDING');
    const revalidate = () => { stopped(); assertPreparedSmcbPin(after, connector, statusClient); connectorSignal(signal); };
    revalidate();
    const result = Object.freeze({ state: 'authentication-signed', attempt, revalidate,
      signatureDer: attempt.signatureDer, signatureJose: attempt.signatureJose,
      dataSha256: attempt.dataSha256, certificateSha256: attempt.certificateSha256,
      identityStatus: 'unverified', deliveryStatus: 'held-for-trust-validation' });
    signatures.set(result, { connector, statusClient, revalidate }); return result;
  } catch (e) {
    stopped();
    if (e instanceof KonnektorError) throw e;
    connectorFail('AUTH_UNAVAILABLE');
  } finally { pending.delete(connector); bytes.fill(0); }
}

export function assertSmcbAuthentication(result, connector, statusClient, data) {
  const record = signatures.get(result);
  if (!record || record.connector !== connector || record.statusClient !== statusClient
    || !(data instanceof Uint8Array) || !data.length || data.length > 16384 || hash(data) !== result.dataSha256) connectorFail('EVIDENCE_BINDING');
  record.revalidate(); return result;
}

/** Held X-KIM-Auth artifact. Sender address/Telematik-ID binding still needs a
 * current VZD result in the outbound host; this function never sends a token.
 */
export async function createSmcbKimAuth(input = {}) {
  options(input, ['sender', 'cmVersion']);
  const { connector, statusClient, prepared, sender, cmVersion, signal } = input;
  connectorSignal(signal); assertPreparedSmcbPin(prepared, connector, statusClient);
  const auth = prepared.bundle.certificates.find(c => c.certRef === 'C.AUT');
  let unsigned;
  try { unsigned = buildEccKimAuthInput({ sender, cmVersion, certificate: auth.certificate, now: prepared.status.checkedAt }); }
  catch { connectorFail('AUTH_INPUT'); }
  const bytes = Buffer.from(unsigned.data);
  try {
    const signature = await signSmcbAuthentication({ connector, statusClient, prepared, data: bytes, signal });
    const header = `Bearer ${unsigned.data}.${signature.signatureJose}`;
    const revalidate = () => assertSmcbAuthentication(signature, connector, statusClient, Buffer.from(unsigned.data));
    revalidate();
    const result = Object.freeze({ state: 'authentication-token-created', header, tokenId: unsigned.tokenId,
      sender: unsigned.sender, cmVersion, certificateSha256: signature.certificateSha256, signature, revalidate,
      senderBinding: 'unverified', identityStatus: 'unverified', deliveryStatus: 'held-for-trust-validation' });
    tokens.set(result, { connector, statusClient, revalidate }); return result;
  } finally { bytes.fill(0); }
}

export function assertSmcbKimAuth(result, connector, statusClient) {
  const record = tokens.get(result);
  if (!record || record.connector !== connector || record.statusClient !== statusClient) connectorFail('EVIDENCE_BINDING');
  record.revalidate(); return result;
}
