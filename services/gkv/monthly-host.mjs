import https from 'node:https';
import {createHash} from 'node:crypto';
import {MonthlyOriginalStore} from './monthly-original-store.mjs';
import {MonthlyOriginalVerifier} from './monthly-original-verifier.mjs';
import {monthlyRestDatabase} from './monthly-rest-database.mjs';
import {authenticateMonthly,monthlySupabaseConfig} from './monthly-auth.mjs';
import {isUuid} from './storage.mjs';
import {readMonthlyOriginalCommand,readMonthlyOriginalResponse,monthlyBase64,MONTHLY_FILE_LIMIT,MONTHLY_WIRE_LIMIT} from '../../src/lib/gkvExchange/monthlyOriginalContract.ts';

export const monthlyError = error => {
  const code = error?.message;
  if (['MONTHLY_AUTH','MONTHLY_FORBIDDEN','MONTHLY_STALE','MONTHLY_UNCONFIGURED','MONTHLY_BUSY','MONTHLY_FILE_SIZE','MONTHLY_PAPER_PROFILE','MONTHLY_COMPONENT_HELD','MONTHLY_COMPONENT_PIN_REQUIRED','MONTHLY_SIGNATURE_NOT_STORED'].includes(code)) return code;
  if(code==='MONTHLY_COMPONENT_BUSY')return 'MONTHLY_BUSY';
  if (code === 'MONTHLY_SIGNATURE_PNG' || code === 'MONTHLY_ORIGINAL_CONTRACT' || code === 'MONTHLY_PAPER_INPUT') return 'MONTHLY_INPUT';
  if (code === 'MONTHLY_SIGNATURE_REUSED') return code;
  if (code === 'MONTHLY_STORE_QUOTA') return 'MONTHLY_QUOTA';
  if (/^MONTHLY_(CAPTURE_|ORIGINAL_ACKNOWLEDGMENT|ARCHIVE_BINDING)/.test(code || '')) return 'MONTHLY_STALE';
  return 'MONTHLY_UNAVAILABLE';
};
export const monthlyHttpStatus = code => code === 'MONTHLY_AUTH' ? 401 : code === 'MONTHLY_FORBIDDEN' ? 403
  : ['MONTHLY_INPUT','MONTHLY_PAPER_PROFILE'].includes(code) ? 400 : code === 'MONTHLY_FILE_SIZE' ? 413
  : ['MONTHLY_STALE','MONTHLY_SIGNATURE_REUSED','MONTHLY_QUOTA','MONTHLY_BUSY','MONTHLY_COMPONENT_HELD','MONTHLY_COMPONENT_PIN_REQUIRED','MONTHLY_SIGNATURE_NOT_STORED'].includes(code) ? 409 : 503;

