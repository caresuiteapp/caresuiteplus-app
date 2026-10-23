import https from 'node:https';
import { createHash } from 'node:crypto';
import { openStore, isUuid, transaction } from '../gkv/storage.mjs';
import { probeSmcbCms } from './connector-cms-probe.mjs';
import { KonnektorCertificateClient } from './connector-certificates.mjs';
import { TslOcspStatusClient } from './tsl-ocsp.mjs';
import { KimReceiveJobs, createKimReceiveSchema } from './host-receive.mjs';
import { readKimHostCommand, unconfiguredKimReceiveList } from '../../src/lib/gkvExchange/kimReceiveContract.ts';

const hash = b => createHash('sha256').update(b).digest('hex');
const fail = code => { throw new Error(code); };
/** One institution per provisioned host. Both probe and receive reservations
 * survive restarts. No send, delete, upload, certificate or PIN-entry route. */
export class KimDiagnosticHost {
  #db; #tenant; #options; #pending; #controller; #receive; #active; #closed = false;
  constructor({ tenantId, storePath, probe, receive, recoveryReviewedRequestId }) {
    if (!isUuid(tenantId) || !(probe?.connector instanceof KonnektorCertificateClient)
      || !(probe?.statusClient instanceof TslOcspStatusClient) || !Array.isArray(probe.requiredRoles)
      || probe.connector.environment !== probe.statusClient.environment) fail('KIM_HOST_CONFIGURATION');
    if (recoveryReviewedRequestId !== undefined && !isUuid(recoveryReviewedRequestId)) fail('KIM_HOST_CONFIGURATION');
    this.#tenant = tenantId; this.#options = Object.freeze({ ...probe, requiredRoles: Object.freeze([...probe.requiredRoles]) });
    this.#db = openStore(storePath);
    try {
      this.#db.exec(`CREATE TABLE IF NOT EXISTS kim_diagnostic_jobs (
      tenant TEXT NOT NULL, request_id TEXT NOT NULL, started INTEGER NOT NULL, completed INTEGER,
      state TEXT NOT NULL, report TEXT, error_code TEXT, reviewed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(tenant,request_id));`);
      createKimReceiveSchema(this.#db);
      if (this.#db.prepare('SELECT 1 FROM kim_diagnostic_jobs WHERE tenant<>? UNION ALL SELECT 1 FROM kim_receive_jobs WHERE tenant<>? UNION ALL SELECT 1 FROM kim_receive_settings WHERE tenant<>? LIMIT 1')
        .get(tenantId, tenantId, tenantId)) fail('KIM_HOST_SCOPE');
      if (receive) this.#receive = new KimReceiveJobs({ db: this.#db, tenantId, config: receive, probe: this.#options });
      else if (this.#db.prepare('SELECT 1 FROM kim_receive_jobs LIMIT 1').get()) fail('KIM_HOST_RECEIVE_CONFIGURATION_REQUIRED');
      if (recoveryReviewedRequestId !== undefined) transaction(this.#db, () => {
        const row = this.#latest();
        if (!row || row.request_id !== recoveryReviewedRequestId || !row.blocked) fail('KIM_HOST_RECOVERY_BINDING');
        if (row.kind === 'probe') this.#db.prepare("UPDATE kim_diagnostic_jobs SET reviewed=1,state=CASE WHEN state='running' THEN 'interrupted' ELSE state END WHERE tenant=? AND request_id=?").run(tenantId, recoveryReviewedRequestId);
        else this.#db.prepare("UPDATE kim_receive_jobs SET requires_review=0,state=CASE WHEN state='running' THEN 'interrupted' ELSE state END WHERE tenant=? AND request_id=?").run(tenantId, recoveryReviewedRequestId);
      });
    } catch (e) { this.#receive?.close(); this.#db.close(); throw e; }
  }
  #assert(tenantId) { if (this.#closed) fail('KIM_HOST_CLOSED'); if (tenantId !== this.#tenant) fail('KIM_HOST_SCOPE'); }
  #latest() {
    return this.#db.prepare(`SELECT * FROM (
      SELECT 'probe' kind,request_id,started,(state IN ('running','failed') AND reviewed=0) blocked FROM kim_diagnostic_jobs
      UNION ALL SELECT 'receive' kind,request_id,started,requires_review blocked FROM kim_receive_jobs WHERE started IS NOT NULL)
      ORDER BY started DESC,request_id DESC LIMIT 1`).get();
  }
  #gate() {
    const blocked = this.#db.prepare(`SELECT * FROM (
      SELECT 'probe' kind,request_id,started FROM kim_diagnostic_jobs WHERE state IN ('running','failed') AND reviewed=0
      UNION ALL SELECT 'receive' kind,request_id,started FROM kim_receive_jobs WHERE requires_review=1)
      ORDER BY started,request_id LIMIT 1`).get();
    const last = this.#latest(), nextStartAt = !blocked && !this.#pending && last && last.started + 30000 > Date.now() ? last.started + 30000 : null;
    const receiveBlock = blocked?.kind === 'receive' ? (this.#active?.kind === 'receive' ? 'active' : 'review')
      : nextStartAt && last.kind === 'receive' ? 'cooldown' : undefined;
    return { canStart: !blocked && !this.#pending && !nextStartAt, nextStartAt, ...(receiveBlock ? { receiveBlock } : {}) };
  }
  #assertStart() {
    const gate = this.#gate(); if (!gate.canStart) fail(gate.nextStartAt ? 'KIM_HOST_RATE_LIMIT' : 'KIM_HOST_RECOVERY_REQUIRED');
  }
  status(tenantId) {
    this.#assert(tenantId);
    const row = this.#db.prepare('SELECT * FROM kim_diagnostic_jobs WHERE tenant=? ORDER BY started DESC,request_id DESC LIMIT 1').get(tenantId);
    return { version: 1, tenantId, configured: true, environment: this.#options.connector.environment,
      state: !row ? 'ready' : row.state === 'running' && !this.#pending ? 'interrupted' : row.state,
      ...this.#gate(), requestId: row?.request_id ?? null, startedAt: row?.started ?? null,
      completedAt: row?.completed ?? null, report: row?.report ? JSON.parse(row.report) : null, errorCode: row?.error_code ?? null };
  }
  start(tenantId, requestId) {
    this.#assert(tenantId); if (!isUuid(requestId)) fail('KIM_HOST_INPUT');
    const duplicate = transaction(this.#db, () => {
      if (this.#db.prepare('SELECT 1 FROM kim_diagnostic_jobs WHERE tenant=? AND request_id=?').get(tenantId, requestId)) return true;
      if (this.#db.prepare('SELECT 1 FROM kim_receive_jobs WHERE request_id=?').get(requestId)) fail('KIM_HOST_RECEIVE_REQUEST_CONFLICT');
      this.#assertStart();
      this.#db.prepare("INSERT INTO kim_diagnostic_jobs(tenant,request_id,started,state) VALUES(?,?,?,'running')").run(tenantId, requestId, Date.now());
      return false;
    });
    if (duplicate) return this.status(tenantId);
    this.#active = { kind: 'probe', requestId };
    this.#controller = new AbortController();
    this.#pending = Promise.resolve().then(() => probeSmcbCms({ ...this.#options, signal: this.#controller.signal }))
      .then(report => this.#db.prepare("UPDATE kim_diagnostic_jobs SET state='passed',completed=?,report=? WHERE tenant=? AND request_id=?").run(Date.now(), JSON.stringify(report), tenantId, requestId))
      .catch(error => this.#db.prepare("UPDATE kim_diagnostic_jobs SET state='failed',completed=?,error_code=? WHERE tenant=? AND request_id=?").run(Date.now(),
        /^KIM_CONNECTOR_[A-Z_]{1,40}$/.test(error?.code ?? '') ? error.code : 'KIM_HOST_PROBE_UNAVAILABLE', tenantId, requestId))
      .finally(() => { this.#pending = undefined; this.#active = undefined; });
    return this.status(tenantId);
  }
  #receiving(tenantId) {
    this.#assert(tenantId); if (!this.#receive) fail('KIM_HOST_RECEIVE_UNCONFIGURED'); return this.#receive;
  }
  prepareReceive(tenantId, input) { this.#receiving(tenantId).prepare(input); return this.receiveStatus(tenantId, input.requestId); }
  receiveList(tenantId, before = null) {
    this.#assert(tenantId); readKimHostCommand({ tenantId, action: 'receive-list', before });
    if (!this.#receive) return unconfiguredKimReceiveList(tenantId, before);
    return transaction(this.#db, () => {
      const page = this.#receive.page(before), gate = this.#gate();
      return { version: 1, kind: 'card-receive-list', tenantId, configured: true, environment: this.#options.connector.environment,
        mailboxId: page.mailboxId, canStart: gate.canStart, nextStartAt: gate.nextStartAt,
        blockReason: gate.canStart ? null : gate.nextStartAt ? 'cooldown' : this.#pending ? 'active' : 'review',
        before, nextCursor: page.nextCursor, items: page.requestIds.map(id => this.#receiveSnapshot(id, gate)) };
    });
  }
  receiveStatus(tenantId, requestId) {
    this.#receiving(tenantId); return this.#receiveSnapshot(requestId, this.#gate());
  }
  #receiveSnapshot(requestId, gate) {
    const status = this.#receive.status(requestId);
    if (status.state === 'running' && (this.#active?.kind !== 'receive' || this.#active.requestId !== requestId)) status.state = 'interrupted';
    return { ...status, canStart: status.state === 'prepared' && gate.canStart, nextStartAt: status.state === 'prepared' ? gate.nextStartAt : null };
  }
  startReceive(tenantId, requestId) {
    const jobs = this.#receiving(tenantId);
    const reserved = transaction(this.#db, () => {
      if (jobs.status(requestId).state !== 'prepared') return false;
      this.#assertStart(); return jobs.reserve(requestId);
    });
    if (reserved) {
      this.#controller = new AbortController(); this.#active = { kind: 'receive', requestId };
      this.#pending = Promise.resolve().then(() => jobs.run(requestId, this.#controller.signal))
        // If even recording a failure fails, the durable running reservation
        // remains blocked. Never expose native storage errors or auto-resume.
        .catch(() => {}).finally(() => { this.#pending = undefined; this.#active = undefined; });
    }
    return this.receiveStatus(tenantId, requestId);
  }
  receiveArtifact(tenantId, requestId) { return this.#receiving(tenantId).artifact(requestId); }
  async close() { if (this.#closed) return; this.#closed = true; this.#controller?.abort(); await this.#pending; this.#receive?.close(); this.#db.close(); }
}

/** Mounted on a dedicated existing on-site Node host. All incoming clients
 * need an issued mTLS certificate AND the provisioned leaf pin. No CORS. */
export function createKimHostServer({ host, tls, clientSha256 }) {
  if (!(host instanceof KimDiagnosticHost) || !/^[a-f0-9]{64}$/.test(clientSha256 ?? '')
    || !tls?.key || !tls?.cert || !tls?.ca) fail('KIM_HOST_CONFIGURATION');
  return https.createServer({ ...tls, requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.2', maxHeaderSize: 8192,
    headersTimeout: 10000, requestTimeout: 15000 }, async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Content-Type', 'application/json'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    try {
      const peer = req.socket.getPeerCertificate();
      if (!req.socket.authorized || !peer.raw || hash(peer.raw) !== clientSha256) return reply(403, { error: 'KIM_HOST_CLIENT' });
      if (req.url !== '/v1/diagnostics' || req.method !== 'POST') return reply(404, { error: 'KIM_HOST_ROUTE' });
      if (req.headers['content-type'] !== 'application/json' || req.headers['content-encoding'] !== undefined) return reply(415, { error: 'KIM_HOST_FORMAT' });
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 2048) return reply(413, { error: 'KIM_HOST_SIZE' }); chunks.push(chunk); }
      let input; try { input = readKimHostCommand(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { return reply(400, { error: 'KIM_HOST_INPUT' }); }
      const receiving = input.action.startsWith('receive-');
      const status = () => input.action === 'receive-list' ? host.receiveList(input.tenantId, input.before)
        : receiving ? host.receiveStatus(input.tenantId, input.requestId) : host.status(input.tenantId);
      try { reply(200, input.action === 'start' ? host.start(input.tenantId, input.requestId)
        : input.action === 'receive-start' ? host.startReceive(input.tenantId, input.requestId) : status()); }
      catch (error) {
        // A stale browser may still offer Start. Return the current scoped
        // state for an explicit refusal, without reserving or retrying a job.
        if (['KIM_HOST_RATE_LIMIT', 'KIM_HOST_RECOVERY_REQUIRED'].includes(error?.message)) return reply(200, status());
        throw error;
      }
    } catch (error) { reply(error?.message === 'KIM_HOST_SCOPE' ? 403 : 409, { error: /^KIM_HOST_[A-Z_]+$/.test(error?.message) ? error.message : 'KIM_HOST_UNAVAILABLE' }); }
  });
}
