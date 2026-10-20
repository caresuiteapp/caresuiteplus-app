import { randomUUID, createHash } from 'node:crypto';
import { openStore, transaction, Vault, isUuid } from './storage.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const uidValid = uid => typeof uid === 'string' && /^[\x21-\x7e]{1,70}$/.test(uid);
const rawIdentity = row => `${row.tenant}:${row.mailbox}:${row.uid}:${row.digest}:raw`;

/** Durable original mail, not a billing status authority. No plaintext body, address or diagnosis in SQL/logs. */
export class ReceiptInbox {
  #db; #vault; #quota;
  constructor({ path, key, maxMailboxBytes = 256_000_000 }) {
    if (!Number.isSafeInteger(maxMailboxBytes) || maxMailboxBytes < 1 || maxMailboxBytes > 10_000_000_000) throw new Error('INBOX_QUOTA_CONFIGURATION');
    this.#vault = new Vault(key); this.#db = openStore(path); this.#quota = maxMailboxBytes;
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS receipt_mailboxes (
        tenant TEXT NOT NULL, id TEXT NOT NULL, identity_hash TEXT NOT NULL, content BLOB NOT NULL, PRIMARY KEY(tenant,id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS receipt_messages (
        id TEXT PRIMARY KEY, tenant TEXT NOT NULL, mailbox TEXT NOT NULL, uid TEXT NOT NULL,
        digest TEXT NOT NULL, octets INTEGER NOT NULL, content BLOB NOT NULL, received_at TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('received','classified','quarantined')),
        analysis BLOB, deletion_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(deletion_confirmed IN (0,1)),
        UNIQUE(tenant,mailbox,uid), FOREIGN KEY(tenant,mailbox) REFERENCES receipt_mailboxes(tenant,id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS receipt_pending ON receipt_messages(tenant,mailbox,state,received_at,id);
    `);
  }
  /** A UID namespace is inseparable from a tenant and one configured mail account. */
  bindMailbox({ tenantId, mailboxId, host, port, servername, username }) {
    if (![tenantId, mailboxId].every(isUuid) || ![host, servername, username].every(s => typeof s === 'string' && /^[\x21-\x7e]{1,254}$/.test(s))
      || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INBOX_MAILBOX');
    const content = Buffer.from(JSON.stringify({ host, port, servername, username })), digest = hash(content), aad = `${tenantId}:${mailboxId}:account`;
    transaction(this.#db, () => {
      const old = this.#db.prepare('SELECT * FROM receipt_mailboxes WHERE tenant=? AND id=?').get(tenantId, mailboxId);
      if (old) {
        if (hash(this.#vault.open(old.content, aad)) !== old.identity_hash) throw new Error('INBOX_MAILBOX_INTEGRITY');
        if (old.identity_hash !== digest) throw new Error('INBOX_MAILBOX_CHANGED');
      } else this.#db.prepare('INSERT INTO receipt_mailboxes VALUES(?,?,?,?)').run(tenantId, mailboxId, digest, this.#vault.seal(content, aad));
    });
  }
  record({ tenantId, mailboxId, uid, bytes, receivedAt = new Date().toISOString() }) {
    if (![tenantId, mailboxId].every(isUuid) || !uidValid(uid) || !(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 32_000_000
      || typeof receivedAt !== 'string' || !Number.isFinite(Date.parse(receivedAt))) throw new Error('INBOX_MESSAGE');
    // Copy before hashing; no mutable caller buffer survives the durable identity check.
    const content = Buffer.from(bytes), digest = hash(content);
    return transaction(this.#db, () => {
      const old = this.#db.prepare('SELECT * FROM receipt_messages WHERE tenant=? AND mailbox=? AND uid=?').get(tenantId, mailboxId, uid);
      if (old) {
        if (old.digest !== digest || old.octets !== content.length) throw new Error('INBOX_UID_CONFLICT');
        if (!this.#vault.open(old.content, rawIdentity(old)).equals(content)) throw new Error('INBOX_INTEGRITY');
        return { id: old.id, sha256: digest, inserted: false };
      }
      const used = this.#db.prepare('SELECT coalesce(sum(octets),0) AS size FROM receipt_messages WHERE tenant=? AND mailbox=?').get(tenantId, mailboxId).size;
      if (used + content.length > this.#quota) throw new Error('INBOX_QUOTA');
      const id = randomUUID(), identity = { tenant: tenantId, mailbox: mailboxId, uid, digest };
      this.#db.prepare("INSERT INTO receipt_messages(id,tenant,mailbox,uid,digest,octets,content,received_at,state) VALUES(?,?,?,?,?,?,?,?,'received')")
        .run(id, tenantId, mailboxId, uid, digest, content.length, this.#vault.seal(content, rawIdentity(identity)), new Date(receivedAt).toISOString());
      return { id, sha256: digest, inserted: true };
    });
  }
  get(tenant, id) {
    const row = this.#db.prepare('SELECT * FROM receipt_messages WHERE tenant=? AND id=?').get(tenant, id);
    if (!row) return null;
    const bytes = this.#vault.open(row.content, rawIdentity(row));
    if (hash(bytes) !== row.digest || bytes.length !== row.octets) throw new Error('INBOX_INTEGRITY');
    const analysis = row.analysis ? JSON.parse(this.#vault.open(row.analysis, `${tenant}:${id}:${row.digest}:analysis`).toString()) : null;
    return { id, mailboxId: row.mailbox, uid: row.uid, sha256: row.digest, bytes, receivedAt: row.received_at, state: row.state, analysis, deletionConfirmed: row.deletion_confirmed === 1 };
  }
  pending(tenant, mailboxId, limit = 100) {
    if (![tenant, mailboxId].every(isUuid) || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error('INBOX_QUERY');
    return this.#db.prepare("SELECT id FROM receipt_messages WHERE tenant=? AND mailbox=? AND state='received' ORDER BY received_at,id LIMIT ?")
      .all(tenant, mailboxId, limit).map(r => r.id);
  }
  /** Internal analysis only. Even a correlated receipt remains explicitly unverified. */
  classify(tenant, id, result) {
    if (!result || result.authenticity !== 'unverified' || !['classified', 'quarantined'].includes(result.state)
      || typeof result.reason !== 'string' || !/^[A-Z_]{1,80}$/.test(result.reason)) throw new Error('INBOX_ANALYSIS');
    const encoded = Buffer.from(JSON.stringify(result)); if (encoded.length > 65_536) throw new Error('INBOX_ANALYSIS_LIMIT');
    return transaction(this.#db, () => {
      const message = this.get(tenant, id); if (!message) throw new Error('INBOX_MESSAGE_NOT_FOUND');
      if (message.state !== 'received') return message.analysis;
      const sealed = this.#vault.seal(encoded, `${tenant}:${id}:${message.sha256}:analysis`);
      this.#db.prepare('UPDATE receipt_messages SET state=?,analysis=? WHERE tenant=? AND id=?').run(result.state, sealed, tenant, id);
      return JSON.parse(encoded.toString());
    });
  }
  confirmDeletion(tenant, mailboxId, records) {
    transaction(this.#db, () => {
      for (const record of records) {
        const r = this.#db.prepare('UPDATE receipt_messages SET deletion_confirmed=1 WHERE tenant=? AND mailbox=? AND id=? AND digest=?')
          .run(tenant, mailboxId, record.id, record.sha256);
        if (r.changes !== 1) throw new Error('INBOX_DELETE_CORRELATION');
      }
    });
  }
  close() { this.#db.close(); this.#vault.close(); }
}
