import { createHash, randomUUID } from 'node:crypto';
import { openStore, transaction, Vault, isUuid } from './storage.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = (tenant, capture, part) => `monthly-original-v1:${tenant}:${capture}:${part}`;

/** Existing encrypted local-worker storage. No object replacement, public URL
 * or browser storage. This is application immutability, not a WORM certification. */
export class MonthlyOriginalStore {
  #db; #vault; #quota;
  constructor({ path, key, maxTenantBytes = 256_000_000 }) {
    if (!Number.isSafeInteger(maxTenantBytes) || maxTenantBytes < 1024 || maxTenantBytes > 1_000_000_000) throw new Error('MONTHLY_STORE_QUOTA');
    this.#vault = new Vault(key); this.#db = openStore(path); this.#quota = maxTenantBytes;
    this.#db.exec(`CREATE TABLE IF NOT EXISTS monthly_originals (
      tenant TEXT NOT NULL, capture TEXT NOT NULL,
      original_version TEXT NOT NULL, original_digest TEXT NOT NULL, original_size INTEGER NOT NULL,
      snapshot BLOB NOT NULL, original BLOB NOT NULL, acknowledgment BLOB,
      signature_version TEXT, signature_digest TEXT, signature_ink_digest TEXT, signature_size INTEGER,
      signature BLOB, receipt BLOB,
      PRIMARY KEY(tenant,capture), UNIQUE(tenant,signature_ink_digest)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS monthly_scans (
      tenant TEXT NOT NULL,capture TEXT NOT NULL,digest TEXT NOT NULL,render_digest TEXT NOT NULL,
      version TEXT NOT NULL,document BLOB NOT NULL,manifest BLOB NOT NULL,
      PRIMARY KEY(tenant,capture),UNIQUE(tenant,digest),UNIQUE(tenant,render_digest)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS monthly_scan_pages (
      tenant TEXT NOT NULL,capture TEXT NOT NULL,page INTEGER NOT NULL,image BLOB NOT NULL,
      PRIMARY KEY(tenant,capture,page)
    ) STRICT;`);
  }
  #scope(tenant, capture) {
    if (![tenant, capture].every(isUuid)) throw new Error('MONTHLY_STORE_SCOPE');
  }
  #remaining(tenant, required) {
    const used = this.#db.prepare(`SELECT coalesce(sum(length(original)+length(snapshot)
      +coalesce(length(acknowledgment),0)+coalesce(length(signature),0)+coalesce(length(receipt),0)),0) n
      FROM monthly_originals WHERE tenant=?`).get(tenant).n;
    const scans=this.#db.prepare('SELECT coalesce(sum(length(document)+length(manifest)),0) n FROM monthly_scans WHERE tenant=?').get(tenant).n;
    const pages=this.#db.prepare('SELECT coalesce(sum(length(image)),0) n FROM monthly_scan_pages WHERE tenant=?').get(tenant).n;
    if (used + scans + pages + required > this.#quota) throw new Error('MONTHLY_STORE_QUOTA');
  }
  get(tenant, capture) {
    this.#scope(tenant, capture);
    const row = this.#db.prepare('SELECT * FROM monthly_originals WHERE tenant=? AND capture=?').get(tenant, capture);
    if (!row) return null;
    const open = (value, label) => this.#vault.open(value, identity(tenant, capture, label));
    const snapshot = JSON.parse(open(row.snapshot, 'snapshot').toString('utf8'));
    const original = open(row.original, `original:${row.original_version}:${row.original_digest}`);
    if (original.length !== row.original_size || digest(original) !== row.original_digest
      || snapshot.proof.tenant_id !== tenant || snapshot.captureId !== capture) throw new Error('MONTHLY_STORE_INTEGRITY');
    let signature = null, receipt = null;
    if (row.signature) {
      signature = open(row.signature, `signature:${row.signature_version}:${row.signature_digest}:${row.signature_ink_digest}`);
      receipt = JSON.parse(open(row.receipt, 'receipt').toString('utf8'));
      if (signature.length !== row.signature_size || digest(signature) !== row.signature_digest
        || receipt.signature_sha256 !== row.signature_digest || receipt.signature_ink_sha256 !== row.signature_ink_digest
        || receipt.signature_version !== row.signature_version || receipt.original_sha256 !== row.original_digest
        || receipt.original_version !== row.original_version || receipt.tenant_id !== tenant || receipt.capture_id !== capture) throw new Error('MONTHLY_STORE_INTEGRITY');
    } else if (row.receipt || row.signature_digest || row.signature_version || row.signature_ink_digest || row.signature_size) throw new Error('MONTHLY_STORE_INTEGRITY');
    return { snapshot, original, originalSha256: row.original_digest, originalVersion: row.original_version,
      acknowledgedAt: row.acknowledgment ? JSON.parse(open(row.acknowledgment, 'acknowledgment').toString('utf8')).at : null,
      signature, receipt };
  }
  create(snapshotInput, originalInput) {
    const snapshot = structuredClone(snapshotInput), tenant = snapshot.proof.tenant_id, capture = snapshot.captureId;
    this.#scope(tenant, capture);
    if (!(originalInput instanceof Uint8Array) || !originalInput.length || originalInput.length > 10 * 1024 * 1024) throw new Error('MONTHLY_ORIGINAL_SIZE');
    const original = Buffer.from(originalInput), encoded = Buffer.from(JSON.stringify(snapshot));
    if (encoded.length > 2_100_000) throw new Error('MONTHLY_ORIGINAL_SIZE');
    return transaction(this.#db, () => {
      const prior = this.get(tenant, capture);
      if (prior) {
        if (JSON.stringify(prior.snapshot) !== JSON.stringify(snapshot) || !prior.original.equals(original)) throw new Error('MONTHLY_CAPTURE_CONFLICT');
        return prior;
      }
      const version = randomUUID(), hash = digest(original);
      const sealedSnapshot = this.#vault.seal(encoded, identity(tenant, capture, 'snapshot'));
      const sealedOriginal = this.#vault.seal(original, identity(tenant, capture, `original:${version}:${hash}`));
      this.#remaining(tenant, sealedOriginal.length + sealedSnapshot.length);
      this.#db.prepare('INSERT INTO monthly_originals(tenant,capture,original_version,original_digest,original_size,snapshot,original) VALUES(?,?,?,?,?,?,?)')
        .run(tenant, capture, version, hash, original.length, sealedSnapshot, sealedOriginal);
      return this.get(tenant, capture);
    });
  }
  acknowledge(tenant, capture, hash, at) {
    return transaction(this.#db, () => {
      const stored = this.get(tenant, capture);
      if (!stored || stored.originalSha256 !== hash || !Number.isFinite(Date.parse(at))) throw new Error('MONTHLY_ORIGINAL_ACKNOWLEDGMENT');
      if (!stored.acknowledgedAt) {
        const sealed = this.#vault.seal(Buffer.from(JSON.stringify({ at })), identity(tenant, capture, 'acknowledgment'));
        this.#remaining(tenant, sealed.length);
        this.#db.prepare('UPDATE monthly_originals SET acknowledgment=? WHERE tenant=? AND capture=?').run(sealed, tenant, capture);
      }
      return this.get(tenant, capture);
    });
  }
  getScan(tenant,capture){
    this.#scope(tenant,capture);
    const row=this.#db.prepare('SELECT * FROM monthly_scans WHERE tenant=? AND capture=?').get(tenant,capture);
    if(!row)return null;
    const meta=JSON.parse(this.#vault.open(row.manifest,identity(tenant,capture,'scan-manifest')).toString('utf8'));
    const bytes=this.#vault.open(row.document,identity(tenant,capture,`scan:${row.version}:${row.digest}`));
    if(digest(bytes)!==row.digest||meta.scanSha256!==row.digest||meta.scanVersion!==row.version||meta.renderSha256!==row.render_digest)throw Error('MONTHLY_STORE_INTEGRITY');
    return {meta,bytes};
  }
  getScanPage(tenant,capture,page){
    const scan=this.getScan(tenant,capture),meta=scan?.meta.pages[page-1];
    const row=this.#db.prepare('SELECT image FROM monthly_scan_pages WHERE tenant=? AND capture=? AND page=?').get(tenant,capture,page);
    if(!meta||!row)throw Error('MONTHLY_PAPER_INPUT');
    const bytes=this.#vault.open(row.image,identity(tenant,capture,`scan-page:${page}:${meta.sha256}`));
    if(digest(bytes)!==meta.sha256)throw Error('MONTHLY_STORE_INTEGRITY');
    return {...meta,bytes};
  }
  reserveScan(tenant,capture,inspected){
    return transaction(this.#db,()=>{
      const original=this.get(tenant,capture),prior=this.getScan(tenant,capture);
      if(!original?.snapshot.paper||!original.acknowledgedAt)throw Error('MONTHLY_ORIGINAL_ACKNOWLEDGMENT');
      if(prior){if(!prior.bytes.equals(inspected.bytes))throw Error('MONTHLY_CAPTURE_CONFLICT');return prior.meta;}
      if(original.signature||inspected.pages.length!==original.snapshot.paper.pageCount)throw Error('MONTHLY_PAPER_INPUT');
      if(this.#db.prepare('SELECT 1 FROM monthly_scans WHERE tenant=? AND (digest=? OR render_digest=?)').get(tenant,inspected.sha256,inspected.renderSha256))throw Error('MONTHLY_SIGNATURE_REUSED');
      const version=randomUUID(),meta={scanSha256:inspected.sha256,scanVersion:version,renderSha256:inspected.renderSha256,
        pages:inspected.pages.map(({sha256,width,height})=>({sha256,width,height}))};
      const document=this.#vault.seal(inspected.bytes,identity(tenant,capture,`scan:${version}:${inspected.sha256}`));
      const manifest=this.#vault.seal(Buffer.from(JSON.stringify(meta)),identity(tenant,capture,'scan-manifest'));
      const pages=inspected.pages.map((p,i)=>this.#vault.seal(p.bytes,identity(tenant,capture,`scan-page:${i+1}:${p.sha256}`)));
      this.#remaining(tenant,document.length+manifest.length+pages.reduce((s,p)=>s+p.length,0));
      this.#db.prepare('INSERT INTO monthly_scans VALUES(?,?,?,?,?,?,?)').run(tenant,capture,inspected.sha256,inspected.renderSha256,version,document,manifest);
      pages.forEach((p,i)=>this.#db.prepare('INSERT INTO monthly_scan_pages VALUES(?,?,?,?)').run(tenant,capture,i+1,p));
      // Verify every encrypted object after writing, in the same transaction.
      const saved=this.getScan(tenant,capture);pages.forEach((_,i)=>this.getScanPage(tenant,capture,i+1));return saved.meta;
    });
  }
  /** Store the exact request before issuing it. A lost database response leaves
   * the same receipt ID and bytes available; no automatic replay is performed. */
  reserveSignature(tenant, capture, inspected, buildReceipt) {
    return transaction(this.#db, () => {
      const stored = this.get(tenant, capture);
      if (!stored?.acknowledgedAt) throw new Error('MONTHLY_ORIGINAL_ACKNOWLEDGMENT');
      if (stored.signature) {
        if (!stored.signature.equals(inspected.bytes)) throw new Error('MONTHLY_CAPTURE_CONFLICT');
        return stored;
      }
      if (this.#db.prepare('SELECT 1 FROM monthly_originals WHERE tenant=? AND signature_ink_digest=?').get(tenant, inspected.inkSha256)) throw new Error('MONTHLY_SIGNATURE_REUSED');
      const version = randomUUID(), receipt = buildReceipt(stored, version);
      const sealedSignature = this.#vault.seal(inspected.bytes, identity(tenant, capture, `signature:${version}:${inspected.sha256}:${inspected.inkSha256}`));
      const sealedReceipt = this.#vault.seal(Buffer.from(JSON.stringify(receipt)), identity(tenant, capture, 'receipt'));
      this.#remaining(tenant, sealedSignature.length + sealedReceipt.length);
      this.#db.prepare('UPDATE monthly_originals SET signature_version=?,signature_digest=?,signature_ink_digest=?,signature_size=?,signature=?,receipt=? WHERE tenant=? AND capture=?')
        .run(version, inspected.sha256, inspected.inkSha256, inspected.bytes.length,
          sealedSignature, sealedReceipt, tenant, capture);
      return this.get(tenant, capture);
    });
  }
  sealVerification(tenant, capture, at) {
    return transaction(this.#db, () => {
      const stored = this.get(tenant, capture);
      if (!stored?.signature || !Number.isFinite(Date.parse(at)) || Date.parse(at) < Date.parse(stored.receipt.captured_at)) throw new Error('MONTHLY_VERIFIER_TIME');
      if (stored.receipt.verified_at === null) {
        const receipt = { ...stored.receipt, verified_at: at,
          ...(stored.receipt.paper?{paper:{...stored.receipt.paper,reviewedAt:at}}:{}) };
        const sealed = this.#vault.seal(Buffer.from(JSON.stringify(receipt)), identity(tenant, capture, 'receipt'));
        const oldSize = this.#db.prepare('SELECT length(receipt) n FROM monthly_originals WHERE tenant=? AND capture=?').get(tenant, capture).n;
        this.#remaining(tenant, sealed.length - oldSize);
        this.#db.prepare('UPDATE monthly_originals SET receipt=? WHERE tenant=? AND capture=?')
          .run(sealed, tenant, capture);
      }
      return this.get(tenant, capture);
    });
  }
  close() { this.#db.close(); this.#vault.close(); }
}
