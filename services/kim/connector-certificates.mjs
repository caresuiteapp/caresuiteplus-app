import { randomUUID } from 'node:crypto';
import { DOCUMENT_OPERATIONS } from './connector-document-xml.mjs';
import { eccCmsCertificate, prepareEccKimRecipients, verifyEccKimSignedContent } from './ecc-cms.mjs';
import { readKimEnvelope } from './envelope.mjs';
import { decodeKimMimeEntity } from './message.mjs';
import { kimAddress } from './address.mjs';
import { createHash, X509Certificate } from 'node:crypto';
import { KonnektorHttpsTransport } from './connector-http.mjs';
import { certificateRequest, inspectConnectorXml, connectorText, CERT_REFS, PIN_OPERATIONS } from './connector-xml.mjs';
import { canonicalOid } from './der-oid.mjs';
import { KonnektorError, KonnektorPinMaintenanceError, connectorFail, connectorSignal } from './connector-error.mjs';
import { cardFilters, cardSelector, checkedCards, selectSmcbCard } from './connector-cards.mjs';
import { eccAutCertificate } from './message-auth.mjs';
import { verifySmcbAuthenticationSignature } from './connector-auth-signature.mjs';

export { KonnektorError } from './connector-error.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const evidence = new WeakMap();
const cardSnapshots = new WeakMap(), cardSelections = new WeakMap();
const pinStatuses = new WeakMap();
const documentFailures = new WeakMap();
function pinOptions(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) connectorFail('INPUT');
}
function certificate(input) {
  try {
    if (!(input instanceof Uint8Array) || !input.length || input.length > 12000) connectorFail('CERTIFICATE');
    const c = new X509Certificate(input);
    if (!c.raw.equals(Buffer.from(input))) connectorFail('CERTIFICATE');
    return c;
  } catch { connectorFail('CERTIFICATE'); }
}
function roles(input) {
  if (!Array.isArray(input) || input.length > 32 || new Set(input).size !== input.length) connectorFail('INPUT');
  if (Array.from(input).some(value => !canonicalOid(value) || value.length > 100)) connectorFail('INPUT');
  return [...input];
}
function references(input) {
  if (!Array.isArray(input) || !input.length || input.length > 4 || new Set(input).size !== input.length || input.some(r => !CERT_REFS.includes(r))) connectorFail('INPUT');
  return [...input];
}

/** CertificateService 6.0.1/6.0.2, current-time verification only. An externally
 * reported VALID is bound to the actual HTTPS exchange, certificate and context;
 * it never changes CareSuite's diagnostic-only or production-release gates.
 */
