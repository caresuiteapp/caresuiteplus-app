import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';

/** A persistent local worker volume, never a Vercel /tmp directory or network filesystem. */
export function openStore(path) {
  if (!isAbsolute(path)) throw new Error('STORE_ABSOLUTE_PATH');
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const directory = lstatSync(dir);
  if (!directory.isDirectory() || directory.isSymbolicLink() || directory.mode & 0o077) throw new Error('STORE_DIRECTORY_PERMISSIONS');
  try { closeSync(openSync(path, 'wx', 0o600)); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  const file = lstatSync(path);
  if (!file.isFile() || file.isSymbolicLink() || file.mode & 0o077) throw new Error('STORE_FILE_PERMISSIONS');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA secure_delete=ON;');
  return db;
}
export function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = action(); db.exec('COMMIT'); return result; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
/** Authenticated encryption binds every BLOB to its record identity; the master key is never stored in SQLite. */
export class Vault {
  #key;
  constructor(key) {
    if (!(key instanceof Uint8Array) || key.length !== 32) throw new Error('STORE_KEY');
    this.#key = Buffer.from(key);
  }
  seal(bytes, identity) {
    const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.#key, nonce);
    cipher.setAAD(Buffer.from(identity));
    const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), encrypted]);
  }
  open(blob, identity) {
    const bytes = Buffer.from(blob);
    if (bytes.length < 30 || bytes[0] !== 1) throw new Error('STORE_CIPHERTEXT');
    const cipher = createDecipheriv('aes-256-gcm', this.#key, bytes.subarray(1, 13));
    cipher.setAAD(Buffer.from(identity)); cipher.setAuthTag(bytes.subarray(13, 29));
    try { return Buffer.concat([cipher.update(bytes.subarray(29)), cipher.final()]); }
    catch { throw new Error('STORE_AUTHENTICATION'); }
  }
  close() { this.#key.fill(0); }
}
// SQLite TEXT keys must have one spelling. Case aliases must not bypass tenant/invoice reservations.
// PostgreSQL UUID output and randomUUID() already use this canonical lowercase form.
export const isUuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
