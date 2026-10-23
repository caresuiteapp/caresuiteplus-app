import { createHash, X509Certificate } from 'node:crypto';
import { Vault, isUuid, transaction } from '../gkv/storage.mjs';
import { ReceiptInbox } from '../gkv/inbox.mjs';
import { kimAddress } from './address.mjs';
import { checkVzdConfiguration } from './vzd-bindings.mjs';
import { validCmVersion, validPtVersion } from './message-auth.mjs';
import { MAX_KIM_MESSAGE } from './message.mjs';
import { MAX_KIM_RECEIVE_REPORT } from './receive-error.mjs';
import { receiveEccKimMessageWithCard } from './receive-card.mjs';
import { KIM_RECEIVE_PAGE_SIZE } from '../../src/lib/gkvExchange/kimReceiveContract.ts';

const hash = value => createHash('sha256').update(value).digest('hex');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fail = suffix => { throw new Error('KIM_HOST_RECEIVE_' + suffix); };
const identity = row => `kim-receive:${row.tenant}:${row.request_id}:${row.mailbox_id}:${row.message_id}:${row.original_sha256}:${row.parameters_sha256}`;
const certificate = value => {
  if (!((typeof value === 'string' || value instanceof Uint8Array) && value.length > 0 && value.length <= 32768)) fail('CERTIFICATE');
  try { return new X509Certificate(value).raw.toString('base64'); } catch { fail('CERTIFICATE'); }
};
const errorCode = error => /^KIM_(?:HOST|CONNECTOR|MESSAGE|TSL|VZD|OCSP|RECEIVE)_[A-Z_]{1,64}$/.test(error?.code ?? error?.message ?? '')
  ? error.code ?? error.message : 'KIM_HOST_RECEIVE_UNAVAILABLE';

/** Private host journal. Preparation is local administration, never an HTTP
 * upload or a certificate lookup based on untrusted From/To fields. The owning
 * host serializes these reservations with its synthetic card probes. */
