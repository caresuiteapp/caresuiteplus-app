import { KonnektorCertificateClient, assertSmcbPinVerified } from './connector-certificates.mjs';
import { readAndVerifySmcb } from './connector-smcb.mjs';
import { cardFingerprint } from './connector-cards.mjs';
import { KonnektorError, connectorFail, connectorSignal } from './connector-error.mjs';

const pending = new WeakSet(), prepared = new WeakMap();
const allowed = ['connector', 'statusClient', 'expectedTelematikId', 'requiredRoles', 'iccsn', 'ctId', 'slotId', 'mandantWide', 'signal', 'allowPrompt'];

/** Preflight only: no signature, decryption, authentication or delivery. PIN
 * input belongs to the terminal; an explicit allowPrompt permits one attempt.
 */
export async function prepareSmcbPin(input = {}) {
  if (!input || typeof input !== 'object' || Object.keys(input).some(k => !allowed.includes(k))) connectorFail('INPUT');
  const { connector, statusClient, signal, allowPrompt = false } = input;
  if (typeof allowPrompt !== 'boolean') connectorFail('INPUT');
  connectorSignal(signal);
  if (!(connector instanceof KonnektorCertificateClient)) connectorFail('CONFIGURATION');
  if (pending.has(connector)) connectorFail('PIN_BUSY');
  const config = { ...input, requiredRoles: Array.isArray(input.requiredRoles) ? [...input.requiredRoles] : input.requiredRoles };
  delete config.allowPrompt;
  const deadline = AbortSignal.timeout(240000), stop = signal ? AbortSignal.any([signal, deadline]) : deadline;
  config.signal = stop;
  pending.add(connector);
  const stopped = () => {
    if (signal?.aborted) connectorFail('ABORTED');
    if (deadline.aborted) connectorFail('TIMEOUT');
  };
  try {
    let bundle = await readAndVerifySmcb(config);
    let status = await KonnektorCertificateClient.prototype.getSmcbPinStatus.call(connector, { selection: bundle.selection, signal: stop });
    bundle.revalidate(); stopped();
    let attempt;
    if (status.pinStatus !== 'VERIFIED') {
      const blocked = status.pinStatus === 'BLOCKED';
      if (status.pinStatus !== 'VERIFIABLE' || !allowPrompt) return Object.freeze({ state: blocked ? 'pin-blocked'
        : status.pinStatus === 'VERIFIABLE' ? 'pin-required' : 'pin-initialization-required', pinStatus: status.pinStatus,
        leftTries: status.leftTries, identityStatus: 'unverified', deliveryStatus: 'held-for-trust-validation' });
      const fingerprint = cardFingerprint(bundle.selection.card);
      const expectedCerts = bundle.certificates.map(c => c.certificateSha256);
      const { iccsn, ctId, slotId } = bundle.selection.card;
      attempt = await KonnektorCertificateClient.prototype.verifySmcbPin.call(connector, { status, signal: stop });
      stopped();
      if (attempt.pinResult !== 'OK') return Object.freeze({ state: attempt.pinResult === 'REJECTED' ? 'pin-rejected'
        : attempt.pinResult === 'TRANSPORT_PIN' ? 'pin-initialization-required' : 'pin-blocked',
        pinResult: attempt.pinResult, leftTries: attempt.leftTries, identityStatus: 'unverified', deliveryStatus: 'held-for-trust-validation' });
      // Discard pre-prompt evidence; refresh all three actual certificates and
      // both local and connector status proofs after the potentially long wait.
      bundle = await readAndVerifySmcb({ ...config, iccsn, ctId, slotId });
      if (cardFingerprint(bundle.selection.card) !== fingerprint) connectorFail('CARD_CHANGED');
      if (bundle.certificates.some((c, i) => c.certificateSha256 !== expectedCerts[i])) connectorFail('CERTIFICATE_BINDING');
      status = await KonnektorCertificateClient.prototype.getSmcbPinStatus.call(connector, { selection: bundle.selection, signal: stop });
    }
    const revalidate = () => {
      stopped(); bundle.revalidate(); assertSmcbPinVerified(status, connector, bundle.selection);
    };
    revalidate();
    const result = Object.freeze({ state: 'pin-verified', bundle, status, ...(attempt ? { attempt } : {}), revalidate,
      identityStatus: 'unverified', deliveryStatus: 'held-for-trust-validation' });
    prepared.set(result, { connector, statusClient, revalidate }); return result;
  } catch (e) {
    stopped();
    if (e instanceof KonnektorError) throw e;
    connectorFail('PIN_UNAVAILABLE');
  } finally { pending.delete(connector); }
}

export function assertPreparedSmcbPin(result, connector, statusClient) {
  const record = prepared.get(result);
  if (!record || record.connector !== connector || record.statusClient !== statusClient) connectorFail('EVIDENCE_BINDING');
  record.revalidate(); return result;
}
