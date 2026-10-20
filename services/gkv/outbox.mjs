import { createHash } from 'node:crypto';
import { openStore, transaction, Vault, isUuid } from './storage.mjs';
import { verifyPreparedDelivery } from '../../api/_lib/gkv-transport.ts';
import { classicFacts } from './classic-provider.mjs';
import { mailbox } from './smtp.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
export const classicReceiptKey = facts => hash(JSON.stringify([facts.senderIk, facts.receiverIk, facts.transfer,
  [...facts.files].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).map(f => [f.name, f.size, f.stamp])]));
const serialize = d => JSON.stringify({ ...d, files: d.files.map(f => ({ ...f, bytes: Buffer.from(f.bytes).toString('base64') })) });
const deserialize = v => { const d = JSON.parse(v); d.files = d.files.map(f => ({ ...f, bytes: Buffer.from(f.bytes, 'base64') })); verifyPreparedDelivery(d); return d; };

/** Internal durable outbox. enqueue is only for a trusted, canonical release coordinator.
 * It does NOT grant Supabase permissions or substitute for the source-invoice reservation transaction.
 */
export class DurableOutbox {
  #db; #vault;
  constructor({ path, key }) {
    this.#db = openStore(path); this.#vault = new Vault(key);
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS gkv_jobs (
        id TEXT PRIMARY KEY, tenant TEXT NOT NULL, batch TEXT NOT NULL, revision INTEGER NOT NULL,
        manifest TEXT NOT NULL, request_hash TEXT NOT NULL, content BLOB NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('queued','sending','sent','delivery_unknown','cancelled')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, provider_reference TEXT,
        UNIQUE(tenant,batch,revision)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS gkv_reservations (
        tenant TEXT NOT NULL, invoice TEXT NOT NULL, job TEXT NOT NULL REFERENCES gkv_jobs(id),
        PRIMARY KEY(tenant,invoice)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS gkv_job_events (
        sequence INTEGER PRIMARY KEY, job TEXT NOT NULL REFERENCES gkv_jobs(id),
        state TEXT NOT NULL, created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS gkv_dispatch_bindings (
        job TEXT PRIMARY KEY REFERENCES gkv_jobs(id), tenant TEXT NOT NULL,
        message_id TEXT NOT NULL, envelope_id TEXT, classic_key TEXT, content BLOB NOT NULL,
        UNIQUE(tenant,message_id), UNIQUE(tenant,envelope_id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS gkv_pending_jobs ON gkv_jobs(tenant,state,created_at,id);
      CREATE INDEX IF NOT EXISTS gkv_classic_receipts ON gkv_dispatch_bindings(tenant,classic_key);
    `);
  }
  #event(id, state, time) { this.#db.prepare('INSERT INTO gkv_job_events(job,state,created_at) VALUES(?,?,?)').run(id, state, time); }
  enqueue({ id, tenantId, batchId, revision, invoiceIds, delivery }) {
    if (![id, tenantId, batchId].every(isUuid) || !Number.isSafeInteger(revision) || revision < 1 || !invoiceIds?.length || invoiceIds.length > 1000 || !invoiceIds.every(isUuid) || new Set(invoiceIds).size !== invoiceIds.length) throw new Error('OUTBOX_IDENTITY');
    verifyPreparedDelivery(delivery);
    const content = serialize(delivery), identity = `${tenantId}:${id}:${delivery.manifestSha256}`;
    const requestHash = hash(JSON.stringify({ tenantId, batchId, revision, invoiceIds: [...invoiceIds].sort(), manifest: delivery.manifestSha256 }));
    const encrypted = this.#vault.seal(Buffer.from(content), identity), time = new Date().toISOString();
    return transaction(this.#db, () => {
      const old = this.#db.prepare('SELECT request_hash FROM gkv_jobs WHERE id=?').get(id);
      if (old) {
        if (old.request_hash !== requestHash) throw new Error('OUTBOX_IDEMPOTENCY_CONFLICT');
        return false;
      }
      this.#db.prepare("INSERT INTO gkv_jobs(id,tenant,batch,revision,manifest,request_hash,content,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'queued',?,?)")
        .run(id, tenantId, batchId, revision, delivery.manifestSha256, requestHash, encrypted, time, time);
      for (const invoice of invoiceIds) this.#db.prepare('INSERT INTO gkv_reservations(tenant,invoice,job) VALUES(?,?,?)').run(tenantId, invoice, id);
      this.#event(id, 'queued', time); return true;
    });
  }
  read(tenant, id) {
    const row = this.#db.prepare('SELECT * FROM gkv_jobs WHERE tenant=? AND id=?').get(tenant, id);
    if (!row) return null;
    const delivery = deserialize(this.#vault.open(row.content, `${tenant}:${id}:${row.manifest}`).toString());
    if (delivery.manifestSha256 !== row.manifest) throw new Error('OUTBOX_MANIFEST');
    return { id, batchId: row.batch, revision: row.revision, state: row.state, providerReference: row.provider_reference, delivery };
  }
  pending(tenant, limit = 20) {
    if (!isUuid(tenant) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('OUTBOX_QUERY');
    return this.#db.prepare("SELECT id FROM gkv_jobs WHERE tenant=? AND state='queued' ORDER BY created_at,id LIMIT ?").all(tenant, limit).map(r => r.id);
  }
  dispatchBinding(tenant, id) {
    const row = this.#db.prepare('SELECT b.*,j.manifest FROM gkv_dispatch_bindings b JOIN gkv_jobs j ON j.id=b.job AND j.tenant=b.tenant WHERE b.tenant=? AND b.job=?').get(tenant, id);
    if (!row) return null;
    const binding = JSON.parse(this.#vault.open(row.content, `${tenant}:${id}:${row.manifest}:dispatch`).toString());
    if (binding.messageId !== row.message_id || (binding.envelopeId ?? null) !== row.envelope_id || binding.classicKey !== row.classic_key || binding.manifestSha256 !== row.manifest) throw new Error('OUTBOX_DISPATCH_INTEGRITY');
    return binding;
  }
  /** Persist before claim/network I/O. A bound job cannot silently change destination or route version. */
  bindDispatch(tenant, id, { routeId, routeVersion, from, to, dsn = false, createdAt }) {
    if (![routeId, routeVersion].every(s => typeof s === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(s)) || !mailbox(from) || !mailbox(to)
      || typeof dsn !== 'boolean' || typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) throw new Error('OUTBOX_DISPATCH_CONFIGURATION');
    return transaction(this.#db, () => {
      const job = this.read(tenant, id);
      if (!job) throw new Error('OUTBOX_JOB');
      const old = this.dispatchBinding(tenant, id);
      if (old) {
        if (old.routeId !== routeId || old.routeVersion !== routeVersion || old.from !== from || old.to !== to || Boolean(old.envelopeId) !== dsn) throw new Error('OUTBOX_ROUTE_CHANGED');
        return old;
      }
      if (job.state !== 'queued') throw new Error('OUTBOX_STATE');
      const facts = classicFacts(job.delivery), messageId = `<${id}@${from.split('@')[1]}>`, envelopeId = dsn ? id : null;
      const binding = { routeId, routeVersion, from, to, createdAt: new Date(createdAt).toISOString(), messageId, envelopeId,
        manifestSha256: job.delivery.manifestSha256, classicKey: classicReceiptKey(facts), classicFacts: facts };
      const content = this.#vault.seal(Buffer.from(JSON.stringify(binding)), `${tenant}:${id}:${job.delivery.manifestSha256}:dispatch`);
      this.#db.prepare('INSERT INTO gkv_dispatch_bindings(job,tenant,message_id,envelope_id,classic_key,content) VALUES(?,?,?,?,?,?)')
        .run(id, tenant, messageId, envelopeId, binding.classicKey, content);
      return binding;
    });
  }
  receiptCandidates(tenant, { messageId = null, envelopeId = null, classicKey = null }) {
    if (!isUuid(tenant)) throw new Error('OUTBOX_TENANT');
    // Union first: conflicting identifiers must be detected, not silently reduced to a convenient match.
    return this.#db.prepare(`SELECT b.job,j.state FROM gkv_dispatch_bindings b JOIN gkv_jobs j ON j.id=b.job AND j.tenant=b.tenant WHERE b.tenant=? AND
      (b.message_id=? OR b.envelope_id=? OR b.classic_key=?) LIMIT 4`).all(tenant, messageId, envelopeId, classicKey)
      .map(r => ({ id: r.job, binding: this.dispatchBinding(tenant, r.job), state: r.state }));
  }
  journal(tenant) {
    if (!isUuid(tenant)) throw new Error('OUTBOX_TENANT');
    return {
      claim: async (id, manifest) => transaction(this.#db, () => {
        const row = this.read(tenant, id);
        if (!row || row.delivery.manifestSha256 !== manifest) return false;
        const time = new Date().toISOString();
        const r = this.#db.prepare("UPDATE gkv_jobs SET state='sending',updated_at=? WHERE tenant=? AND id=? AND manifest=? AND state='queued'").run(time, tenant, id, manifest);
        if (r.changes) this.#event(id, 'sending', time);
        return r.changes === 1;
      }),
      finish: async (id, state, reference) => {
        if (!['sent', 'delivery_unknown'].includes(state) || (state === 'sent' && (typeof reference !== 'string' || !reference.trim() || reference.length > 512 || /[\x00-\x1f\x7f]/.test(reference)))) throw new Error('OUTBOX_COMPLETION');
        transaction(this.#db, () => {
          const time = new Date().toISOString();
          const r = this.#db.prepare("UPDATE gkv_jobs SET state=?,provider_reference=?,updated_at=? WHERE tenant=? AND id=? AND state='sending'").run(state, state === 'sent' ? reference : null, time, tenant, id);
          if (r.changes !== 1) throw new Error('OUTBOX_STATE');
          this.#event(id, state, time);
        });
      },
    };
  }
  cancel(tenant, id) {
    return transaction(this.#db, () => {
      const time = new Date().toISOString();
      const r = this.#db.prepare("UPDATE gkv_jobs SET state='cancelled',updated_at=? WHERE tenant=? AND id=? AND state='queued'").run(time, tenant, id);
      if (!r.changes) return false;
      this.#db.prepare('DELETE FROM gkv_reservations WHERE tenant=? AND job=?').run(tenant, id);
      this.#event(id, 'cancelled', time); return true;
    });
  }
  events(tenant, id) {
    return this.#db.prepare('SELECT e.sequence,e.state,e.created_at FROM gkv_job_events e JOIN gkv_jobs j ON j.id=e.job WHERE j.tenant=? AND j.id=? ORDER BY e.sequence').all(tenant, id);
  }
  // An interrupted 'sending' job remains reserved forever until reconciled outside automatic dispatch.
  // No expiry, lease reset, automatic retry or user-editable switch can cause a duplicate send.
  close() { this.#db.close(); this.#vault.close(); }
}