export class KimReceiveJobs {
  #db; #vault; #tenant; #config; #probe; #binding; #accountHash; #maxJobs; #maxBytes;
  constructor({ db, tenantId, config, probe }) {
    if (!config || Object.keys(config).some(k => !['inbox','key','mailboxId','address','directory','cmVersion','ptVersion','maxJobs','maxResultBytes'].includes(k))
      || !(config.inbox instanceof ReceiptInbox) || !isUuid(config.mailboxId)
      || !validCmVersion(config.cmVersion) || !validPtVersion(config.ptVersion)) fail('CONFIGURATION');
    checkVzdConfiguration(config.directory, probe.statusClient);
    const address = kimAddress(config.address);
    if (address !== kimAddress(probe.address) || (probe.connector.environment === 'production') === address.endsWith('.telematik-test')) fail('CONFIGURATION');
    this.#maxJobs = config.maxJobs ?? 10000; this.#maxBytes = config.maxResultBytes ?? 256_000_000;
    if (!Number.isSafeInteger(this.#maxJobs) || this.#maxJobs < 1 || this.#maxJobs > 100000
      || !Number.isSafeInteger(this.#maxBytes) || this.#maxBytes < 1 || this.#maxBytes > 10_000_000_000) fail('QUOTA_CONFIGURATION');
    this.#tenant = tenantId; this.#db = db; this.#probe = probe;
    this.#config = Object.freeze({ inbox: config.inbox, mailboxId: config.mailboxId, address, directory: config.directory,
      cmVersion: config.cmVersion, ptVersion: config.ptVersion });
    this.#accountHash = this.#account().sha256;
    this.#binding = hash(JSON.stringify({ tenantId, mailboxId: config.mailboxId, address, accountSha256: this.#accountHash,
      environment: probe.connector.environment, expectedTelematikId: probe.expectedTelematikId, requiredRoles: probe.requiredRoles,
      iccsn: probe.iccsn, ctId: probe.ctId, slotId: probe.slotId, cmVersion: config.cmVersion, ptVersion: config.ptVersion }));
    this.#vault = new Vault(config.key);
    try {
      // Bind the encryption key and provisioning even when there are no jobs yet.
      db.exec('CREATE TABLE IF NOT EXISTS kim_receive_settings (tenant TEXT PRIMARY KEY, binding TEXT NOT NULL, check_value BLOB NOT NULL) STRICT');
      transaction(db, () => {
        const prior = db.prepare('SELECT * FROM kim_receive_settings').all();
        if (prior.length > 1 || prior.some(p => p.tenant !== tenantId || p.binding !== this.#binding)) fail('CONFIGURATION_CHANGED');
        if (!prior.length) db.prepare('INSERT INTO kim_receive_settings VALUES(?,?,?)').run(tenantId, this.#binding,
          this.#vault.seal(Buffer.from(this.#binding), `kim-receive-settings:${tenantId}`));
        else {
          const value = this.#vault.open(prior[0].check_value, `kim-receive-settings:${tenantId}`);
          try { if (value.toString() !== this.#binding) fail('INTEGRITY'); } finally { value.fill(0); }
        }
      });
    } catch (e) { this.#vault.close(); throw e; }
  }
  #account() {
    const a = ReceiptInbox.prototype.mailbox.call(this.#config.inbox, this.#tenant, this.#config.mailboxId);
    if (!a || kimAddress(a.username) !== this.#config.address || (this.#accountHash && a.sha256 !== this.#accountHash)) fail('MAILBOX_BINDING');
    return a;
  }
  #original(messageId, originalSha256) {
    this.#account();
    const message = ReceiptInbox.prototype.get.call(this.#config.inbox, this.#tenant, messageId);
    if (!message) fail('MESSAGE_NOT_FOUND');
    if (message.mailboxId !== this.#config.mailboxId || message.sha256 !== originalSha256
      || message.bytes.length > MAX_KIM_MESSAGE || hash(message.bytes) !== originalSha256) {
      message.bytes.fill(0); fail('ORIGINAL_BINDING');
    }
    return message.bytes;
  }
  #row(requestId) {
    if (!isUuid(requestId)) fail('INPUT');
    const row = this.#db.prepare('SELECT * FROM kim_receive_jobs WHERE tenant=? AND request_id=?').get(this.#tenant, requestId);
    if (!row) fail('NOT_FOUND'); return row;
  }
  #parameters(row) {
    const clear = this.#vault.open(row.parameters, identity(row) + ':parameters');
    try {
      if (hash(clear) !== row.parameters_sha256) fail('INTEGRITY');
      const p = JSON.parse(clear.toString('utf8'));
      if (p.binding !== this.#binding || p.messageId !== row.message_id || p.originalSha256 !== row.original_sha256) fail('INTEGRITY');
      return p;
    } finally { clear.fill(0); }
  }
  prepare(input) {
    if (!input || Object.keys(input).some(k => !['requestId','messageId','originalSha256','expectedSignerCertificate','expectedAuthCertificate'].includes(k))
      || ![input.requestId, input.messageId].every(isUuid) || !digest(input.originalSha256)) fail('INPUT');
    const bytes = this.#original(input.messageId, input.originalSha256);
    let encoded;
    try {
      encoded = Buffer.from(JSON.stringify({ binding: this.#binding, messageId: input.messageId, originalSha256: input.originalSha256,
        signer: certificate(input.expectedSignerCertificate), ...(input.expectedAuthCertificate === undefined ? {} : { authentication: certificate(input.expectedAuthCertificate) }) }));
      const fingerprint = hash(encoded);
      transaction(this.#db, () => {
        if (this.#db.prepare('SELECT 1 FROM kim_diagnostic_jobs WHERE request_id=?').get(input.requestId)) fail('REQUEST_CONFLICT');
        const old = this.#db.prepare('SELECT * FROM kim_receive_jobs WHERE tenant=? AND request_id=?').get(this.#tenant, input.requestId);
        if (old) { this.#parameters(old); if (old.parameters_sha256 !== fingerprint) fail('REQUEST_CONFLICT'); return; }
        if (this.#db.prepare('SELECT 1 FROM kim_receive_jobs WHERE tenant=? AND mailbox_id=? AND message_id=?').get(this.#tenant, this.#config.mailboxId, input.messageId)) fail('MESSAGE_RESERVED');
        if (this.#db.prepare('SELECT count(*) n FROM kim_receive_jobs').get().n >= this.#maxJobs) fail('QUOTA');
        const row = { tenant: this.#tenant, request_id: input.requestId, mailbox_id: this.#config.mailboxId, message_id: input.messageId,
          original_sha256: input.originalSha256, parameters_sha256: fingerprint };
        this.#db.prepare(`INSERT INTO kim_receive_jobs(tenant,request_id,mailbox_id,message_id,original_sha256,parameters_sha256,parameters,created,state)
          VALUES(?,?,?,?,?,?,?,?,'prepared')`).run(row.tenant, row.request_id, row.mailbox_id, row.message_id, row.original_sha256, fingerprint,
          this.#vault.seal(encoded, identity(row) + ':parameters'), Date.now());
      });
    } finally { bytes.fill(0); encoded?.fill(0); }
    return input.requestId;
  }
  status(requestId) {
    const row = this.#row(requestId); this.#parameters(row);
    let result = null;
    if (row.state === 'completed') {
      const metadata = this.#metadata(row), card = metadata.cardAcquisition;
      result = { kind: metadata.kind, sha256: row.result_sha256, octets: row.result_octets,
        diagnosisCode: metadata.diagnostic?.errorCode ?? null, cardState: card?.state ?? null, cardStage: card?.stage ?? null,
        documentResult: card?.documentVerification?.verificationResult ?? metadata.diagnostic?.connectorVerification?.verificationResult ?? null,
        verificationReportSha256: card?.documentVerification?.reportSha256 ?? metadata.diagnostic?.connectorReportSha256 ?? null,
        identityStatus: 'unverified', deliveryStatus: metadata.deliveryStatus, hardwareEvidence: 'not-attested', tiEvidence: 'not-attested' };
    }
    return { version: 1, kind: 'card-receive', tenantId: this.#tenant, requestId, mailboxId: row.mailbox_id, messageId: row.message_id,
      originalSha256: row.original_sha256, environment: this.#probe.connector.environment, state: row.state,
      createdAt: row.created, startedAt: row.started, completedAt: row.completed, reviewRequired: row.requires_review === 1,
      errorCode: row.error_code, result };
  }
  page(before) {
    const rows = before ? this.#db.prepare(`SELECT request_id,created FROM kim_receive_jobs WHERE tenant=?
      AND (created<? OR (created=? AND request_id<?)) ORDER BY created DESC,request_id DESC LIMIT ?`)
      .all(this.#tenant, before.createdAt, before.createdAt, before.requestId, KIM_RECEIVE_PAGE_SIZE + 1)
      : this.#db.prepare('SELECT request_id,created FROM kim_receive_jobs WHERE tenant=? ORDER BY created DESC,request_id DESC LIMIT ?')
        .all(this.#tenant, KIM_RECEIVE_PAGE_SIZE + 1);
    const last = rows[KIM_RECEIVE_PAGE_SIZE - 1];
    return { mailboxId: this.#config.mailboxId, requestIds: rows.slice(0, KIM_RECEIVE_PAGE_SIZE).map(row => row.request_id),
      nextCursor: rows.length > KIM_RECEIVE_PAGE_SIZE ? { createdAt: last.created, requestId: last.request_id } : null };
  }
  #metadata(row) {
    const clear = this.#vault.open(row.metadata, identity(row) + `:metadata:${row.result_sha256}`);
    try {
      const metadata = JSON.parse(clear.toString('utf8'));
      if (metadata.originalSha256 !== row.original_sha256 || metadata.outputSha256 !== row.result_sha256 || metadata.outputOctets !== row.result_octets) fail('INTEGRITY');
      return metadata;
    } finally { clear.fill(0); }
  }
  /** Local explicit retrieval only. The HTTPS handler never calls this method. */
  artifact(requestId) {
    const row = this.#row(requestId); this.#parameters(row);
    if (row.state !== 'completed') fail('RESULT_UNAVAILABLE');
    const metadata = this.#metadata(row), bytes = this.#vault.open(row.result, identity(row) + `:result:${row.result_sha256}`);
    if (hash(bytes) !== row.result_sha256 || bytes.length !== row.result_octets) { bytes.fill(0); fail('INTEGRITY'); }
    return { bytes, metadata };
  }
  /** Called inside the owning host's shared IMMEDIATE transaction. */
  reserve(requestId) {
    const row = this.#row(requestId); this.#parameters(row);
    if (row.state !== 'prepared') return false;
    // Check the original again before the durable reservation; no key operation yet.
    this.#original(row.message_id, row.original_sha256).fill(0);
    if (this.#db.prepare('SELECT coalesce(sum(result_octets),0) n FROM kim_receive_jobs').get().n >= this.#maxBytes) fail('QUOTA');
    this.#db.prepare("UPDATE kim_receive_jobs SET state='running',started=?,requires_review=1 WHERE tenant=? AND request_id=?").run(Date.now(), this.#tenant, requestId);
    return true;
  }
  async run(requestId, signal) {
    let bytes, signer, authentication, result, metadata;
    try {
      const row = this.#row(requestId), p = this.#parameters(row);
      if (row.state !== 'running') fail('STATE');
      bytes = this.#original(row.message_id, row.original_sha256);
      signer = Buffer.from(p.signer, 'base64'); authentication = p.authentication ? Buffer.from(p.authentication, 'base64') : undefined;
      const c = this.#config, probe = this.#probe;
      result = await receiveEccKimMessageWithCard({ bytes, address: c.address, expectedSignerCertificate: signer, expectedAuthCertificate: authentication },
        { cmVersion: c.cmVersion, ptVersion: c.ptVersion, includeDecryptedOriginal: false },
        { connector: probe.connector, statusClient: probe.statusClient, directory: c.directory, expectedTelematikId: probe.expectedTelematikId,
          requiredRoles: probe.requiredRoles, iccsn: probe.iccsn, ctId: probe.ctId, slotId: probe.slotId, signal });
      if (signal.aborted) fail('ABORTED');
      if (result.originalSha256 !== row.original_sha256 || result.identityStatus !== 'unverified' || !['diagnostic','unprotected'].includes(result.kind)
        || !['diagnostic-only','unprotected'].includes(result.deliveryStatus) || !Buffer.isBuffer(result.bytes) || !result.bytes.length
        || result.bytes.length > MAX_KIM_RECEIVE_REPORT) fail('RESULT');
      const { bytes: output, ...details } = result, outputSha256 = hash(output);
      metadata = Buffer.from(JSON.stringify({ ...details, outputSha256, outputOctets: output.length }));
      if (metadata.length > 65536) fail('RESULT');
      transaction(this.#db, () => {
        const current = this.#row(requestId); this.#parameters(current);
        if (current.state !== 'running') fail('STATE');
        if (this.#db.prepare('SELECT coalesce(sum(result_octets),0) n FROM kim_receive_jobs').get().n + output.length > this.#maxBytes) fail('QUOTA');
        this.#db.prepare(`UPDATE kim_receive_jobs SET state='completed',completed=?,result=?,metadata=?,result_sha256=?,result_octets=?,requires_review=?
          WHERE tenant=? AND request_id=?`).run(Date.now(), this.#vault.seal(output, identity(row) + `:result:${outputSha256}`),
          this.#vault.seal(metadata, identity(row) + `:metadata:${outputSha256}`), outputSha256, output.length,
          result.cardAcquisition?.state === 'rejected' ? 1 : 0, this.#tenant, requestId);
      });
    } catch (e) {
      this.#db.prepare("UPDATE kim_receive_jobs SET state='failed',completed=?,error_code=?,requires_review=1 WHERE tenant=? AND request_id=? AND state='running'")
        .run(Date.now(), errorCode(e), this.#tenant, requestId);
    } finally { bytes?.fill(0); signer?.fill(0); authentication?.fill(0); result?.bytes?.fill(0); metadata?.fill(0); }
  }
  close() { this.#vault.close(); }
}

export function createKimReceiveSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS kim_receive_settings (tenant TEXT PRIMARY KEY, binding TEXT NOT NULL, check_value BLOB NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS kim_receive_jobs (
    tenant TEXT NOT NULL, request_id TEXT PRIMARY KEY, mailbox_id TEXT NOT NULL, message_id TEXT NOT NULL,
    original_sha256 TEXT NOT NULL, parameters_sha256 TEXT NOT NULL, parameters BLOB NOT NULL,
    created INTEGER NOT NULL, started INTEGER, completed INTEGER,
    state TEXT NOT NULL CHECK(state IN ('prepared','running','completed','failed','interrupted')),
    requires_review INTEGER NOT NULL DEFAULT 0 CHECK(requires_review IN (0,1)), error_code TEXT,
    result BLOB, metadata BLOB, result_sha256 TEXT, result_octets INTEGER NOT NULL DEFAULT 0,
    UNIQUE(tenant,mailbox_id,message_id)) STRICT;
    CREATE INDEX IF NOT EXISTS kim_receive_page ON kim_receive_jobs(tenant,created DESC,request_id DESC);`);
}