export class KonnektorCertificateClient {
  #transport; #eventTransport; #cardTransport; #authTransport; #signatureTransport; #encryptionTransport; #context; #contextHash; #environment; #python; #clock; #timeout; #cardGeneration = 0;
  #pinTimeout; #pinGeneration = 0; #pinBusy = false; #pinUncertain = false;
  #authBusy = false; #authUncertain = false; #cmsBusy = false; #cmsUncertain = false;
  #blockedPuks = new Set();
  #closed = false; #pending = new Set();
  constructor({ context, environment, eventServiceUrl, cardServiceUrl, authSignatureServiceUrl, signatureServiceUrl, encryptionServiceUrl, pinTimeoutMs = 120000, python = 'python3', clock = Date.now, timeoutMs = 10000, ...route }) {
    try {
      if (!context || !['test', 'production'].includes(environment) || typeof clock !== 'function'
        || typeof python !== 'string' || !python.length || python.length > 2048 || /[\x00-\x1f]/.test(python)
        || !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30000
        || !Number.isInteger(pinTimeoutMs) || pinTimeoutMs < 50 || pinTimeoutMs > 180000
        || Object.keys(context).some(k => !['mandantId', 'clientSystemId', 'workplaceId', 'userId'].includes(k))) connectorFail('CONFIGURATION');
      this.#context = Object.freeze({ mandantId: connectorText(context.mandantId), clientSystemId: connectorText(context.clientSystemId),
        workplaceId: connectorText(context.workplaceId), ...(context.userId === undefined ? {} : { userId: connectorText(context.userId) }) });
      this.#contextHash = hash(Buffer.from(JSON.stringify(this.#context))); this.#environment = environment;
      this.#clock = clock; this.#python = python; this.#timeout = timeoutMs; this.#pinTimeout = pinTimeoutMs;
      for (const url of [eventServiceUrl, cardServiceUrl, authSignatureServiceUrl, signatureServiceUrl, encryptionServiceUrl]) {
        if (url !== undefined && (typeof url !== 'string' || new URL(url).origin !== new URL(route.url).origin)) connectorFail('CONFIGURATION');
      }
      this.#now(); this.#transport = new KonnektorHttpsTransport({ ...route, service: 'certificate' });
      if (eventServiceUrl !== undefined) this.#eventTransport = new KonnektorHttpsTransport({ ...route, url: eventServiceUrl, service: 'event' });
      if (cardServiceUrl !== undefined) this.#cardTransport = new KonnektorHttpsTransport({ ...route, url: cardServiceUrl, service: 'card' });
      if (authSignatureServiceUrl !== undefined) this.#authTransport = new KonnektorHttpsTransport({ ...route, url: authSignatureServiceUrl, service: 'authentication' });
      if (signatureServiceUrl !== undefined) this.#signatureTransport = new KonnektorHttpsTransport({ ...route, url: signatureServiceUrl, service: 'signature' });
      if (encryptionServiceUrl !== undefined) this.#encryptionTransport = new KonnektorHttpsTransport({ ...route, url: encryptionServiceUrl, service: 'encryption' });
    } catch { this.#transport?.close(); this.#eventTransport?.close(); this.#cardTransport?.close(); this.#authTransport?.close(); this.#signatureTransport?.close(); this.#encryptionTransport?.close(); connectorFail('CONFIGURATION'); }
    Object.freeze(this);
  }
  get environment() { return this.#environment; }
  #now() { const now = this.#clock(); if (!Number.isSafeInteger(now) || now < 0) connectorFail('CLOCK'); return now; }
  #open() { if (this.#closed) connectorFail('CLOSED'); }
  async #exchange(operation, input, signal, timeout = this.#timeout, beforeSend) {
    this.#open(); connectorSignal(signal);
    const pin = operation === 'GetPinStatus' || PIN_OPERATIONS.includes(operation);
    const auth = operation === 'ExternalAuthenticate';
    const cms = DOCUMENT_OPERATIONS.includes(operation);
    const transport = cms ? (['GetJobNumber', 'SignDocument', 'VerifyDocument'].includes(operation) ? this.#signatureTransport : this.#encryptionTransport) : operation === 'GetCards' ? this.#eventTransport : pin ? this.#cardTransport : auth ? this.#authTransport : this.#transport;
    if (!transport) connectorFail(cms ? 'CMS_UNCONFIGURED' : pin ? 'CARD_UNCONFIGURED' : auth ? 'AUTH_UNCONFIGURED' : 'EVENT_UNCONFIGURED');
    if (this.#pending.size >= 8) connectorFail('BUSY');
    const controller = new AbortController(), deadline = AbortSignal.timeout(timeout);
    const stop = AbortSignal.any([controller.signal, deadline, ...(signal ? [signal] : [])]);
    const startedAt = this.#now(); this.#pending.add(controller);
    let request, response;
    try {
      request = certificateRequest(operation, this.#context, input);
      await inspectConnectorXml(request, { operation, mode: 'request', python: this.#python, signal: stop });
      beforeSend?.();
      response = await KonnektorHttpsTransport.prototype.request.call(transport, operation, request, { signal: stop, timeoutMs: timeout });
      const parsed = await inspectConnectorXml(response.bytes, { operation, mode: 'response', python: this.#python, signal: stop });
      this.#open(); connectorSignal(stop);
      if (parsed.kind === 'fault') throw new KonnektorError('KIM_CONNECTOR_SOAP_FAULT', parsed.remoteCodes);
      if (response.statusCode !== 200) connectorFail('HTTP_STATUS');
      const checkedAt = this.#now();
      if (checkedAt < startedAt || checkedAt - startedAt > timeout) connectorFail('CLOCK');
      return { parsed, metadata: Object.freeze({ operation, requestSha256: hash(request), responseSha256: hash(response.bytes),
        routeSha256: transport.routeSha256, contextSha256: this.#contextHash, environment: this.#environment,
        startedAt, checkedAt, identityStatus: 'unverified', source: 'configured-konnektor' }) };
    } catch (e) {
      this.#open();
      if (signal?.aborted) connectorFail('ABORTED');
      if (deadline.aborted) connectorFail('TIMEOUT');
      if (e instanceof KonnektorError) throw e;
      connectorFail('UNAVAILABLE');
    } finally { this.#pending.delete(controller); request?.fill(0); response?.bytes?.fill(0); }
  }
  async getCards({ ctId, slotId, cardType, mandantWide = false, signal } = {}) {
    this.#open(); connectorSignal(signal);
    const filters = cardFilters({ ctId, slotId, cardType, mandantWide }), generation = ++this.#cardGeneration;
    const { parsed, metadata } = await this.#exchange('GetCards', filters, signal);
    if (generation !== this.#cardGeneration) connectorFail('CARD_SNAPSHOT_STALE');
    const snapshot = Object.freeze({ ...metadata, filters, cards: checkedCards(parsed.cards, filters), validUntil: metadata.checkedAt + 30000 });
    const assert = () => {
      this.#open(); connectorSignal(signal);
      if (generation !== this.#cardGeneration) connectorFail('CARD_SNAPSHOT_STALE');
      const now = this.#now();
      if (now < metadata.checkedAt || now >= snapshot.validUntil) connectorFail('EVIDENCE_EXPIRED');
    };
    cardSnapshots.set(snapshot, { client: this, assert });
    return snapshot;
  }
  selectSmcb(snapshot, selector = {}) {
    this.#open(); const stored = cardSnapshots.get(snapshot);
    if (!stored || stored.client !== this) connectorFail('EVIDENCE_BINDING');
    stored.assert();
    const card = selectSmcbCard(snapshot.cards, cardSelector(selector));
    const selection = Object.freeze({ card, snapshotSha256: snapshot.responseSha256, routeSha256: snapshot.routeSha256,
      contextSha256: snapshot.contextSha256, environment: this.#environment, checkedAt: snapshot.checkedAt,
      validUntil: snapshot.validUntil, identityStatus: 'unverified' });
    cardSelections.set(selection, stored); return selection;
  }
  #pinOpen(requireCard = true) {
    this.#open();
    if (requireCard && !this.#cardTransport) connectorFail('CARD_UNCONFIGURED');
    if (this.#pinBusy) connectorFail('PIN_BUSY');
    if (this.#pinUncertain) connectorFail('PIN_OUTCOME_UNKNOWN');
    if (this.#authBusy) connectorFail('AUTH_BUSY');
    if (this.#authUncertain) connectorFail('AUTH_OUTCOME_UNKNOWN');
    if (this.#cmsBusy) connectorFail('CMS_BUSY');
    if (this.#cmsUncertain) connectorFail('CMS_OUTCOME_UNKNOWN');
  }
  async getSmcbPinStatus(input = {}) {
    pinOptions(input, ['selection', 'signal']);
    const { selection, signal } = input;
    this.#pinOpen(); connectorSignal(signal); assertSelectedSmcb(selection, this);
    const generation = ++this.#pinGeneration;
    const { parsed, metadata } = await this.#exchange('GetPinStatus', { cardHandle: selection.card.cardHandle }, signal);
    assertSelectedSmcb(selection, this);
    if (generation !== this.#pinGeneration) connectorFail('PIN_STATUS_STALE');
    const result = Object.freeze({ ...metadata, selection, pinTyp: 'PIN.SMC', pinStatus: parsed.pinStatus,
      leftTries: parsed.leftTries, pukState: this.#blockedPuks.has(selection.card.iccsn) ? 'blocked' : 'unknown',
      execution: parsed.execution, validUntil: Math.min(selection.validUntil, metadata.checkedAt + 30000) });
    const assert = () => {
      this.#pinOpen(); connectorSignal(signal); assertSelectedSmcb(selection, this);
      if (generation !== this.#pinGeneration) connectorFail('PIN_STATUS_STALE');
      const now = this.#now();
      if (now < metadata.checkedAt || now >= result.validUntil) connectorFail('EVIDENCE_EXPIRED');
    };
    pinStatuses.set(result, { client: this, selection, signal, assert }); return result;
  }
  /** One explicit terminal attempt. No PIN value, automatic retry or software
   * entry path. The response alone is never a key-operation authorization.
   */
  async verifySmcbPin(input = {}) {
    pinOptions(input, ['status', 'signal']);
    const { status, signal } = input;
    return this.#pinAttempt('VerifyPin', status, signal, ['VERIFIABLE'], 'PIN_NOT_VERIFIABLE');
  }
  async changeSmcbPin(input = {}) {
    pinOptions(input, ['status', 'mode', 'signal']);
    const { status, mode, signal } = input;
    if (!['initialize', 'change'].includes(mode)) connectorFail('INPUT');
    return this.#pinAttempt('ChangePin', status, signal,
      mode === 'initialize' ? ['TRANSPORT_PIN', 'EMPTY_PIN'] : ['VERIFIABLE', 'VERIFIED'], 'PIN_MAINTENANCE_STATE', { mode });
  }
  async unblockSmcbPin(input = {}) {
    pinOptions(input, ['status', 'setNewPin', 'signal']);
    const { status, setNewPin, signal } = input;
    if (typeof setNewPin !== 'boolean') connectorFail('INPUT');
    return this.#pinAttempt('UnblockPin', status, signal, ['BLOCKED'], 'PIN_MAINTENANCE_STATE', { setNewPin });
  }
  async #pinAttempt(operation, status, signal, allowedStatuses, stateError, options = {}) {
    this.#pinOpen(); connectorSignal(signal);
    const stored = pinStatuses.get(status);
    if (!stored || stored.client !== this) connectorFail('EVIDENCE_BINDING');
    stored.assert();
    if (!allowedStatuses.includes(status.pinStatus)) connectorFail(stateError);
    const iccsn = stored.selection.card.iccsn;
    if (operation === 'UnblockPin' && this.#blockedPuks.has(iccsn)) connectorFail('PIN_PUK_BLOCKED');
    const cardGeneration = this.#cardGeneration;
    ++this.#pinGeneration; this.#pinBusy = true; this.#pinUncertain = true;
    try {
      const { parsed, metadata } = await this.#exchange(operation, { cardHandle: stored.selection.card.cardHandle,
        ...(operation === 'UnblockPin' ? { setNewPin: options.setNewPin } : {}) }, signal, this.#pinTimeout);
      if (parsed.pinResult === 'ERROR') throw new KonnektorError('KIM_CONNECTOR_PIN_ERROR', parsed.remoteCodes);
      this.#pinUncertain = false;
      if (operation === 'UnblockPin' && ['WASBLOCKED', 'NOWBLOCKED'].includes(parsed.pinResult)) this.#blockedPuks.add(iccsn);
      // A human PIN entry may outlive the old 30s snapshot. Only an observation
      // is returned; the workflow must reacquire card/certificates/status.
      if (cardGeneration !== this.#cardGeneration) {
        if (operation !== 'VerifyPin' && parsed.pinResult === 'OK') {
          throw new KonnektorPinMaintenanceError(operation, 'KIM_CONNECTOR_CARD_SNAPSHOT_STALE');
        }
        connectorFail('CARD_SNAPSHOT_STALE');
      }
      return Object.freeze({ ...metadata, pinTyp: 'PIN.SMC', pinResult: parsed.pinResult, leftTries: parsed.leftTries,
        retryCounter: operation === 'UnblockPin' ? 'puk' : 'pin', ...options,
        execution: parsed.execution, deliveryStatus: 'held-for-trust-validation' });
    } finally { this.#pinBusy = false; }
  }
  /** Low-level authentication only. A prepared workflow supplies the bound
   * status/certificate; callers still need the post-operation trust checks.
   * Consume the PIN observation even on failure; never retry or switch keys.
   */
  async externalAuthenticateSmcb(input = {}) {
    pinOptions(input, ['status', 'certificate', 'verification', 'data', 'signal']);
    const { status, certificate: raw, verification, data, signal } = input;
    this.#pinOpen(); connectorSignal(signal);
    if (!this.#authTransport) connectorFail('AUTH_UNCONFIGURED');
    const stored = pinStatuses.get(status);
    if (!stored || stored.client !== this) connectorFail('EVIDENCE_BINDING');
    assertSmcbPinVerified(status, this, stored.selection);
    if (!(data instanceof Uint8Array) || !data.length || data.length > 16384) connectorFail('INPUT');
    let cert;
    try { cert = eccAutCertificate(raw, this.#now(), '1.2.276.0.76.4.77'); } catch { connectorFail('AUTH_CERTIFICATE'); }
    assertConnectorCertificate(verification, this, { certificate: cert.raw });
    const bytes = Buffer.from(data), digest = createHash('sha256').update(bytes).digest();
    const generation = ++this.#pinGeneration;
    this.#authBusy = true; this.#authUncertain = true;
    let signature, jose;
    const bound = () => {
      assertSelectedSmcb(stored.selection, this);
      if (generation !== this.#pinGeneration) connectorFail('PIN_STATUS_STALE');
      connectorSignal(stored.signal);
      const now = this.#now();
      if (now < status.checkedAt || now >= status.validUntil) connectorFail('EVIDENCE_EXPIRED');
      assertConnectorCertificate(verification, this, { certificate: cert.raw });
    };
    try {
      const { parsed, metadata } = await this.#exchange('ExternalAuthenticate', {
        cardHandle: stored.selection.card.cardHandle, digest,
      }, stored.signal ? AbortSignal.any([stored.signal, ...(signal ? [signal] : [])]) : signal, this.#timeout, bound);
      bound();
      signature = Buffer.from(parsed.signature, 'base64');
      jose = verifySmcbAuthenticationSignature(signature, bytes, cert);
      this.#authUncertain = false;
      return Object.freeze({ ...metadata, execution: parsed.execution, signatureType: parsed.signatureType,
        dataSha256: digest.toString('hex'), certificateSha256: hash(cert.raw),
        signatureDer: signature.toString('base64'), signatureJose: jose.toString('base64url'),
        deliveryStatus: 'held-for-trust-validation' });
    } finally { this.#authBusy = false; bytes.fill(0); digest.fill(0); signature?.fill(0); jose?.fill(0); }
  }
  signSmcbDocument(input = {}) { return this.#documentOperation('SignDocument', input); }
  encryptSmcbDocument(input = {}) { return this.#documentOperation('EncryptDocument', input); }
  decryptSmcbDocument(input = {}) { return this.#documentOperation('DecryptDocument', input); }
  /** Read-only nonQES verification, bound to the independently checked CMS.
   * No PIN prompt, private-key operation or automatic retry. */
  async verifySmcbDocument(input = {}) {
    pinOptions(input, ['data', 'certificate', 'verification', 'recipientEmails', 'signal']);
    const { data, certificate: raw, verification, recipientEmails, signal } = input;
    this.#pinOpen(false); connectorSignal(signal);
    if (!this.#signatureTransport) connectorFail('CMS_UNCONFIGURED');
    if (!(data instanceof Uint8Array) || !data.length || data.length > 22020096
      || !(recipientEmails instanceof Uint8Array) || !recipientEmails.length || recipientEmails.length > 262144) connectorFail('INPUT');
    const bytes = Buffer.from(data), emails = Buffer.from(recipientEmails);
    let checked, cert;
    try {
      try {
        cert = eccCmsCertificate(raw, 'osig', this.#now());
        if (cert.certificateTypeOid !== '1.2.276.0.76.4.78') throw new Error();
        checked = verifyEccKimSignedContent({ bytes, recipientEmails: emails, expectedSignerCertificate: cert.cert.raw, now: this.#now() });
      } catch { connectorFail('CMS_VERIFY_INPUT'); }
      const bound = () => { this.#open(); connectorSignal(signal); assertConnectorCertificate(verification, this, { certificate: cert.cert.raw }); };
      bound(); this.#cmsBusy = true;
      try {
        const { parsed, metadata } = await this.#exchange('VerifyDocument', { data: bytes }, signal, this.#timeout, bound);
        bound();
        if (parsed.signatureSha256 !== checked.signatureSha256 || parsed.certificateSha256[0] !== checked.signerSha256) connectorFail('CMS_VERIFY_BINDING');
        // CurrentTime is explicitly requested. Both peer time classifications
        // must be contemporaneous, including a bounded five-second clock skew.
        if (!['SYSTEM_TIMESTAMP', 'USER_DEFINED_TIMESTAMP'].includes(parsed.timestampType)
          || [parsed.timestamp, parsed.verificationTime].some(t => !Number.isSafeInteger(t) || t < metadata.startedAt - 5000 || t > metadata.checkedAt + 5000)) connectorFail('CMS_VERIFY_TIME');
        if (parsed.verificationResult !== 'VALID' || !parsed.resultConsistent) {
          const report = Buffer.from(parsed.reportBase64 ?? '', 'base64');
          if (!report.length || report.length > 262144 || hash(report) !== parsed.reportSha256) { report.fill(0); connectorFail('CMS_VERIFY_BINDING'); }
          const failure = new KonnektorError('KIM_CONNECTOR_CMS_VERIFY_' + (parsed.verificationResult === 'INVALID' ? 'INVALID'
            : parsed.verificationResult === 'INCONCLUSIVE' ? 'INCONCLUSIVE' : 'INCONSISTENT'));
          documentFailures.set(failure, { client: this, report, metadata: Object.freeze({ ...metadata,
            dataSha256: hash(bytes), contentSha256: hash(checked.content), certificateSha256: checked.signerSha256,
            signatureSha256: checked.signatureSha256, verificationResult: parsed.verificationResult,
            resultConsistent: parsed.resultConsistent, reportSha256: parsed.reportSha256, reportBinding: 'signature-and-certificate' }) });
          throw failure;
        }
        return Object.freeze({ ...metadata, dataSha256: hash(bytes), contentSha256: hash(checked.content),
          certificateSha256: checked.signerSha256, signatureSha256: checked.signatureSha256,
          verificationResult: 'VALID', verificationTime: parsed.verificationTime, timestampType: parsed.timestampType,
          reportSha256: parsed.reportSha256, reportBinding: 'signature-and-certificate',
          deliveryStatus: 'held-for-trust-validation', profile: 'ecc-cms-diagnostic' });
      } finally { this.#cmsBusy = false; }
    } finally { bytes.fill(0); emails.fill(0); checked?.content.fill(0); }
  }
  /** One held ECC operation. Fresh original PIN/certificate evidence is consumed;
   * ambiguous replies latch the client until explicit host recovery. No retries. */
  async #documentOperation(operation, input) {
    const sign = operation === 'SignDocument', decrypt = operation === 'DecryptDocument';
    pinOptions(input, ['status', 'certificate', 'verification', 'data', 'signal',
      ...(decrypt ? ['address', 'expectedSignerCertificate'] : ['sender', 'recipients'])]);
    const { status, certificate: raw, verification, data, signal } = input;
    this.#pinOpen(); connectorSignal(signal);
    if (!(sign ? this.#signatureTransport : this.#encryptionTransport)) connectorFail('CMS_UNCONFIGURED');
    const stored = pinStatuses.get(status);
    if (!stored || stored.client !== this) connectorFail('EVIDENCE_BINDING');
    assertSmcbPinVerified(status, this, stored.selection);
    if (!(data instanceof Uint8Array) || !data.length || data.length > (sign ? 15000000 : 22020096)) connectorFail('INPUT');
    let cert, recipientSet, envelope, expectedSigner;
    try {
      cert = eccCmsCertificate(raw, sign ? 'osig' : 'enc', this.#now());
      if (cert.certificateTypeOid !== (sign ? '1.2.276.0.76.4.78' : '1.2.276.0.76.4.76')) throw new Error();
      if (decrypt) {
        envelope = readKimEnvelope(Buffer.from(data), [input.address]);
        if (envelope.profile !== 'ti-ecies-brainpoolp256r1-aes256gcm'
          || !envelope.mappings.some(e => e.address === kimAddress(input.address) && e.rid === cert.rid.toString('hex'))) throw new Error();
        expectedSigner = eccCmsCertificate(input.expectedSignerCertificate, 'osig', this.#now()).cert.raw;
      } else {
        recipientSet = prepareEccKimRecipients(input.sender, input.recipients, this.#now());
        if (!recipientSet.entries.some(e => e.address === kimAddress(input.sender) && e.admission.telematikId === cert.admission.telematikId)) throw new Error();
      }
    } catch { connectorFail('CMS_INPUT'); }
    assertConnectorCertificate(verification, this, { certificate: cert.cert.raw });
    const bytes = Buffer.from(data), generation = ++this.#pinGeneration;
    this.#cmsBusy = true; this.#cmsUncertain = true;
    let output, verified, decoded;
    const bound = () => {
      assertSelectedSmcb(stored.selection, this); connectorSignal(stored.signal); connectorSignal(signal);
      if (generation !== this.#pinGeneration) connectorFail('PIN_STATUS_STALE');
      if (this.#now() < status.checkedAt || this.#now() >= status.validUntil) connectorFail('EVIDENCE_EXPIRED');
      assertConnectorCertificate(verification, this, { certificate: cert.cert.raw });
    };
    const stop = AbortSignal.any([AbortSignal.timeout(30000), ...(stored.signal ? [stored.signal] : []), ...(signal ? [signal] : [])]);
    try {
      const requestId = randomUUID();
      let job;
      if (sign) job = await this.#exchange('GetJobNumber', {}, stop, this.#timeout, bound);
      bound();
      const { parsed, metadata } = await this.#exchange(operation, {
        data: bytes, cardHandle: stored.selection.card.cardHandle, jobNumber: job?.parsed.jobNumber, requestId,
        recipientEmails: recipientSet?.emails, certificates: recipientSet?.entries.map(e => e.cert.raw),
      }, stop, this.#timeout, bound);
      bound(); output = Buffer.from(parsed.data, 'base64');
      if (sign) {
        if (parsed.requestId !== requestId) connectorFail('CMS_BINDING');
        verified = verifyEccKimSignedContent({ bytes: output, recipientEmails: recipientSet.emails, expectedSignerCertificate: cert.cert.raw, now: this.#now() });
        if (!verified.content.equals(bytes)) connectorFail('CMS_BINDING');
      } else if (decrypt) {
        decoded = decodeKimMimeEntity(output, { type: 'application/pkcs7-mime', smimeType: 'signed-data' });
        verified = verifyEccKimSignedContent({ bytes: decoded, recipientEmails: envelope.recipientEmails, expectedSignerCertificate: expectedSigner, now: this.#now() });
      } else {
        const encrypted = readKimEnvelope(output, recipientSet.entries.map(e => e.address));
        if (encrypted.profile !== 'ti-ecies-brainpoolp256r1-aes256gcm' || !encrypted.recipientEmails.equals(recipientSet.emails)) connectorFail('CMS_BINDING');
      }
      this.#cmsUncertain = false;
      return Object.freeze({ ...metadata, data: output.toString('base64'), dataSha256: hash(bytes), outputSha256: hash(output),
        certificateSha256: hash(cert.cert.raw), ...(job ? { job: job.metadata } : {}),
        deliveryStatus: 'held-for-trust-validation', profile: 'ecc-cms-diagnostic' });
    } catch (e) { if (e instanceof KonnektorError) throw e; connectorFail('CMS_REJECTED'); }
    finally { this.#cmsBusy = false; bytes.fill(0); output?.fill(0); decoded?.fill(0); verified?.content.fill(0); }
  }
  async verifyCertificate({ certificate: input, requiredRoles = [], signal } = {}) {
    this.#open(); connectorSignal(signal);
    const cert = certificate(input), expected = roles(requiredRoles);
    const { parsed, metadata } = await this.#exchange('VerifyCertificate', { certificate: Buffer.from(cert.raw) }, signal);
    const actual = roles(parsed.roles), roleMatches = expected.every(r => actual.includes(r));
    if (parsed.verificationResult === 'VALID' && (metadata.checkedAt < cert.validFromDate.getTime() || metadata.checkedAt >= cert.validToDate.getTime())) connectorFail('RESULT');
    const result = Object.freeze({ ...metadata, certificateSha256: hash(cert.raw), execution: parsed.execution,
      verificationResult: parsed.verificationResult, roles: Object.freeze(actual), roleMatches,
      remoteCodes: Object.freeze(parsed.remoteCodes), validUntil: Math.min(metadata.checkedAt + 30000, cert.validToDate.getTime()) });
    evidence.set(result, { client: this, certificateSha256: result.certificateSha256, assert: () => {
      this.#open(); const now = this.#now();
      if (now < metadata.checkedAt || now >= result.validUntil) connectorFail('EVIDENCE_EXPIRED');
    } });
    return result;
  }
  async readCardCertificates({ cardHandle, certRefs = ['C.AUT', 'C.ENC', 'C.SIG'], crypt = 'ECC', signal } = {}) {
    this.#open(); connectorSignal(signal); cardHandle = connectorText(cardHandle, 128);
    const requested = references(certRefs);
    if (!['ECC', 'RSA'].includes(crypt)) connectorFail('INPUT');
    const { parsed, metadata } = await this.#exchange('ReadCardCertificate', { cardHandle, certRefs: requested, crypt }, signal);
    if (parsed.certificates.length !== requested.length || parsed.certificates.some(item => !requested.includes(item.certRef))) connectorFail('CERTIFICATE_BINDING');
    const certificates = requested.map(certRef => {
      const entry = parsed.certificates.find(c => c.certRef === certRef);
      if (entry.certificate === null) return Object.freeze({ certRef, state: 'missing' });
      const cert = certificate(Buffer.from(entry.certificate, 'base64'));
      if (cert.ca || (crypt === 'ECC' ? cert.publicKey.asymmetricKeyType !== 'ec' : cert.publicKey.asymmetricKeyType !== 'rsa')) connectorFail('CERTIFICATE_BINDING');
      return Object.freeze({ certRef, state: 'read', certificate: Buffer.from(cert.raw), certificateSha256: hash(cert.raw) });
    });
    return Object.freeze({ ...metadata, cardHandleSha256: hash(Buffer.from(cardHandle)), crypt, certificates: Object.freeze(certificates) });
  }
  async readAndVerifyCardCertificates({ cardHandle, certRefs = ['C.AUT', 'C.ENC', 'C.SIG'], crypt = 'ECC', requiredRoles = [], signal } = {}) {
    this.#open(); connectorSignal(signal); const expected = roles(requiredRoles), requested = references(certRefs);
    const deadline = AbortSignal.timeout(30000), stop = signal ? AbortSignal.any([signal, deadline]) : deadline;
    try {
      const read = await KonnektorCertificateClient.prototype.readCardCertificates.call(this, { cardHandle, certRefs: requested, crypt, signal: stop });
      if (read.certificates.some(c => c.state !== 'read')) connectorFail('CERTIFICATE_MISSING');
      const results = [];
      for (const item of read.certificates) {
        const proof = await KonnektorCertificateClient.prototype.verifyCertificate.call(this, { certificate: item.certificate, requiredRoles: expected, signal: stop });
        assertConnectorCertificate(proof, this, { certificate: item.certificate, requiredRoles: expected });
        results.push(Object.freeze({ ...item, verification: proof }));
      }
      const revalidate = () => {
        connectorSignal(stop);
        for (const item of results) assertConnectorCertificate(item.verification, this, { certificate: item.certificate, requiredRoles: expected });
      };
      revalidate();
      return Object.freeze({ ...read, certificates: Object.freeze(results), revalidate, deliveryStatus: 'held-for-trust-validation' });
    } catch (e) {
      if (signal?.aborted) connectorFail('ABORTED');
      if (deadline.aborted) connectorFail('TIMEOUT');
      throw e;
    }
  }
  close() { this.#closed = true; for (const c of this.#pending) c.abort(); this.#transport.close(); this.#eventTransport?.close(); this.#cardTransport?.close(); this.#authTransport?.close(); this.#signatureTransport?.close(); this.#encryptionTransport?.close(); }
}

/** One-shot attachment extraction from an actual bound exchange. Copies of an
 * error, a different client or a different CMS cannot supply an original report.
 * Remote XML is never placed on Error/client metadata or used to authorize delivery. */
export function takeConnectorDocumentFailure(error, client, dataSha256) {
  const stored = documentFailures.get(error);
  if (!stored || stored.client !== client || stored.metadata.dataSha256 !== dataSha256) return undefined;
  documentFailures.delete(error);
  return { bytes: stored.report, metadata: stored.metadata };
}

/** A bound observation is not an authorization for a key operation. */
export function assertSmcbPinStatus(status, client, selection) {
  const stored = pinStatuses.get(status);
  if (!stored || stored.client !== client || stored.selection !== selection) connectorFail('EVIDENCE_BINDING');
  stored.assert();
  return status;
}

/** Only a fresh GetPinStatus result can attest the observed PIN state. */
export function assertSmcbPinVerified(status, client, selection) {
  assertSmcbPinStatus(status, client, selection);
  if (status.pinStatus !== 'VERIFIED') connectorFail('PIN_NOT_VERIFIED');
  return status;
}

/** Selection is an observed card session, not an authenticated TI identity. */
export function assertSelectedSmcb(selection, client) {
  const stored = cardSelections.get(selection);
  if (!stored || stored.client !== client) connectorFail('EVIDENCE_BINDING');
  stored.assert(); return selection;
}

/** Only the original HTTPS-backed result, bound to this client and exact DER,
 * can be consumed. 30 seconds is a local consumption window, not a TI cache.
 */
export function assertConnectorCertificate(proof, client, { certificate: input, requiredRoles = [] } = {}) {
  const stored = evidence.get(proof);
  if (!stored || stored.client !== client || stored.certificateSha256 !== hash(certificate(input).raw)) connectorFail('EVIDENCE_BINDING');
  stored.assert();
  if (proof.verificationResult !== 'VALID' || proof.execution !== 'OK') connectorFail('CERTIFICATE_REJECTED');
  if (!roles(requiredRoles).every(r => proof.roles.includes(r))) connectorFail('ROLE');
  return proof;
}