export class MonthlyOriginalHost {
  #tenant; #store; #config; #keyId; #key; #http; #components; #busy = false; #closed = false;
  constructor({tenantId,store,supabase,workerKeyId,workerKey,componentSigner,http = fetch}) {
    if (!isUuid(tenantId) || !(store instanceof MonthlyOriginalStore) || !isUuid(workerKeyId)
      || !(workerKey instanceof Uint8Array) || workerKey.length !== 32) throw Error('MONTHLY_CONFIGURATION');
    this.#config = monthlySupabaseConfig(supabase); this.#tenant = tenantId; this.#store = store;
    this.#keyId = workerKeyId; this.#key = Buffer.from(workerKey); this.#http = http;
    this.#components=componentSigner;
  }
  async execute(value, authorization) {
    const input = readMonthlyOriginalCommand(value);
    if (this.#closed || input.tenantId !== this.#tenant) throw Error('MONTHLY_FORBIDDEN');
    const principal = await authenticateMonthly(this.#config, authorization, this.#http);
    if (this.#closed) throw Error('MONTHLY_FORBIDDEN');
    if (this.#busy) throw Error('MONTHLY_BUSY');
    this.#busy = true;
    let database;
    try {
      database = monthlyRestDatabase({config: this.#config,tenantId: this.#tenant,principal,authorization,
        workerKeyId: this.#keyId,workerKey: this.#key,http: this.#http});
      const verifier = new MonthlyOriginalVerifier({database,store: this.#store,componentSigner:this.#components,requireComponents:true});
      const {action,originalSha256,pngBase64,pdfBase64,page,scanSha256,review,...capture} = input;
      const envelope = {version: 1,...capture,actorId: principal.actorId};
      let result;
      if (action === 'prepare' || action === 'read' || action === 'archive') {
        const original = action === 'prepare' ? await verifier.prepare(capture) : action === 'read' ? await verifier.readOriginal(capture)
          : await verifier.readArchivedOriginal({tenantId: capture.tenantId,proofId: capture.proofId,captureId: capture.captureId});
        if (original.bytes.length > MONTHLY_FILE_LIMIT) throw Error('MONTHLY_FILE_SIZE');
        const {bytes,status,version,finalizedAt,invalidatedAt,...metadata} = original;
        result = {...envelope,kind: 'original',original: metadata,pdfBase64: bytes.toString('base64'),
          archive: action === 'archive' ? {status,version,finalizedAt,invalidatedAt} : null};
      } else if (action === 'acknowledge') {
        await verifier.acknowledge(capture,originalSha256); result = {...envelope,kind: 'acknowledged',originalSha256};
      } else if(action==='upload-scan')result={...envelope,kind:'scan',scan:await verifier.uploadScan(capture,monthlyBase64(pdfBase64))};
      else if(action==='scan-page'){const {bytes,...meta}=await verifier.readScanPage(capture,page,scanSha256);result={...envelope,kind:'scan-page',page,scanSha256,...meta,pngBase64:bytes.toString('base64')};}
      else if(action==='review-scan')result={...envelope,kind:'receipt',receipt:await verifier.verifyPaper(capture,review)};
      else if(action==='archive-scan'){
        const {bytes,revision,...meta}=await verifier.readArchivedScan({tenantId:capture.tenantId,proofId:capture.proofId,captureId:capture.captureId});
        if(revision!==capture.revision)throw Error('MONTHLY_STALE');
        result={...envelope,kind:'archived-scan',...meta,pdfBase64:bytes.toString('base64')};
      }
      else if (action === 'verify') result = {...envelope,kind: 'receipt',receipt: await verifier.verify(capture,monthlyBase64(pngBase64))};
      else if (action === 'resume-verification') result = {...envelope,kind:'receipt',receipt:await verifier.resumeVerification(capture)};
      else result = {...envelope,kind: 'state',...await verifier.status(capture)};
      return readMonthlyOriginalResponse(result,input,principal.actorId);
    } finally { database?.close(); this.#busy = false; }
  }
  close() {
    if (this.#busy) throw Error('MONTHLY_BUSY');
    if (!this.#closed) { this.#closed = true; this.#key.fill(0); this.#store.close(); }
  }
}

export function createMonthlyHostServer({host,tls,clientSha256}) {
  if (!(host instanceof MonthlyOriginalHost) || !tls?.key || !tls?.cert || !tls?.ca || !/^[a-f0-9]{64}$/.test(clientSha256 || '')) throw Error('MONTHLY_CONFIGURATION');
  return https.createServer({...tls,requestCert: true,rejectUnauthorized: true,minVersion: 'TLSv1.2',maxHeaderSize: 12288,
    headersTimeout: 10000,requestTimeout: 30000},async (req,res) => {
    res.setHeader('Cache-Control','private, no-store'); res.setHeader('Content-Type','application/json'); res.setHeader('X-Content-Type-Options','nosniff');
    const reply = (status,value) => { if (!res.destroyed) { res.writeHead(status); res.end(JSON.stringify(value)); } };
    try {
      const peer = req.socket.getPeerCertificate();
      if (!req.socket.authorized || !peer.raw || createHash('sha256').update(peer.raw).digest('hex') !== clientSha256) return reply(403,{error:'MONTHLY_FORBIDDEN'});
      if (req.url !== '/v1/monthly-originals' || req.method !== 'POST') return reply(404,{error:'MONTHLY_INPUT'});
      if (req.headers['content-type'] !== 'application/json' || req.headers['content-encoding']) return reply(415,{error:'MONTHLY_INPUT'});
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > MONTHLY_WIRE_LIMIT) return reply(413,{error:'MONTHLY_FILE_SIZE'}); chunks.push(chunk); }
      let input; try { input = readMonthlyOriginalCommand(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { return reply(400,{error:'MONTHLY_INPUT'}); }
      reply(200,await host.execute(input,req.headers.authorization));
    } catch (error) { const code = monthlyError(error); reply(monthlyHttpStatus(code),{error:code}); }
  });
}
