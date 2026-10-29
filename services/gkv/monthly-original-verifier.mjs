import { readMonthlyAuthority, authorityAvailable } from '../../src/lib/gkvExchange/monthlyAuthority.ts';
import { randomUUID } from 'node:crypto';
import { readMonthlyProof } from '../../src/lib/gkvExchange/monthlyProof.ts';
import { isUuid } from './storage.mjs';
import { renderMonthlyOriginalDocument } from './monthly-original-pdf.mjs';
import { inspectMonthlySignature } from './monthly-signature-png.mjs';
import {inspectMonthlyScan,cropMonthlyScan} from './monthly-scan.mjs';
import {readPaperReview} from '../../src/lib/gkvExchange/monthlyPaper.ts';

const canonical = value => JSON.stringify(value, function(_key, v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v;
});
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const fail = code => { throw new Error(code); };
function request(input) {
  if (!input || Object.keys(input).some(k => !['tenantId','proofId','revision','captureId','authorityId','method'].includes(k))
    || ![input.tenantId, input.proofId, input.captureId].every(isUuid)
    || (input.method !== undefined && input.method !== 'paper')
    || (input.authorityId !== undefined && !isUuid(input.authorityId))
    || !Number.isSafeInteger(input.revision) || input.revision < 1) fail('MONTHLY_VERIFIER_REQUEST');
  return structuredClone(input);
}

/** Private SQL adapter: use a reviewed worker connection with current personal
 * identity. These functions have no anon/authenticated/service_role grant and
 * are not Data API entry points. Never expose this connection to a browser. */
export function monthlyOriginalDatabase(query) {
  return {
    async context({ tenantId, proofId, revision, authorityId }) {
      const result = await query('SELECT care_security.gkv_monthly_verifier_context($1::uuid,$2::uuid,$3::integer,$4::uuid) value', [tenantId, proofId, revision, authorityId ?? null]);
      if (result.rows?.length !== 1) fail('MONTHLY_VERIFIER_CONTEXT');
      return result.rows[0].value;
    },
    async readContext({ tenantId, proofId }) {
      const result = await query('SELECT care_security.gkv_monthly_original_read_context($1::uuid,$2::uuid) value', [tenantId, proofId]);
      if (result.rows?.length !== 1) fail('MONTHLY_VERIFIER_CONTEXT');
      return result.rows[0].value;
    },
    async issue(receipt) {
      const result = await query('SELECT care_security.gkv_monthly_accept_verified_receipt($1::jsonb) value', [JSON.stringify(receipt)]);
      if (result.rows?.length !== 1) fail('MONTHLY_VERIFIER_RECEIPT');
      return result.rows[0].value;
    },
    async receiptStatus(receipt) {
      const result = await query('SELECT care_security.gkv_monthly_verified_receipt_status($1::jsonb) value', [JSON.stringify(receipt)]);
      if (result.rows?.length !== 1) fail('MONTHLY_VERIFIER_RECEIPT');
      return result.rows[0].value;
    },
  };
}

/** Personal patient/representative confirmation including reviewed paper scans.
 * Production provisioning and normative XML/CMS remain separate work packages.
 * No actual monthly record is finalized here: the existing actor-bound confirm
 * command consumes the private receipt and repeats current-source checks. */
