import https from 'node:https';
import { createHash } from 'node:crypto';
import { openStore, isUuid, transaction } from '../gkv/storage.mjs';
import { probeSmcbCms } from './connector-cms-probe.mjs';
import { KonnektorCertificateClient } from './connector-certificates.mjs';
import { TslOcspStatusClient } from './tsl-ocsp.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const fail = code => { throw new Error(code); };
/** One institution per provisioned host. Journal reservations survive restarts.
 * Only synthetic self probes; this host has no send, delete or PIN-entry route. */
export class KimDiagnosticHost {
  #db; #tenant; #options; #pending; #controller; #closed = false;
  constructor({ tenantId, storePath, probe, recoveryReviewedRequestId }) {
    if (!isUuid(tenantId) || !(probe?.connector instanceof KonnektorCertificateClient)
      || !(probe?.statusClient instanceof TslOcspStatusClient)) fail('KIM_HOST_CONFIGURATION');
    if (recoveryReviewedRequestId !== undefined && !isUuid(recoveryReviewedRequestId)) fail('KIM_HOST_CONFIGURATION');
    this.#tenant = tenantId; this.#options = Object.freeze({ ...probe, requiredRoles: Object.freeze([...probe.requiredRoles]) });
    this.#db = openStore(storePath);
    this.#db.exec(`CREATE TABLE IF NOT EXISTS kim_diagnostic_jobs (
      tenant TEXT NOT NULL, request_id TEXT NOT NULL, started INTEGER NOT NULL, completed INTEGER,
      state TEXT NOT NULL, report TEXT, error_code TEXT, reviewed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(tenant,request_id));`);
    if (this.#db.prepare('SELECT 1 FROM kim_diagnostic_jobs WHERE tenant<>? LIMIT 1').get(tenantId)) { this.#db.close(); fail('KIM_HOST_SCOPE'); }
    if (recoveryReviewedRequestId !== undefined) {
      const row = this.#db.prepare('SELECT * FROM kim_diagnostic_jobs ORDER BY started DESC LIMIT 1').get();
      if (!row || row.tenant !== tenantId || row.request_id !== recoveryReviewedRequestId || !['running', 'failed'].includes(row.state)) { this.#db.close(); fail('KIM_HOST_RECOVERY_BINDING'); }
      this.#db.prepare("UPDATE kim_diagnostic_jobs SET reviewed=1,state=CASE WHEN state='running' THEN 'interrupted' ELSE state END WHERE tenant=? AND request_id=?").run(tenantId, recoveryReviewedRequestId);
    }
  }
  #assert(tenantId) { if (this.#closed) fail('KIM_HOST_CLOSED'); if (tenantId !== this.#tenant) fail('KIM_HOST_SCOPE'); }
  status(tenantId) {
    this.#assert(tenantId);
    const row = this.#db.prepare('SELECT * FROM kim_diagnostic_jobs WHERE tenant=? ORDER BY started DESC,request_id DESC LIMIT 1').get(tenantId);
    const blocked = Boolean(this.#db.prepare("SELECT 1 FROM kim_diagnostic_jobs WHERE (state='running' OR state='failed') AND reviewed=0 LIMIT 1").get());
    return { version: 1, tenantId, configured: true, environment: this.#options.connector.environment,
      state: !row ? 'ready' : row.state === 'running' && !this.#pending ? 'interrupted' : row.state,
      canStart: !blocked && !this.#pending, requestId: row?.request_id ?? null, startedAt: row?.started ?? null,
      completedAt: row?.completed ?? null, report: row?.report ? JSON.parse(row.report) : null, errorCode: row?.error_code ?? null };
  }
  start(tenantId, requestId) {
    this.#assert(tenantId); if (!isUuid(requestId)) fail('KIM_HOST_INPUT');
    const duplicate = transaction(this.#db, () => {
      if (this.#db.prepare('SELECT 1 FROM kim_diagnostic_jobs WHERE tenant=? AND request_id=?').get(tenantId, requestId)) return true;
      if (!this.status(tenantId).canStart) fail('KIM_HOST_RECOVERY_REQUIRED');
      const previous = this.#db.prepare('SELECT MAX(started) AS started FROM kim_diagnostic_jobs').get();
      if (previous.started && Date.now() - previous.started < 30000) fail('KIM_HOST_RATE_LIMIT');
      this.#db.prepare("INSERT INTO kim_diagnostic_jobs(tenant,request_id,started,state) VALUES(?,?,?,'running')").run(tenantId, requestId, Date.now());
      return false;
    });
    if (duplicate) return this.status(tenantId);
    this.#controller = new AbortController();
    this.#pending = Promise.resolve().then(() => probeSmcbCms({ ...this.#options, signal: this.#controller.signal }))
      .then(report => this.#db.prepare("UPDATE kim_diagnostic_jobs SET state='passed',completed=?,report=? WHERE tenant=? AND request_id=?").run(Date.now(), JSON.stringify(report), tenantId, requestId))
      .catch(error => this.#db.prepare("UPDATE kim_diagnostic_jobs SET state='failed',completed=?,error_code=? WHERE tenant=? AND request_id=?").run(Date.now(),
        /^KIM_CONNECTOR_[A-Z_]{1,40}$/.test(error?.code ?? '') ? error.code : 'KIM_HOST_PROBE_UNAVAILABLE', tenantId, requestId))
      .finally(() => { this.#pending = undefined; });
    return this.status(tenantId);
  }
  async close() { if (this.#closed) return; this.#closed = true; this.#controller?.abort(); await this.#pending; this.#db.close(); }
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
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['tenantId', 'action', 'requestId'].includes(k))
        || !['status', 'start'].includes(input.action) || (input.action === 'status' && input.requestId !== undefined)) return reply(400, { error: 'KIM_HOST_INPUT' });
      reply(200, input.action === 'start' ? host.start(input.tenantId, input.requestId) : host.status(input.tenantId));
    } catch (error) { reply(error?.message === 'KIM_HOST_SCOPE' ? 403 : 409, { error: /^KIM_HOST_[A-Z_]+$/.test(error?.message) ? error.message : 'KIM_HOST_UNAVAILABLE' }); }
  });
}
