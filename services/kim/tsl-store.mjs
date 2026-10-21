import { createHash } from 'node:crypto';
import { openStore, transaction, Vault, isUuid } from '../gkv/storage.mjs';
import { TslVerifier, TslError } from './tsl.mjs';

const fail = code => { throw new TslError(code); };
const hash = b => createHash('sha256').update(b).digest('hex');
const same = (a, b) => a?.root_id === b?.root_id && a?.sequence === b?.sequence && a?.xml_sha === b?.xml_sha && a?.signer_sha === b?.signer_sha;
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function checkSignal(signal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) fail('KIM_TSL_STORE_CONFIGURATION');
  if (signal?.aborted) fail('KIM_TSL_ABORTED');
}
const version = row => row.root_id === null ? null : Object.freeze({ id: row.root_id, sequence: row.sequence, xmlSha256: row.xml_sha, signerSha256: row.signer_sha });

/** Persistent high-water mark plus encrypted originals. Expiry never deletes the
 * checkpoint. A protected durable volume and externally managed 32-byte key are
 * required; restoring an older database requires external rollback protection.
 */
export class TslTrustStore {
  #db; #vault; #verifier; #scope; #binding; #source; #closed = false;
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
      ) STRICT;
      CREATE TABLE IF NOT EXISTS kim_tsl_checkpoint_v1 (
        scope_id TEXT PRIMARY KEY REFERENCES kim_tsl_trust_v1(scope_id), content BLOB NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS kim_tsl_download_binding_v1 (
        scope_id TEXT PRIMARY KEY REFERENCES kim_tsl_trust_v1(scope_id), source_sha TEXT NOT NULL, content BLOB NOT NULL
      ) STRICT;`);
      transaction(this.#db, () => {
        let row = this.#row(); const aad = JSON.stringify(['tsl-key', this.#scope, this.#binding]);
        if (row) {
          if (row.binding_sha !== this.#binding) fail('KIM_TSL_STORE_BINDING');
          const format = this.#vault.open(row.key_check, aad).toString('utf8');
          if (!['kim-tsl-key-v1', 'kim-tsl-key-v2'].includes(format)) fail('KIM_TSL_STORE_KEY');
          if (format === 'kim-tsl-key-v2' && row.checkpoint === null) fail('KIM_TSL_STORE_INTEGRITY');
          if (row.root_id !== null) this.#read(row);
        } else {
          this.#db.prepare('INSERT INTO kim_tsl_trust_v1(scope_id,binding_sha,key_check) VALUES (?,?,?)')
            .run(this.#scope, this.#binding, this.#vault.seal(Buffer.from('kim-tsl-key-v1'), aad));
          row = this.#row();
        }
        // Upgrade existing stores only after authenticating their full bundle.
        if (row.checkpoint === null) this.#writeCheckpoint(row);
        this.#check(this.#row());
        this.#db.prepare('UPDATE kim_tsl_trust_v1 SET key_check=? WHERE scope_id=?')
          .run(this.#vault.seal(Buffer.from('kim-tsl-key-v2'), aad), this.#scope);
      });
    } catch (error) {
      try { this.#db?.close(); } catch { /* Preserve the bounded error. */ } finally { this.#vault?.close(); }
      if (error instanceof TslError) throw error;
      fail('KIM_TSL_STORE_CONFIGURATION');
    }
  }
  get verifier() { return this.#verifier; }
  #open() { if (this.#closed) fail('KIM_TSL_STORE_CLOSED'); }
  #row(full = true) {
    return this.#db.prepare(`SELECT ${full ? 't.*' : 't.binding_sha,t.root_id,t.sequence,t.xml_sha,t.signer_sha'}, c.content AS checkpoint,
      b.source_sha,b.content AS source_check FROM kim_tsl_trust_v1 t
      LEFT JOIN kim_tsl_checkpoint_v1 c ON c.scope_id=t.scope_id
      LEFT JOIN kim_tsl_download_binding_v1 b ON b.scope_id=t.scope_id WHERE t.scope_id=?`).get(this.#scope);
  }
  #aad(row) { return JSON.stringify(['tsl-bundle-v1', this.#scope, this.#binding, row.root_id, row.sequence, row.xml_sha, row.signer_sha]); }
  #sourceAad(source) { return JSON.stringify(['tsl-source-v1', this.#scope, this.#binding, source]); }
  #checkpointAad(row) { return JSON.stringify(['tsl-checkpoint-v1', this.#aad(row), row.source_sha ?? null]); }
  #writeCheckpoint(row) {
    const content = this.#vault.seal(Buffer.from('tsl-checkpoint-v1'), this.#checkpointAad(row));
    this.#db.prepare('INSERT INTO kim_tsl_checkpoint_v1 VALUES (?,?) ON CONFLICT(scope_id) DO UPDATE SET content=excluded.content').run(this.#scope, content);
  }
  #check(row) {
    if (!row || row.binding_sha !== this.#binding) fail('KIM_TSL_STORE_BINDING');
    if (row.root_id !== null && (typeof row.root_id !== 'string' || !row.root_id.length || row.root_id.length > 256
      || !Number.isSafeInteger(row.sequence) || row.sequence < 1 || !sha(row.xml_sha) || !sha(row.signer_sha))) fail('KIM_TSL_STORE_INTEGRITY');
    if (this.#source !== undefined && row.source_sha !== this.#source) fail('KIM_TSL_STORE_SOURCE');
    if (!row.checkpoint || row.checkpoint.length > 128
      || this.#vault.open(row.checkpoint, this.#checkpointAad(row)).toString() !== 'tsl-checkpoint-v1') fail('KIM_TSL_STORE_INTEGRITY');
    if (row.source_sha !== null && (!sha(row.source_sha) || !row.source_check || row.source_check.length > 128
      || this.#vault.open(row.source_check, this.#sourceAad(row.source_sha)).toString() !== 'tsl-source-v1')) fail('KIM_TSL_STORE_SOURCE');
  }
  #read(row) {
    if (row.binding_sha !== this.#binding || !Number.isSafeInteger(row.sequence) || row.sequence < 1
      || !sha(row.xml_sha) || !sha(row.signer_sha) || !row.payload || row.payload.length > 12 * 1024 * 1024) fail('KIM_TSL_STORE_INTEGRITY');
    const raw = JSON.parse(this.#vault.open(row.payload, this.#aad(row))), xml = Buffer.from(raw.xml, 'base64'), signature = Buffer.from(raw.signature, 'base64');
    if (xml.length > 8 * 1024 * 1024 || !xml.length || signature.length > 16000 || !signature.length
      || xml.toString('base64') !== raw.xml || signature.toString('base64') !== raw.signature || hash(xml) !== row.xml_sha) fail('KIM_TSL_STORE_INTEGRITY');
    return { xml, detachedSignature: signature };
  }
  bindSource(sourceSha256) {
    try {
      this.#open();
      if (!sha(sourceSha256)) fail('KIM_TSL_STORE_SOURCE');
      transaction(this.#db, () => {
        const row = this.#row(false); this.#check(row);
        if (row.source_sha !== null) {
          if (row.source_sha !== sourceSha256) fail('KIM_TSL_STORE_SOURCE');
        } else {
          this.#db.prepare('INSERT INTO kim_tsl_download_binding_v1 VALUES(?,?,?)')
            .run(this.#scope, sourceSha256, this.#vault.seal(Buffer.from('tsl-source-v1'), this.#sourceAad(sourceSha256)));
          this.#writeCheckpoint({ ...row, source_sha: sourceSha256 });
        }
      });
      this.#source = sourceSha256;
    } catch (error) { if (error instanceof TslError) throw error; fail('KIM_TSL_STORE_INTEGRITY'); }
  }
  currentVersion() {
    try { this.#open(); const row = this.#row(false); this.#check(row); return version(row); }
    catch (error) { if (error instanceof TslError) throw error; fail('KIM_TSL_STORE_INTEGRITY'); }
  }
  /** Originals are candidates, never authorization. Deliberately works after expiry. */
  candidate() {
    try {
      this.#open(); const row = this.#row(); this.#check(row);
      return row.root_id === null ? null : Object.freeze({ ...version(row), ...this.#read(row) });
    } catch (error) { if (error instanceof TslError) throw error; fail('KIM_TSL_STORE_INTEGRITY'); }
  }
  async activate(bundle, { signal } = {}) {
    try {
      this.#open(); checkSignal(signal);
      const snapshot = await this.#verifier.verify(bundle, { signal }), m = snapshot.metadata, saved = snapshot.exportBundle();
      this.#open(); checkSignal(signal);
      const candidate = { root_id: m.id, sequence: m.sequence, xml_sha: m.xmlSha256, signer_sha: m.signerSha256 };
      const changed = transaction(this.#db, () => {
        checkSignal(signal);
        const current = this.#row(); this.#check(current);
        if (current.root_id !== null) {
          this.#read(current);
          if (same(current, candidate)) return false;
          if (current.sequence === candidate.sequence && current.root_id === candidate.root_id) fail('KIM_TSL_EQUIVOCATION');
          if (candidate.sequence <= current.sequence || candidate.root_id === current.root_id) fail('KIM_TSL_ROLLBACK');
        }
        const payload = this.#vault.seal(Buffer.from(JSON.stringify({ xml: saved.xml.toString('base64'), signature: saved.detachedSignature.toString('base64') })), this.#aad(candidate));
        this.#db.prepare('UPDATE kim_tsl_trust_v1 SET root_id=?,sequence=?,xml_sha=?,signer_sha=?,payload=? WHERE scope_id=?')
          .run(candidate.root_id, candidate.sequence, candidate.xml_sha, candidate.signer_sha, payload, this.#scope);
        this.#writeCheckpoint({ ...candidate, source_sha: current.source_sha });
        return true;
      });
      return Object.freeze({ snapshot, changed });
    } catch (error) { if (error instanceof TslError) throw error; fail('KIM_TSL_STORE_INTEGRITY'); }
  }
  async load({ signerStatus, signal } = {}) {
    try {
      this.#open(); checkSignal(signal);
      const row = this.#row(); this.#check(row);
      if (row.root_id === null) fail('KIM_TSL_STORE_EMPTY');
      const snapshot = await this.#verifier.verify({ ...this.#read(row), signerStatus }, { signal });
      this.#open(); checkSignal(signal);
      const after = this.#row(false); this.#check(after);
      if (!same(row, after)) fail('KIM_TSL_STORE_CHANGED');
      const m = snapshot.metadata;
      if (m.id !== row.root_id || m.sequence !== row.sequence || m.xmlSha256 !== row.xml_sha || m.signerSha256 !== row.signer_sha) fail('KIM_TSL_STORE_INTEGRITY');
      snapshot.exportBundle();
      return snapshot;
    } catch (error) { if (error instanceof TslError) throw error; fail('KIM_TSL_STORE_INTEGRITY'); }
  }
  close() {
    if (this.#closed) return;
    this.#closed = true;
    try { this.#db.close(); } catch { fail('KIM_TSL_STORE_INTEGRITY'); } finally { this.#vault.close(); }
  }
}