export class MonthlyOriginalVerifier {
  #db; #store;
  constructor({ database, store }) { this.#db = database; this.#store = store; }
  async #context(input) {
    const context = await this.#db.context(input);
    if (!context || !isUuid(context.actorId) || !instant(context.checkedAt)) fail('MONTHLY_VERIFIER_CONTEXT');
    const proof = readMonthlyProof(context.proof, input.tenantId);
    if (proof.id !== input.proofId || proof.revision !== input.revision || proof.status !== 'open'
      || Date.parse(proof.updated_at) > Date.parse(context.checkedAt)) fail('MONTHLY_VERIFIER_CONTEXT');
    if (context.sessionId !== undefined && !isUuid(context.sessionId)) fail('MONTHLY_VERIFIER_CONTEXT');
    const authority = context.authority === undefined ? undefined : readMonthlyAuthority(context.authority);
    if (authority?.id !== input.authorityId || authority && (authority.tenant_id !== input.tenantId
      || authority.client_id !== proof.payload.clientId || authority.service_type !== proof.payload.serviceType
      || !authorityAvailable(authority, context.checkedAt))) fail('MONTHLY_CAPTURE_CONTEXT_CHANGED');
    return structuredClone({ actorId: context.actorId, checkedAt: context.checkedAt, proof,
      ...(authority ? {authority} : {}),
      ...(context.sessionId !== undefined ? {sessionId: context.sessionId} : {}) });
  }
  #bound(input, context) {
    const stored = this.#store.get(input.tenantId, input.captureId);
    if (!stored || stored.snapshot.actorId !== context.actorId
      || stored.snapshot.sessionId !== context.sessionId
      || canonical(stored.snapshot.authority) !== canonical(context.authority)
      || stored.snapshot.method !== input.method
      || canonical(stored.snapshot.proof) !== canonical(context.proof)) fail('MONTHLY_CAPTURE_CONTEXT_CHANGED');
    const age = Date.parse(context.checkedAt) - Date.parse(stored.snapshot.preparedAt);
    if (!Number.isFinite(age) || age < 0 || age > (stored.snapshot.paper ? 7*86400000 : 30*60*1000)) fail('MONTHLY_CAPTURE_EXPIRED');
    if (stored.acknowledgedAt && (!instant(stored.acknowledgedAt) || Date.parse(stored.acknowledgedAt) < Date.parse(stored.snapshot.preparedAt)
      || Date.parse(stored.acknowledgedAt) > Date.parse(context.checkedAt))) fail('MONTHLY_ORIGINAL_ACKNOWLEDGMENT');
    return stored;
  }
  #original(stored) {
    return { captureId: stored.snapshot.captureId, proofId: stored.snapshot.proof.id,
      revision: stored.snapshot.proof.revision, contentSha256: stored.snapshot.proof.content_sha256,
      originalSha256: stored.originalSha256, originalVersion: stored.originalVersion,
      ...(stored.snapshot.paper ? {paper: stored.snapshot.paper} : {}),
      ...(stored.snapshot.authority ? {representative: stored.snapshot.authority} : {}),
      bytes: Buffer.from(stored.original), acknowledged: !!stored.acknowledgedAt };
  }
  async prepare(value) {
    const input = request(value), context = await this.#context(input);
    let stored = this.#store.get(input.tenantId, input.captureId);
    if (stored) return this.#original(this.#bound(input, context));
    const snapshot = { actorId: context.actorId, proof: context.proof, captureId: input.captureId, preparedAt: context.checkedAt,
      ...(input.method ? {method: input.method} : {}),
      ...(context.authority ? {authority: context.authority} : {}),
      ...(context.sessionId !== undefined ? {sessionId: context.sessionId} : {}) };
    const document = renderMonthlyOriginalDocument(snapshot);
    this.#store.create({...snapshot,...(document.paper?{paper:document.paper}:{})}, document.bytes);
    // Read back encrypted bytes and recheck current identity/delegation/sources
    // after rendering, including a changed revision during the operation.
    stored = this.#bound(input, await this.#context(input));
    return this.#original(stored);
  }
  async readOriginal(value) {
    const input = request(value);
    return this.#original(this.#bound(input, await this.#context(input)));
  }
  async status(value) {
    const input = request(value), context = await this.#context(input);
    if (!this.#store.get(input.tenantId, input.captureId)) return {state: 'absent', original: null, receipt: null};
    const stored = this.#bound(input, context), {bytes, ...original} = this.#original(stored);
    const receipt = stored.receipt?.verified_at ? await this.#db.receiptStatus(structuredClone(stored.receipt)) : null;
    if (receipt !== null && canonical(receipt) !== canonical(this.#receipt(input, context, stored))) fail('MONTHLY_VERIFIER_RECEIPT');
    return {state: receipt ? 'verified' : stored.acknowledgedAt ? 'acknowledged' : 'prepared', original, receipt,
      ...(stored.snapshot.paper?{scan: this.#store.getScan(input.tenantId,input.captureId)?.meta ?? null}:{})};
  }
  #receipt(input, context, stored) {
    return { receiptId: stored.receipt.id, captureId: input.captureId, proofId: input.proofId,
      revision: input.revision, tenantId: input.tenantId, actorId: context.actorId, contentSha256: stored.receipt.content_sha256,
      originalSha256: stored.receipt.original_sha256, signatureSha256: stored.receipt.signature_sha256, ...(stored.receipt.paper?{paper:stored.receipt.paper}:{}) };
  }
  async readArchivedOriginal(value) {
    if (!value || Object.keys(value).some(k => !['tenantId','proofId','captureId'].includes(k))
      || ![value.tenantId, value.proofId, value.captureId].every(isUuid)) fail('MONTHLY_VERIFIER_REQUEST');
    const input = structuredClone(value), context = await this.#db.readContext(input);
    if (!context || !isUuid(context.actorId) || !instant(context.checkedAt)) fail('MONTHLY_VERIFIER_CONTEXT');
    const proof = readMonthlyProof(context.proof, input.tenantId), confirmation = proof.confirmation;
    if (proof.id !== input.proofId || !['final','invalidated'].includes(proof.status)
      || confirmation?.kind !== 'signature' || confirmation.captureId !== input.captureId) fail('MONTHLY_ARCHIVE_BINDING');
    const stored = this.#store.get(input.tenantId, input.captureId), receipt = stored?.receipt;
    if (!receipt || receipt.id !== confirmation.receiptId || receipt.proof_id !== proof.id
      || receipt.proof_revision >= proof.revision || receipt.content_sha256 !== proof.content_sha256
      || stored.snapshot.proof.series_id !== proof.series_id || stored.snapshot.proof.version !== proof.version
      || canonical(stored.snapshot.proof.payload) !== canonical(proof.payload)
      || receipt.original_path !== confirmation.originalPath || stored.originalSha256 !== confirmation.originalSha256
      || stored.originalVersion !== confirmation.originalVersion || receipt.signature_path !== confirmation.signaturePath
      || receipt.signature_sha256 !== confirmation.signatureSha256 || receipt.signature_version !== confirmation.signatureVersion
      || receipt.signer_role !== confirmation.signerRole || receipt.signer_name !== confirmation.signerName
      || canonical(receipt.paper) !== canonical(confirmation.paper)
      || receipt.authority_reference !== confirmation.authorityReference
      || (receipt.signer_role === 'representative' ? stored.snapshot.authority?.id !== receipt.authority_reference
        || stored.snapshot.authority?.signer_name !== receipt.signer_name : stored.snapshot.authority !== undefined)
      || Date.parse(receipt.captured_at) !== Date.parse(confirmation.capturedAt)
      || Date.parse(receipt.verified_at) !== Date.parse(confirmation.verifiedAt)) fail('MONTHLY_ARCHIVE_BINDING');
    // Return the displayed original and its current archive status, never a
    // reusable signature image. Reading an invalidated predecessor cannot revive it.
    return { ...this.#original(stored), revision: proof.revision, version: proof.version,
      status: proof.status, finalizedAt: proof.finalized_at, invalidatedAt: proof.invalidated_at };
  }
  async acknowledge(value, originalSha256) {
    const input = request(value), context = await this.#context(input), stored = this.#bound(input, context);
    if (stored.signature || stored.originalSha256 !== originalSha256) fail('MONTHLY_ORIGINAL_ACKNOWLEDGMENT');
    this.#store.acknowledge(input.tenantId, input.captureId, originalSha256, context.checkedAt);
    return { captureId: input.captureId, acknowledged: true };
  }
  async uploadScan(value,pdfInput){
    if(!(pdfInput instanceof Uint8Array)||!pdfInput.length||pdfInput.length>2097152)fail('MONTHLY_PAPER_INPUT');
    const input=request(value),bytes=Buffer.from(pdfInput),context=await this.#context(input),original=this.#bound(input,context);
    if(!original.snapshot.paper || !original.acknowledgedAt)fail('MONTHLY_PAPER_INPUT');
    const prior=this.#store.getScan(input.tenantId,input.captureId);
    if(prior){if(!prior.bytes.equals(bytes))fail('MONTHLY_CAPTURE_CONFLICT');return prior.meta;}
    const inspected=await inspectMonthlyScan(bytes,original.snapshot.paper.pageCount);
    this.#bound(input,await this.#context(input));
    return this.#store.reserveScan(input.tenantId,input.captureId,inspected);
  }
  async readScanPage(value,page,scanSha256){
    const input=request(value);this.#bound(input,await this.#context(input));
    const scan=this.#store.getScan(input.tenantId,input.captureId);
    if(!scan || scan.meta.scanSha256!==scanSha256 || !Number.isInteger(page) || page<1 || page>scan.meta.pages.length)fail('MONTHLY_PAPER_INPUT');
    return this.#store.getScanPage(input.tenantId,input.captureId,page);
  }
  async readArchivedScan(value){
    const original=await this.readArchivedOriginal(value),stored=this.#store.get(value.tenantId,value.captureId);
    const scan=this.#store.getScan(value.tenantId,value.captureId),paper=stored?.receipt?.paper;
    if(!paper||!scan||scan.meta.scanSha256!==paper.scanSha256||scan.meta.scanVersion!==paper.scanVersion
      ||scan.meta.renderSha256!==paper.renderSha256||canonical(scan.meta.pages.map(p=>p.sha256))!==canonical(paper.pageSha256))fail('MONTHLY_ARCHIVE_BINDING');
    return {bytes:scan.bytes,paper,status:original.status,revision:original.revision};
  }
  async verifyPaper(value,reviewInput){
    const input=request(value),review=readPaperReview(reviewInput),context=await this.#context(input),original=this.#bound(input,context);
    const scan=this.#store.getScan(input.tenantId,input.captureId);
    if(!original.snapshot.paper||!original.acknowledgedAt||!scan||scan.meta.scanSha256!==review.scanSha256
      ||review.signatureBox.page!==original.snapshot.paper.signatureBox.page
      ||canonical(scan.meta.pages.map(p=>p.sha256))!==canonical(review.reviewedPages)
      ||Date.parse(review.signedAt)<Date.parse(original.snapshot.preparedAt)||Date.parse(review.signedAt)>Date.parse(context.checkedAt)
      ||context.authority && (Date.parse(review.signedAt)<Date.parse(context.authority.reviewed_at)
        ||Date.parse(review.signedAt)<Date.parse(context.authority.valid_from)||Date.parse(review.signedAt)>=Date.parse(context.authority.valid_until)))fail('MONTHLY_PAPER_INPUT');
    const page=this.#store.getScanPage(input.tenantId,input.captureId,review.signatureBox.page);
    const png=await cropMonthlyScan(page,review.signatureBox,scan.meta.pages.length);
    return this.#verify(input,png,{schema:'gkv-paper-review-v1',scanPath:`tenant/${input.tenantId}/gkv/monthly/${input.proofId}/captures/${input.captureId}/scan.pdf`,
      scanVersion:scan.meta.scanVersion,scanSha256:scan.meta.scanSha256,renderSha256:scan.meta.renderSha256,
      pageSha256:scan.meta.pages.map(p=>p.sha256),signatureBox:review.signatureBox,issuedAt:original.snapshot.preparedAt,
      signedAt:review.signedAt,reviewedBy:context.actorId});
  }
  async verify(value, pngInput) {
    if(value?.method)fail('MONTHLY_PAPER_INPUT');
    return this.#verify(value,pngInput);
  }
  async #verify(value, pngInput, paper) {
    const input = request(value);
    // Copy before the first await; caller buffer changes cannot alter this request.
    if (!(pngInput instanceof Uint8Array) || pngInput.length > 2 * 1024 * 1024) fail('MONTHLY_SIGNATURE_PNG');
    const png = Buffer.from(pngInput), context = await this.#context(input), prior = this.#bound(input, context);
    if (!prior.acknowledgedAt) fail('MONTHLY_ORIGINAL_ACKNOWLEDGMENT');
    const inspected = inspectMonthlySignature(png);
    const prefix = `tenant/${input.tenantId}/gkv/monthly/${input.proofId}/captures/${input.captureId}`;
    let stored = this.#store.reserveSignature(input.tenantId, input.captureId, inspected, (original, signatureVersion) => ({
      id: randomUUID(), tenant_id: input.tenantId, proof_id: input.proofId, proof_revision: input.revision,
      content_sha256: context.proof.content_sha256, capture_id: input.captureId, actor_id: context.actorId,
      signer_role: context.authority ? 'representative' : 'patient', signer_name: context.authority?.signer_name ?? context.proof.payload.clientName,
      authority_reference: context.authority?.id ?? null,
      original_path: `${prefix}/original.pdf`, original_version: original.originalVersion, original_sha256: original.originalSha256,
      signature_path: `${prefix}/signature.png`, signature_version: signatureVersion, signature_sha256: inspected.sha256,
      signature_ink_sha256: inspected.inkSha256, captured_at: context.checkedAt, verified_at: null,
      ...(paper?{paper:{...paper,reviewedAt:null}}:{}),
    }));
    // Verify the saved signature again. The receipt is built from read-back
    // originals, never from browser metadata or a reported upload success.
    if(canonical(stored.receipt.paper && {...stored.receipt.paper,reviewedAt:null})!==canonical(paper && {...paper,reviewedAt:null}))fail('MONTHLY_CAPTURE_CONFLICT');
    const checked = inspectMonthlySignature(stored.signature);
    if (checked.sha256 !== stored.receipt.signature_sha256 || checked.inkSha256 !== stored.receipt.signature_ink_sha256) fail('MONTHLY_STORE_INTEGRITY');
    const verified = await this.#context(input);
    this.#bound(input, verified);
    stored = this.#store.sealVerification(input.tenantId, input.captureId, verified.checkedAt);
    const result = await this.#db.issue(structuredClone(stored.receipt));
    const expected = this.#receipt(input, context, stored);
    if (canonical(result) !== canonical(expected)) fail('MONTHLY_VERIFIER_RECEIPT');
    return expected;
  }
}
