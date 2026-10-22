import { createHash, X509Certificate } from 'node:crypto';
import { KonnektorHttpsTransport } from './connector-http.mjs';
import { certificateRequest, inspectConnectorXml, connectorText, CERT_REFS } from './connector-xml.mjs';
import { canonicalOid } from './der-oid.mjs';
import { KonnektorError, connectorFail, connectorSignal } from './connector-error.mjs';
import { cardFilters, cardSelector, checkedCards, selectSmcbCard } from './connector-cards.mjs';

export { KonnektorError } from './connector-error.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const evidence = new WeakMap();
const cardSnapshots = new WeakMap(), cardSelections = new WeakMap();
const pinStatuses = new WeakMap();
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
  #transport; #eventTransport; #cardTransport; #context; #contextHash; #environment; #python; #clock; #timeout; #cardGeneration = 0;
  #pinTimeout; #pinGeneration = 0; #pinBusy = false; #pinUncertain = false;
  #closed = false; #pending = new Set();
  constructor({ context, environment, eventServiceUrl, cardServiceUrl, pinTimeoutMs = 120000, python = 'python3', clock = Date.now, timeoutMs = 10000, ...route }) {
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
      for (const url of [eventServiceUrl, cardServiceUrl]) {
        if (url !== undefined && (typeof url !== 'string' || new URL(url).origin !== new URL(route.url).origin)) connectorFail('CONFIGURATION');
      }
      this.#now(); this.#transport = new KonnektorHttpsTransport({ ...route, service: 'certificate' });
      if (eventServiceUrl !== undefined) this.#eventTransport = new KonnektorHttpsTransport({ ...route, url: eventServiceUrl, service: 'event' });
      if (cardServiceUrl !== undefined) this.#cardTransport = new KonnektorHttpsTransport({ ...route, url: cardServiceUrl, service: 'card' });
    } catch { this.#transport?.close(); this.#eventTransport?.close(); this.#cardTransport?.close(); connectorFail('CONFIGURATION'); }
    Object.freeze(this);
  }
  get environment() { return this.#environment; }
  #now() { const now = this.#clock(); if (!Number.isSafeInteger(now) || now < 0) connectorFail('CLOCK'); return now; }
  #open() { if (this.#closed) connectorFail('CLOSED'); }
  async #exchange(operation, input, signal, timeout = this.#timeout) {
    this.#open(); connectorSignal(signal);
    const pin = ['GetPinStatus', 'VerifyPin'].includes(operation);
    const transport = operation === 'GetCards' ? this.#eventTransport : pin ? this.#cardTransport : this.#transport;
    if (!transport) connectorFail(pin ? 'CARD_UNCONFIGURED' : 'EVENT_UNCONFIGURED');
    if (this.#pending.size >= 8) connectorFail('BUSY');
    const controller = new AbortController(), deadline = AbortSignal.timeout(timeout);
    const stop = AbortSignal.any([controller.signal, deadline, ...(signal ? [signal] : [])]);
    const startedAt = this.#now(); this.#pending.add(controller);
    let request, response;
    try {
      request = certificateRequest(operation, this.#context, input);
      await inspectConnectorXml(request, { operation, mode: 'request', python: this.#python, signal: stop });
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
  #pinOpen() {
    this.#open();
    if (!this.#cardTransport) connectorFail('CARD_UNCONFIGURED');
    if (this.#pinBusy) connectorFail('PIN_BUSY');
    if (this.#pinUncertain) connectorFail('PIN_OUTCOME_UNKNOWN');
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
      leftTries: parsed.leftTries, execution: parsed.execution, validUntil: Math.min(selection.validUntil, metadata.checkedAt + 30000) });
    const assert = () => {
      this.#pinOpen(); connectorSignal(signal); assertSelectedSmcb(selection, this);
      if (generation !== this.#pinGeneration) connectorFail('PIN_STATUS_STALE');
      const now = this.#now();
      if (now < metadata.checkedAt || now >= result.validUntil) connectorFail('EVIDENCE_EXPIRED');
    };
    pinStatuses.set(result, { client: this, selection, assert }); return result;
  }
  /** One explicit terminal attempt. No PIN value, automatic retry or software
   * entry path. The response alone is never a key-operation authorization.
   */
  async verifySmcbPin(input = {}) {
    pinOptions(input, ['status', 'signal']);
    const { status, signal } = input;
    this.#pinOpen(); connectorSignal(signal);
    const stored = pinStatuses.get(status);
    if (!stored || stored.client !== this) connectorFail('EVIDENCE_BINDING');
    stored.assert();
    if (status.pinStatus !== 'VERIFIABLE') connectorFail('PIN_NOT_VERIFIABLE');
    const cardGeneration = this.#cardGeneration;
    ++this.#pinGeneration; this.#pinBusy = true; this.#pinUncertain = true;
    try {
      const { parsed, metadata } = await this.#exchange('VerifyPin', { cardHandle: stored.selection.card.cardHandle }, signal, this.#pinTimeout);
      if (parsed.pinResult === 'ERROR') throw new KonnektorError('KIM_CONNECTOR_PIN_ERROR', parsed.remoteCodes);
      this.#pinUncertain = false;
      // A human PIN entry may outlive the old 30s snapshot. Only an observation
      // is returned; prepareSmcbPin must reacquire the card/certificates/status.
      if (cardGeneration !== this.#cardGeneration) connectorFail('CARD_SNAPSHOT_STALE');
      return Object.freeze({ ...metadata, pinTyp: 'PIN.SMC', pinResult: parsed.pinResult, leftTries: parsed.leftTries,
        execution: parsed.execution, deliveryStatus: 'held-for-trust-validation' });
    } finally { this.#pinBusy = false; }
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
  close() { this.#closed = true; for (const c of this.#pending) c.abort(); this.#transport.close(); this.#eventTransport?.close(); this.#cardTransport?.close(); }
}

/** Only a fresh GetPinStatus result can attest the observed PIN state. */
export function assertSmcbPinVerified(status, client, selection) {
  const stored = pinStatuses.get(status);
  if (!stored || stored.client !== client || stored.selection !== selection) connectorFail('EVIDENCE_BINDING');
  stored.assert();
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
