import { createHash, randomUUID } from 'node:crypto';
import { openStore, transaction, Vault, isUuid } from './storage.mjs';
import {verifyEccComponentSignedContent} from '../kim/ecc-cms.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = (tenant, capture, part) => `monthly-original-v1:${tenant}:${capture}:${part}`;

/** Existing encrypted local-worker storage. No object replacement, public URL
 * or browser storage. This is application immutability, not a WORM certification. */
export class MonthlyOriginalStore {
  #db; #vault; #quota; #closed=false;
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
    ) STRICT;
    CREATE TABLE IF NOT EXISTS monthly_components (
      tenant TEXT NOT NULL,capture TEXT NOT NULL,state TEXT NOT NULL,
      record BLOB NOT NULL,xml BLOB NOT NULL,cms BLOB,certificate BLOB,report BLOB,
      PRIMARY KEY(tenant,capture)
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
    const components=this.#db.prepare('SELECT coalesce(sum(length(record)+length(xml)+coalesce(length(cms),0)+coalesce(length(certificate),0)+coalesce(length(report),0)),0) n FROM monthly_components WHERE tenant=?').get(tenant).n;
    if (used + scans + pages + components + required > this.#quota) throw new Error('MONTHLY_STORE_QUOTA');
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
  /** Host-internal archive only. No download of a free-standing signature image.
   * State is authenticated with the content; a SQLite state edit cannot release it. */
  getComponent(tenant,capture) {
    this.#scope(tenant,capture);
    const row=this.#db.prepare('SELECT * FROM monthly_components WHERE tenant=? AND capture=?').get(tenant,capture);
    if(!row)return null;
    const open=(value,part)=>value?this.#vault.open(value,identity(tenant,capture,'component:'+part)):null;
    const record=JSON.parse(open(row.record,'record').toString('utf8')),xml=open(row.xml,'xml');
    const cms=open(row.cms,'cms'),certificate=open(row.certificate,'certificate'),report=open(row.report,'report');
    const original=this.get(tenant,capture),r=original?.receipt;
    if(!r||record.tenantId!==tenant||record.captureId!==capture||record.receiptId!==r.id
      ||record.proofId!==r.proof_id||record.revision!==r.proof_revision||record.contentSha256!==r.content_sha256
      ||record.originalSha256!==original.originalSha256||record.xmlSha256!==digest(xml)
      ||record.verification.sha256!==record.xmlSha256||record.captureBinding.xmlSha256!==record.xmlSha256
      ||row.state!==record.state||!['prepared','in-flight','signed','complete','held'].includes(record.state))throw Error('MONTHLY_COMPONENT_INTEGRITY');
    if(cms){
      const checked=verifyEccComponentSignedContent({bytes:cms,expectedSignerCertificate:certificate,now:record.signing.checkedAt});
      try{if(!checked.content.equals(xml)||record.cmsSha256!==digest(cms)||record.signing.outputSha256!==record.cmsSha256
        ||record.signing.dataSha256!==record.xmlSha256||checked.signerSha256!==record.signing.certificateSha256)throw Error('MONTHLY_COMPONENT_INTEGRITY');}
      finally{checked.content.fill(0);}
    }else if(certificate||record.signing||['signed','complete'].includes(record.state))throw Error('MONTHLY_COMPONENT_INTEGRITY');
    if(report){if(!cms||digest(report)!==record.documentVerification?.reportSha256)throw Error('MONTHLY_COMPONENT_INTEGRITY');}
    else if(record.state==='complete'||record.documentVerification)throw Error('MONTHLY_COMPONENT_INTEGRITY');
    return {record,xml,cms,certificate,report};
  }
  #writeComponent(tenant,capture,record,parts={}) {
    const prior=this.#db.prepare('SELECT * FROM monthly_components WHERE tenant=? AND capture=?').get(tenant,capture);
    const seal=(bytes,part)=>this.#vault.seal(bytes,identity(tenant,capture,'component:'+part));
    const values={record:seal(Buffer.from(JSON.stringify(record)),'record')};
    for(const part of ['xml','cms','certificate','report'])values[part]=parts[part]?seal(parts[part],part):prior?.[part]??null;
    const size=r=>['record','xml','cms','certificate','report'].reduce((n,k)=>n+(r?.[k]?.length??0),0);
    this.#remaining(tenant,size(values)-size(prior));
    this.#db.prepare(`INSERT INTO monthly_components VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tenant,capture)
      DO UPDATE SET state=excluded.state,record=excluded.record,xml=excluded.xml,cms=excluded.cms,certificate=excluded.certificate,report=excluded.report`)
      .run(tenant,capture,record.state,values.record,values.xml,values.cms,values.certificate,values.report);
    return this.getComponent(tenant,capture);
  }
  reserveComponent(tenant,capture,value) {
    this.#scope(tenant,capture);
    const candidate=structuredClone(value),xml=Buffer.from(candidate.bytes??[]),b=candidate.captureBinding,v=candidate.verification;
    return transaction(this.#db,()=>{
      const original=this.get(tenant,capture),r=original?.receipt;
      if(!r?.verified_at||!xml.length||xml.length>8*1024*1024||b?.captureId!==capture||b.proofId!==r.proof_id
        ||b.revision!==r.proof_revision||b.contentSha256!==r.content_sha256||b.originalSha256!==original.originalSha256
        ||b.xmlSha256!==digest(xml)||v?.sha256!==b.xmlSha256||v.checkedAt!==new Date(r.verified_at).toISOString()
        ||v.schemaValid!==true||v.fieldRulesValid!==true||b.displayedContentMatches!==true
        ||b.componentSignatureVerified!==false||b.dispatchReady!==false)throw Error('MONTHLY_COMPONENT_BINDING');
      const prior=this.getComponent(tenant,capture);
      if(prior){if(!prior.xml.equals(xml)||JSON.stringify(prior.record.captureBinding)!==JSON.stringify(b))throw Error('MONTHLY_COMPONENT_CONFLICT');return prior;}
      return this.#writeComponent(tenant,capture,{schema:'gkv-monthly-component-v1',tenantId:tenant,captureId:capture,
        proofId:r.proof_id,revision:r.proof_revision,receiptId:r.id,contentSha256:r.content_sha256,
        originalSha256:original.originalSha256,xmlSha256:b.xmlSha256,verification:v,captureBinding:b,
        state:'prepared',attemptId:null,hardwareEvidence:'not-attested',tiEvidence:'not-attested',dispatchReady:false},{xml});
    });
  }
  beginComponent(tenant,capture) {
    return transaction(this.#db,()=>{
      const prior=this.getComponent(tenant,capture);
      if(!prior||prior.record.state!=='prepared')throw Error('MONTHLY_COMPONENT_HELD');
      this.assertComponentAvailable(tenant);
      return this.#writeComponent(tenant,capture,{...prior.record,state:'in-flight',attemptId:randomUUID(),startedAt:Date.now()});
    });
  }
  assertComponentAvailable(tenant) {
    if(!isUuid(tenant))throw Error('MONTHLY_STORE_SCOPE');
    // Authenticate every journal state before using it as a tenant-wide lock.
    // A plaintext SQLite state edit must not hide another uncertain attempt.
    for(const row of this.#db.prepare('SELECT capture,state,record FROM monthly_components WHERE tenant=?').all(tenant)){
      const record=JSON.parse(this.#vault.open(row.record,identity(tenant,row.capture,'component:record')).toString('utf8'));
      if(record.tenantId!==tenant||record.captureId!==row.capture||record.state!==row.state)throw Error('MONTHLY_COMPONENT_INTEGRITY');
      if(['in-flight','signed','held'].includes(record.state))throw Error('MONTHLY_COMPONENT_HELD');
    }
  }
  saveComponentSignature(tenant,capture,attemptId,result,certificateInput) {
    const signature=structuredClone(result),cms=Buffer.from(signature.data??'','base64'),certificate=Buffer.from(certificateInput);
    delete signature.data;
    return transaction(this.#db,()=>{
      const prior=this.getComponent(tenant,capture);
      if(!prior||prior.record.state!=='in-flight'||prior.record.attemptId!==attemptId
        ||signature.profile!=='gkv-component-ecc-cades'||signature.operation!=='SignDocument'
        ||cms.length>8*1024*1024||!Number.isSafeInteger(signature.checkedAt))throw Error('MONTHLY_COMPONENT_BINDING');
      return this.#writeComponent(tenant,capture,{...prior.record,state:'signed',cmsSha256:digest(cms),signing:signature},{cms,certificate});
    });
  }
  completeComponent(tenant,capture,attemptId,result) {
    const verification=structuredClone(result),report=Buffer.from(verification.reportBase64??'','base64');delete verification.reportBase64;
    return transaction(this.#db,()=>{
      const prior=this.getComponent(tenant,capture),r=prior?.record;
      if(!r||r.state!=='signed'||r.attemptId!==attemptId||verification.operation!=='VerifyDocument'
        ||verification.profile!=='gkv-component-ecc-cades'||verification.verificationResult!=='VALID'
        ||verification.dataSha256!==r.cmsSha256||verification.contentSha256!==r.xmlSha256
        ||verification.certificateSha256!==r.signing.certificateSha256||!report.length||report.length>262144
        ||digest(report)!==verification.reportSha256)throw Error('MONTHLY_COMPONENT_BINDING');
      return this.#writeComponent(tenant,capture,{...r,state:'complete',completedAt:Date.now(),documentVerification:verification},{report});
    });
  }
  holdComponent(tenant,capture,attemptId) {
    return transaction(this.#db,()=>{
      const prior=this.getComponent(tenant,capture);
      if(!prior||prior.record.attemptId!==attemptId||!['in-flight','signed'].includes(prior.record.state))throw Error('MONTHLY_COMPONENT_BINDING');
      return this.#writeComponent(tenant,capture,{...prior.record,state:'held'});
    });
  }
  close() { if(this.#closed)return;this.#db.close();this.#vault.close();this.#closed=true; }
}
