import { KonnektorCertificateClient, assertSmcbPinVerified, assertSmcbPinStatus } from './connector-certificates.mjs';
import { readAndVerifySmcb } from './connector-smcb.mjs';
import { cardFingerprint } from './connector-cards.mjs';
import { KonnektorError, KonnektorPinMaintenanceError, connectorFail, connectorSignal } from './connector-error.mjs';

const pending = new WeakSet(), prepared = new WeakMap(), maintained = new WeakMap();
const allowed = ['connector', 'statusClient', 'expectedTelematikId', 'requiredRoles', 'iccsn', 'ctId', 'slotId', 'mandantWide', 'signal', 'allowPrompt'];
const maintenanceStates = Object.freeze({ initialize: ['TRANSPORT_PIN', 'EMPTY_PIN'], change: ['VERIFIABLE', 'VERIFIED'], unblock: ['BLOCKED'] });

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
    const result = Object.freeze({ state: 'pin-verified', bundle, status, signal: stop, ...(attempt ? { attempt } : {}), revalidate,
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

/** One explicitly requested management action, optionally inspected without
 * prompting. Never chains ChangePin, UnblockPin or VerifyPin automatically.
 */
export async function maintainSmcbPin(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(k => ![...allowed, 'action', 'setNewPin'].includes(k))) connectorFail('INPUT');
  const { connector, statusClient, signal, action, setNewPin, allowPrompt = false } = input;
  if (typeof action !== 'string' || !Object.hasOwn(maintenanceStates, action) || typeof allowPrompt !== 'boolean'
    || (action === 'unblock' ? typeof setNewPin !== 'boolean' : Object.hasOwn(input, 'setNewPin'))) connectorFail('INPUT');
  connectorSignal(signal);
  if (!(connector instanceof KonnektorCertificateClient)) connectorFail('CONFIGURATION');
  if (pending.has(connector)) connectorFail('PIN_BUSY');
  const config = { ...input, requiredRoles: Array.isArray(input.requiredRoles) ? [...input.requiredRoles] : input.requiredRoles };
  for (const key of ['action', 'setNewPin', 'allowPrompt']) delete config[key];
  const deadline = AbortSignal.timeout(240000), stop = signal ? AbortSignal.any([signal, deadline]) : deadline;
  config.signal = stop;
  const stopped = () => {
    if (signal?.aborted) connectorFail('ABORTED');
    if (deadline.aborted) connectorFail('TIMEOUT');
  };
  pending.add(connector);
  let attempt;
  const operation = action === 'unblock' ? 'UnblockPin' : 'ChangePin';
  const detail = Object.freeze({ action, ...(action === 'unblock' ? { setNewPin } : {}),
    identityStatus: 'unverified', deliveryStatus: 'held-for-trust-validation' });
  try {
    const before = await readAndVerifySmcb(config);
    const status = await KonnektorCertificateClient.prototype.getSmcbPinStatus.call(connector, { selection: before.selection, signal: stop });
    before.revalidate(); stopped();
    if (!maintenanceStates[action].includes(status.pinStatus)) connectorFail('PIN_MAINTENANCE_STATE');
    if (action === 'unblock' && status.pukState === 'blocked') return Object.freeze({ ...detail,
      state: 'puk-blocked', retryCounter: 'puk', leftTries: null });
    if (!allowPrompt) return Object.freeze({ ...detail, state: 'pin-maintenance-required', pinStatus: status.pinStatus,
      pinLeftTries: status.leftTries, card: before.selection.card });
    const fingerprint = cardFingerprint(before.selection.card), hashes = before.certificates.map(c => c.certificateSha256);
    const { iccsn, ctId, slotId } = before.selection.card;
    attempt = action === 'unblock'
      ? await KonnektorCertificateClient.prototype.unblockSmcbPin.call(connector, { status, setNewPin, signal: stop })
      : await KonnektorCertificateClient.prototype.changeSmcbPin.call(connector, { status, mode: action, signal: stop });
    stopped();
    if (attempt.pinResult !== 'OK') return Object.freeze({ ...detail,
      state: (action === 'unblock' ? 'puk-' : 'pin-') + (attempt.pinResult === 'REJECTED' ? 'rejected' : 'blocked'),
      pinResult: attempt.pinResult, retryCounter: attempt.retryCounter, leftTries: attempt.leftTries });
    const bundle = await readAndVerifySmcb({ ...config, iccsn, ctId, slotId });
    if (cardFingerprint(bundle.selection.card) !== fingerprint) connectorFail('CARD_CHANGED');
    if (bundle.certificates.some((c, i) => c.certificateSha256 !== hashes[i])) connectorFail('CERTIFICATE_BINDING');
    const after = await KonnektorCertificateClient.prototype.getSmcbPinStatus.call(connector, { selection: bundle.selection, signal: stop });
    const revalidate = () => {
      stopped(); bundle.revalidate(); assertSmcbPinStatus(after, connector, bundle.selection);
      if (!['VERIFIABLE', 'VERIFIED'].includes(after.pinStatus)) connectorFail('PIN_POSTCONDITION');
    };
    revalidate();
    const result = Object.freeze({ ...detail, state: 'pin-maintained', bundle, status: after, attempt, revalidate,
      requiresVerification: after.pinStatus !== 'VERIFIED' });
    maintained.set(result, { connector, statusClient, revalidate }); return result;
  } catch (e) {
    let cause = e;
    try { stopped(); } catch (stoppedError) { cause = stoppedError; }
    if (e instanceof KonnektorPinMaintenanceError) throw e;
    if (attempt?.pinResult === 'OK') throw new KonnektorPinMaintenanceError(operation, cause?.code, cause instanceof KonnektorError ? cause.remoteCodes : []);
    if (cause instanceof KonnektorError) throw cause;
    connectorFail('PIN_UNAVAILABLE');
  } finally { pending.delete(connector); }
}

/** Confirms only the observed management result, never key-operation readiness. */
export function assertMaintainedSmcbPin(result, connector, statusClient) {
  const record = maintained.get(result);
  if (!record || record.connector !== connector || record.statusClient !== statusClient) connectorFail('EVIDENCE_BINDING');
  record.revalidate(); return result;
}
