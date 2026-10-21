import { createHash } from 'node:crypto';
import { openStore, transaction, Vault, isUuid } from '../gkv/storage.mjs';
import { TslVerifier, TslError } from './tsl.mjs';

const fail = code => { throw new TslError(code); };
const hash = b => createHash('sha256').update(b).digest('hex');
const same = (a, b) => a?.root_id === b?.root_id && a?.sequence === b?.sequence && a?.xml_sha === b?.xml_sha && a?.signer_sha === b?.signer_sha;

/** Persistent high-water mark plus encrypted originals. Expiry never deletes the
 * checkpoint. A protected durable volume and externally managed 32-byte key are
 * required; restoring an older database requires external rollback protection.
 */
export class TslTrustStore {
  #db; #vault; #verifier; #scope; #binding; #closed = false;
  constructor({ path, key, scopeId, verifier }) {
    try {
      if (!isUuid(scopeId) || !(verifier instanceof TslVerifier)) fail('KIM_TSL_STORE_CONFIGURATION');
      this.#scope = scopeId; this.#verifier = verifier; this.#binding = verifier.bindingSha256;
      this.#vault = new Vault(key); this.#db = openStore(path);
      this.#db.exec(`CREATE TABLE IF NOT EXISTS kim_tsl_trust_v1 (
        scope_id TEXT PRIMARY KEY, binding_sha TEXT NOT NULL, key_check BLOB NOT NULL,
        root_id TEXT, sequence INTEGER, xml_sha TEXT, signer_sha TEXT, payload BLOB,
        CHECK ((root_id IS NULL AND sequence IS NULL AND xml_sha IS NULL AND signer_sha IS NULL AND payload IS NULL)
          OR (root_id IS NOT NULL AND sequence > 0 AND xml_sha IS NOT NULL AND signer_sha IS NOT NULL AND payload IS NOT NULL))
      ) STRICT;`);
      transaction(this.#db, () => {
        const row = this.#row(), aad = JSON.stringify(['tsl-key', this.#scope, this.#binding]);
        if (row) {
          if (row.binding_sha !== this.#binding) fail('KIM_TSL_STORE_BINDING');
          if (this.#vault.open(row.key_check, aad).toString('utf8') !== 'kim-tsl-key-v1') fail('KIM_TSL_STORE_KEY');
          if (row.root_id !== null) this.#read(row); // Authenticate the checkpoint as well as the encryption key.
        } else {
          this.#db.prepare('INSERT INTO kim_tsl_trust_v1(scope_id,binding_sha,key_check) VALUES (?,?,?)')
            .run(this.#scope, this.#binding, this.#vault.seal(Buffer.from('kim-tsl-key-v1'), aad));
        }
      });
    } catch (error) {
      try { this.#db?.close(); } finally { this.#vault?.close(); }
      if (error instanceof TslError) throw error;
      fail('KIM_TSL_STORE_CONFIGURATION');
    }
  }
  #open() { if (this.#closed) fail('KIM_TSL_STORE_CLOSED'); }
  #row() { return this.#db.prepare('SELECT * FROM kim_tsl_trust_v1 WHERE scope_id=?').get(this.#scope); }
  #aad(row) { return JSON.stringify(['tsl-bundle-v1', this.#scope, this.#binding, row.root_id, row.sequence, row.xml_sha, row.signer_sha]); }
  #read(row) {
    if (row.binding_sha !== this.#binding || !Number.isSafeInteger(row.sequence) || row.sequence < 1
      || !/^[a-f0-9]{64}$/.test(row.xml_sha) || !/^[a-f0-9]{64}$/.test(row.signer_sha)
      || row.payload.length > 12 * 1024 * 1024) fail('KIM_TSL_STORE_INTEGRITY');
    const raw = JSON.parse(this.#vault.open(row.payload, this.#aad(row))), xml = Buffer.from(raw.xml, 'base64'), signature = Buffer.from(raw.signature, 'base64');
    if (xml.length > 8 * 1024 * 1024 || !xml.length || signature.length > 16000 || !signature.length
      || xml.toString('base64') !== raw.xml || signature.toString('base64') !== raw.signature || hash(xml) !== row.xml_sha) fail('KIM_TSL_STORE_INTEGRITY');
    return { xml, detachedSignature: signature };
  }
  async activate(bundle) {
    try {
      this.#open();
      const snapshot = await this.#verifier.verify(bundle), m = snapshot.metadata, saved = snapshot.exportBundle();
      this.#open();
      const candidate = { root_id: m.id, sequence: m.sequence, xml_sha: m.xmlSha256, signer_sha: m.signerSha256 };
      const changed = transaction(this.#db, () => {
        const current = this.#row();
        if (!current || current.binding_sha !== this.#binding) fail('KIM_TSL_STORE_BINDING');
        if (current.root_id !== null) {
          this.#read(current);
          if (same(current, candidate)) return false;
          if (current.sequence === candidate.sequence && current.root_id === candidate.root_id) fail('KIM_TSL_EQUIVOCATION');
          if (candidate.sequence <= current.sequence || candidate.root_id === current.root_id) fail('KIM_TSL_ROLLBACK');
        }
        const payload = this.#vault.seal(Buffer.from(JSON.stringify({ xml: saved.xml.toString('base64'), signature: saved.detachedSignature.toString('base64') })), this.#aad(candidate));
        this.#db.prepare('UPDATE kim_tsl_trust_v1 SET root_id=?,sequence=?,xml_sha=?,signer_sha=?,payload=? WHERE scope_id=?')
          .run(candidate.root_id, candidate.sequence, candidate.xml_sha, candidate.signer_sha, payload, this.#scope);
        return true;
      });
      return Object.freeze({ snapshot, changed });
    } catch (error) { if (error instanceof TslError) throw error; fail('KIM_TSL_STORE_INTEGRITY'); }
  }
  async load({ signerStatus } = {}) {
    try {
      this.#open();
      const row = this.#row();
      if (!row || row.binding_sha !== this.#binding) fail('KIM_TSL_STORE_BINDING');
      if (row.root_id === null) fail('KIM_TSL_STORE_EMPTY');
      const snapshot = await this.#verifier.verify({ ...this.#read(row), signerStatus });
      this.#open();
      if (!same(row, this.#row())) fail('KIM_TSL_STORE_CHANGED');
      const m = snapshot.metadata;
      if (m.id !== row.root_id || m.sequence !== row.sequence || m.xmlSha256 !== row.xml_sha || m.signerSha256 !== row.signer_sha) fail('KIM_TSL_STORE_INTEGRITY');
      snapshot.exportBundle(); // Recheck expiry after asynchronous verification.
      return snapshot;
    } catch (error) { if (error instanceof TslError) throw error; fail('KIM_TSL_STORE_INTEGRITY'); }
  }
  close() {
    if (this.#closed) return;
    this.#closed = true;
    try { this.#db.close(); } finally { this.#vault.close(); }
  }
}
