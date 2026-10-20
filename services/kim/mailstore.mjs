import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { openStore, transaction, Vault } from '../gkv/storage.mjs';
import { mailbox } from '../gkv/smtp.mjs';

const scrypt = promisify(scryptCallback), hash = bytes => createHash('sha256').update(bytes).digest('hex');
const kimAddress = v => mailbox(v) && /\.kim\.telematik(?:-test)?$/.test(v.split('@')[1]);
const messageId = v => typeof v === 'string' && v.length <= 250 && /^<[^<>\s\x00-\x1f]+@[^<>\s\x00-\x1f]+>$/.test(v);
async function passwordHash(password, salt) {
  if (typeof password !== 'string' || password.length > 256 || /\0/.test(password)) throw new Error('KIM_CREDENTIALS');
  return scrypt(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}
const passwordPolicy = p => typeof p === 'string' && p.length >= 14 && p.length <= 256 && !/[\x00-\x1f\x7f]/.test(p);

/** Persistent components of the OWN KIM Fachdienst. Not an admitted TI service.
 * This internal API must only be called behind verified TI mTLS, AUT-token and VZD workflows.
 * No public registration endpoint and no artificial TI identity is supplied here.
 */
export class KimMailstore {
  #db; #vault; #clock; #dummySalt = randomBytes(16); #dummyHash = randomBytes(32);
  constructor({ path, key, clock = Date.now }) {
    this.#db = openStore(path); this.#vault = new Vault(key); this.#clock = clock;
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS kim_accounts (
        address TEXT PRIMARY KEY, telematik_id TEXT NOT NULL, salt BLOB NOT NULL, password_hash BLOB NOT NULL,
        failures INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
        quota INTEGER NOT NULL CHECK(quota>0), active INTEGER NOT NULL CHECK(active IN (0,1))
      ) STRICT;
      CREATE TABLE IF NOT EXISTS kim_messages (
        uid TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES kim_accounts(address), message_id TEXT NOT NULL,
        digest TEXT NOT NULL, octets INTEGER NOT NULL, content BLOB NOT NULL,
        expires INTEGER NOT NULL, received INTEGER NOT NULL, UNIQUE(account,message_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS kim_sessions (
        account TEXT PRIMARY KEY REFERENCES kim_accounts(address), token TEXT NOT NULL, expires INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS kim_attachments (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES kim_accounts(address), recipients TEXT NOT NULL,
        digest TEXT NOT NULL, octets INTEGER NOT NULL, content BLOB NOT NULL, expires INTEGER NOT NULL
      ) STRICT;
    `);
  }
  #now() { const n = this.#clock(); if (!Number.isSafeInteger(n)) throw new Error('KIM_CLOCK'); return n; }
  #active(address) {
    const a = this.#db.prepare('SELECT * FROM kim_accounts WHERE address=? AND active=1').get(address);
    if (!a) throw new Error('KIM_ACCOUNT'); return a;
  }
  /** Trusted provisioning AFTER verified registration/VZD completion; never expose directly over HTTP. */
  async installAccount({ address, telematikId, password, quotaBytes }) {
    if (!kimAddress(address) || typeof telematikId !== 'string' || !telematikId.trim() || telematikId.length > 128 || /[\x00-\x1f\x7f]/.test(telematikId) || !passwordPolicy(password) || !Number.isSafeInteger(quotaBytes) || quotaBytes < 1) throw new Error('KIM_ACCOUNT_INPUT');
    const salt = randomBytes(16), digest = await passwordHash(password, salt);
    this.#db.prepare('INSERT INTO kim_accounts(address,telematik_id,salt,password_hash,quota,active) VALUES(?,?,?,?,?,1)').run(address, telematikId, salt, digest, quotaBytes);
  }
  async authenticate(address, password) {
    const account = this.#db.prepare('SELECT * FROM kim_accounts WHERE address=?').get(String(address));
    const digest = await passwordHash(password, account?.salt ?? this.#dummySalt);
    const matches = timingSafeEqual(digest, account?.password_hash ?? this.#dummyHash); digest.fill(0);
    return transaction(this.#db, () => {
      const current = this.#db.prepare('SELECT * FROM kim_accounts WHERE address=?').get(String(address)), now = this.#now();
      if (!current || !current.active || current.locked_until > now) return false;
      // A concurrent password change invalidates an in-flight password comparison.
      if (matches && timingSafeEqual(current.password_hash, account.password_hash)) {
        this.#db.prepare('UPDATE kim_accounts SET failures=0,locked_until=0 WHERE address=?').run(address); return true;
      }
      const failures = current.failures + 1;
      const lock = failures >= 3 ? now + Math.min(900_000, 30_000 * 2 ** Math.min(failures - 3, 5)) : 0;
      this.#db.prepare('UPDATE kim_accounts SET failures=?,locked_until=? WHERE address=?').run(failures, lock, address); return false;
    });
  }
  async changePassword(address, oldPassword, newPassword) {
    if (!passwordPolicy(newPassword)) throw new Error('KIM_PASSWORD_POLICY');
    const previous = this.#db.prepare('SELECT password_hash FROM kim_accounts WHERE address=?').get(address);
    if (!await this.authenticate(address, oldPassword)) throw new Error('KIM_CREDENTIALS');
    const salt = randomBytes(16), digest = await passwordHash(newPassword, salt);
    transaction(this.#db, () => {
      const r = this.#db.prepare('UPDATE kim_accounts SET salt=?,password_hash=?,failures=0,locked_until=0 WHERE address=? AND password_hash=? AND active=1').run(salt, digest, address, previous.password_hash);
      if (r.changes !== 1) throw new Error('KIM_ACCOUNT_CHANGED');
      this.#db.prepare('DELETE FROM kim_sessions WHERE account=?').run(address);
    });
  }
  deactivate(address) {
    transaction(this.#db, () => {
      this.#db.prepare('UPDATE kim_accounts SET active=0 WHERE address=?').run(address);
      this.#db.prepare('DELETE FROM kim_sessions WHERE account=?').run(address);
    });
  }
  deliver({ account, id, bytes, expires }) {
    if (!messageId(id) || !(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 22_020_096 || !Number.isSafeInteger(expires) || expires <= this.#now()) throw new Error('KIM_MESSAGE');
    const digest = hash(bytes), uid = randomUUID(), encrypted = this.#vault.seal(bytes, `mail:${account}:${uid}:${digest}`);
    return transaction(this.#db, () => {
      const a = this.#active(account), now = this.#now();
      const previous = this.#db.prepare('SELECT uid,digest,octets FROM kim_messages WHERE account=? AND message_id=?').get(account, id);
      if (previous) { if (previous.digest !== digest || previous.octets !== bytes.length) throw new Error('KIM_MESSAGE_CONFLICT'); return previous.uid; }
      const used = this.#db.prepare('SELECT coalesce(sum(octets),0) n FROM kim_messages WHERE account=? AND expires>?').get(account, now).n;
      if (used + bytes.length > a.quota) throw new Error('KIM_QUOTA');
      this.#db.prepare('INSERT INTO kim_messages VALUES(?,?,?,?,?,?,?,?)').run(uid, account, id, digest, bytes.length, encrypted, expires, now); return uid;
    });
  }
  beginMailbox(account) {
    return transaction(this.#db, () => {
      this.#active(account); const now = this.#now(), token = randomUUID();
      this.#db.prepare('DELETE FROM kim_sessions WHERE account=? AND expires<=?').run(account, now);
      if (this.#db.prepare('SELECT 1 FROM kim_sessions WHERE account=?').get(account)) throw new Error('KIM_MAILBOX_LOCKED');
      this.#db.prepare('INSERT INTO kim_sessions VALUES(?,?,?)').run(account, token, now + 900_000);
      const messages = this.#db.prepare('SELECT uid,octets FROM kim_messages WHERE account=? AND expires>? ORDER BY received,uid').all(account, now);
      return { token, messages: messages.map((m, i) => ({ number: i + 1, uid: m.uid, octets: m.octets })) };
    });
  }
  #session(account, token) {
    this.#active(account);
    const now = this.#now(), r = this.#db.prepare('UPDATE kim_sessions SET expires=? WHERE account=? AND token=? AND expires>?').run(now + 900_000, account, token, now);
    if (r.changes !== 1) throw new Error('KIM_SESSION');
  }
  touchMailbox(account, token) { this.#session(account, token); }
  readMessage(account, token, uid) {
    this.#session(account, token);
    const m = this.#db.prepare('SELECT * FROM kim_messages WHERE uid=? AND account=? AND expires>?').get(uid, account, this.#now());
    if (!m) throw new Error('KIM_MESSAGE_MISSING');
    const bytes = this.#vault.open(m.content, `mail:${account}:${uid}:${m.digest}`);
    if (hash(bytes) !== m.digest || bytes.length !== m.octets) throw new Error('KIM_MESSAGE_CORRUPT'); return bytes;
  }
  endMailbox(account, token, deleteUids = []) {
    transaction(this.#db, () => {
      this.#session(account, token);
      for (const uid of deleteUids) this.#db.prepare('DELETE FROM kim_messages WHERE account=? AND uid=?').run(account, uid);
      this.#db.prepare('DELETE FROM kim_sessions WHERE account=? AND token=?').run(account, token);
    });
  }
  abandonMailbox(account, token) { this.#db.prepare('DELETE FROM kim_sessions WHERE account=? AND token=?').run(account, token); }
  addAttachment({ owner, recipients, bytes, expires }) {
    if (!Array.isArray(recipients) || !recipients.length || recipients.length > 1000 || !recipients.every(kimAddress) || new Set(recipients).size !== recipients.length || !(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 256_000_000 || !Number.isSafeInteger(expires) || expires <= this.#now()) throw new Error('KIM_ATTACHMENT');
    const id = randomUUID(), digest = hash(bytes), encrypted = this.#vault.seal(bytes, `kas:${owner}:${id}:${digest}`);
    return transaction(this.#db, () => {
      const a = this.#active(owner), used = this.#db.prepare('SELECT coalesce(sum(octets),0) n FROM kim_attachments WHERE owner=? AND expires>?').get(owner, this.#now() - 3_600_000).n;
      if (used + bytes.length > a.quota) throw new Error('KIM_QUOTA');
      this.#db.prepare('INSERT INTO kim_attachments VALUES(?,?,?,?,?,?,?)').run(id, owner, JSON.stringify(recipients), digest, bytes.length, encrypted, expires);
      return id;
    });
  }
  readAttachment(id, recipient, { head = false } = {}) {
    const a = this.#db.prepare('SELECT * FROM kim_attachments WHERE id=? AND expires>?').get(id, this.#now() - 3_600_000);
    if (!a || !JSON.parse(a.recipients).includes(recipient)) throw new Error('KIM_ATTACHMENT_FORBIDDEN');
    const result = { octets: a.octets, sha256: a.digest, expires: a.expires };
    if (head) return result;
    const bytes = this.#vault.open(a.content, `kas:${a.owner}:${id}:${a.digest}`);
    if (hash(bytes) !== a.digest || bytes.length !== a.octets) throw new Error('KIM_ATTACHMENT_CORRUPT');
    return { ...result, bytes };
  }
  deleteAttachment(owner, id) { this.#active(owner); return this.#db.prepare('DELETE FROM kim_attachments WHERE owner=? AND id=?').run(owner, id).changes === 1; }
  purgeExpired() {
    const now = this.#now();
    const counts = transaction(this.#db, () => ({
      messages: this.#db.prepare('DELETE FROM kim_messages WHERE expires<=?').run(now).changes,
      attachments: this.#db.prepare('DELETE FROM kim_attachments WHERE expires<=?').run(now - 3_600_000).changes,
      sessions: this.#db.prepare('DELETE FROM kim_sessions WHERE expires<=?').run(now).changes,
    }));
    this.#db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); return counts;
  }
  close() { this.#db.close(); this.#vault.close(); }
}
