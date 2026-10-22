import { KonnektorCertificateClient, assertConnectorCertificate, assertSelectedSmcb } from './connector-certificates.mjs';
import { cardFilters, cardSelector, cardFingerprint } from './connector-cards.mjs';
import { connectorFail, connectorSignal, KonnektorError } from './connector-error.mjs';
import { TslOcspStatusClient } from './tsl-ocsp.mjs';
import { validTelematikId } from './certificate-admission.mjs';
import { canonicalOid } from './der-oid.mjs';

const profiles = Object.freeze({
  'C.AUT': { purpose: 'authentication', type: '1.2.276.0.76.4.77' },
  'C.ENC': { purpose: 'encryption', type: '1.2.276.0.76.4.76' },
  'C.SIG': { purpose: 'signing', type: '1.2.276.0.76.4.78' },
});

/** Fresh selection -> real DER -> local TSL/OCSP -> Konnektor -> fresh selection.
 * The host must provision the intended institution ID and roles. No PIN/key
 * operation or delivery permission is inferred from a card name or ICCSN.
 */
export async function readAndVerifySmcb({ connector, statusClient, expectedTelematikId, requiredRoles,
  iccsn, ctId, slotId, mandantWide = false, signal } = {}) {
  connectorSignal(signal);
  try {
    if (!(connector instanceof KonnektorCertificateClient) || !(statusClient instanceof TslOcspStatusClient)
      || connector.environment !== statusClient.environment || !validTelematikId(expectedTelematikId)
      || !Array.isArray(requiredRoles) || !requiredRoles.length || requiredRoles.length > 32
      || new Set(requiredRoles).size !== requiredRoles.length
      || Array.from(requiredRoles).some(r => !canonicalOid(r) || r.length > 100)) connectorFail('CONFIGURATION');
  } catch { connectorFail('CONFIGURATION'); }
  const roles = Object.freeze([...requiredRoles]), selector = cardSelector({ iccsn, ctId, slotId });
  const filters = cardFilters({ ctId, slotId, cardType: 'SMC-B', mandantWide });
  const deadline = AbortSignal.timeout(30000), stop = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const stopped = () => {
    if (signal?.aborted) connectorFail('ABORTED');
    if (deadline.aborted) connectorFail('TIMEOUT');
  };
  try {
    const snapshot = await KonnektorCertificateClient.prototype.getCards.call(connector, { ...filters, signal: stop });
    const selected = KonnektorCertificateClient.prototype.selectSmcb.call(connector, snapshot, selector);
    const fingerprint = cardFingerprint(selected.card);
    const read = await KonnektorCertificateClient.prototype.readCardCertificates.call(connector,
      { cardHandle: selected.card.cardHandle, certRefs: Object.keys(profiles), crypt: 'ECC', signal: stop });
    assertSelectedSmcb(selected, connector); stopped();
    if (read.certificates.some(c => c.state !== 'read')) connectorFail('CERTIFICATE_MISSING');
    const results = [], checks = [];
    for (const item of read.certificates) {
      const { purpose, type } = profiles[item.certRef];
      const local = await TslOcspStatusClient.prototype.check.call(statusClient, { certificate: item.certificate, purpose, signal: stop });
      assertSelectedSmcb(selected, connector); stopped();
      const localCheck = () => {
        let current;
        try { current = local.verifier.verify({ certificate: item.certificate, request: local.request, response: local.response }); }
        catch { connectorFail('SMCB_STATUS'); }
        if (current.status !== 'good') connectorFail('SMCB_STATUS');
        if (local.certificateTypeOid !== type || local.admission.telematikId !== expectedTelematikId
          || !roles.every(r => local.admission.professionOids.includes(r))) connectorFail('SMCB_IDENTITY');
      };
      localCheck();
      const proof = await KonnektorCertificateClient.prototype.verifyCertificate.call(connector,
        { certificate: item.certificate, requiredRoles: local.admission.professionOids, signal: stop });
      const check = () => {
        localCheck();
        assertConnectorCertificate(proof, connector, { certificate: item.certificate, requiredRoles: local.admission.professionOids });
      };
      check(); assertSelectedSmcb(selected, connector); stopped(); checks.push(check);
      results.push(Object.freeze({ ...item, purpose, certificateTypeOid: type, admission: local.admission, verification: proof }));
    }
    // A failed refresh invalidates the previous selection, too. Do not change
    // scope, retry a different card, or retain its old handle on an empty result.
    assertSelectedSmcb(selected, connector);
    const latest = await KonnektorCertificateClient.prototype.getCards.call(connector, { ...filters, signal: stop });
    const confirmed = KonnektorCertificateClient.prototype.selectSmcb.call(connector, latest,
      { iccsn: selected.card.iccsn, ctId: selected.card.ctId, slotId: selected.card.slotId });
    if (cardFingerprint(confirmed.card) !== fingerprint) connectorFail('CARD_CHANGED');
    const revalidate = () => {
      stopped(); assertSelectedSmcb(confirmed, connector);
      for (const check of checks) check();
    };
    revalidate();
    return Object.freeze({ selection: confirmed, certificates: Object.freeze(results), revalidate,
      telematikId: expectedTelematikId, professionOids: roles, readResponseSha256: read.responseSha256,
      identityStatus: 'unverified', deliveryStatus: 'held-for-trust-validation' });
  } catch (e) {
    stopped();
    if (e instanceof KonnektorError) throw e;
    // Do not leak native TLS, certificate fields, SOAP text or TSL details.
    connectorFail('SMCB_STATUS');
  }
}
