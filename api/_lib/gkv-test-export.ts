import { createHash } from 'node:crypto';
import { buildTestInterchange } from '../../src/lib/gkvExchange/edifact';
import { hasDraftShape, validateDraft, type ExchangeDraft } from '../../src/lib/gkvExchange/model';
import { normalizeHash, proofStoragePath, readSourceSnapshot, verifyCaseSources, type InvoiceSnapshot } from '../../src/lib/gkvExchange/sources';

type Row = Record<string,unknown>;
export type Request = {method?:string;headers:Record<string,string|string[]|undefined>;body?:unknown};
export type Response = {status(code:number):Response;setHeader(name:string,value:string):void;json(body:unknown):unknown};
type Dependencies = { fetch:typeof fetch; env:{EXPO_PUBLIC_SUPABASE_URL?:string;EXPO_PUBLIC_SUPABASE_ANON_KEY?:string} };
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const object=(v:unknown):Row=>v && typeof v==='object' && !Array.isArray(v)?v as Row:{};
class SourceConflict extends Error {}
async function jsonLimited(response:globalThis.Response,max=3_000_000):Promise<unknown> {
  if(!response.body) throw new Error('Daten nicht verfügbar.');
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let length=0;
  try { while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>max){await reader.cancel();throw new Error('Datenumfang zu groß.');}chunks.push(r.value);} }
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
/** Read-only. Produces unencrypted TEST data; never calls a mail/transport provider. */
export function createGkvTestExportHandler(deps:Dependencies) {
  return async (req:Request,res:Response) => {
    const deadline=Date.now()+40000;
    const timeout=()=>{const remaining=deadline-Date.now();if(remaining<1)throw new Error('Zeitlimit.');return AbortSignal.timeout(Math.min(20000,remaining));};
    res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'POST erforderlich.'});}
    try {
      const auth=req.headers.authorization;
      if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9._~-]+$/.test(auth)||auth.length>8192)return res.status(401).json({ok:false,error:'Bitte erneut anmelden.'});
      if(typeof req.body==='string'&&Buffer.byteLength(req.body)>4096)return res.status(413).json({ok:false,error:'Anfrage zu groß.'});
      let parsed:unknown;
      try { parsed=typeof req.body==='string'?JSON.parse(req.body):req.body; } catch { return res.status(400).json({ok:false,error:'Ungültige JSON-Anfrage.'}); }
      const input=object(parsed);
      if(Buffer.byteLength(JSON.stringify(input))>4096)return res.status(413).json({ok:false,error:'Anfrage zu groß.'});
      if(Object.keys(input).some(k=>!['tenantId','batchId','revision'].includes(k))||!UUID.test(String(input.tenantId))||!UUID.test(String(input.batchId))||!Number.isInteger(input.revision)||Number(input.revision)<1)return res.status(400).json({ok:false,error:'Gespeicherte Abrechnung und Versionsstand erforderlich.'});
      const url=new URL(deps.env.EXPO_PUBLIC_SUPABASE_URL||'');const key=deps.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!key)throw new Error('Dienst nicht eingerichtet.');
      const read=async(path:string)=>{const response=await deps.fetch(`${url.origin}${path}`,{headers:{Authorization:auth,apikey:key},redirect:'error',signal:timeout()});if(!response.ok)throw new Error('Gespeicherte Daten nicht verfügbar.');return jsonLimited(response);};
      const user=object(await read('/auth/v1/user'));if(!UUID.test(String(user.id)))return res.status(401).json({ok:false,error:'Anmeldung ungültig.'});
      const access=await deps.fetch(`${url.origin}/rest/v1/rpc/gkv_exchange_export_allowed`,{method:'POST',headers:{Authorization:auth,apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_tenant_id:input.tenantId}),redirect:'error',signal:timeout()});
      if(!access.ok || await jsonLimited(access,1000)!==true)return res.status(403).json({ok:false,error:'Für die Dateierstellung fehlen die Abrechnungsrechte.'});
      const query=`tenant_id=eq.${input.tenantId}&id=eq.${input.batchId}&select=id,tenant_id,revision,status,draft`;
      const load=async()=>{const rows=await read(`/rest/v1/gkv_exchange_batches?${query}`);if(!Array.isArray(rows)||rows.length!==1)throw new Error('Abrechnung nicht verfügbar.');return object(rows[0]);};
      const row=await load();
      if(row.tenant_id!==input.tenantId||row.id!==input.batchId||row.revision!==input.revision||!['draft','exported_test','checked'].includes(String(row.status)))return res.status(409).json({ok:false,error:'Abrechnungsstand wurde geändert. Bitte neu laden.'});
      const draft=row.draft as ExchangeDraft;
      if(!hasDraftShape(draft))return res.status(422).json({ok:false,error:'Abrechnung enthält unvollständige oder ungültige Datenstrukturen.'});
      const issues=validateDraft(draft);if(issues.some(i=>i.severity==='error'))return res.status(422).json({ok:false,error:'Bitte die markierten Angaben korrigieren.',issues});
      if(draft.mode==='production'||draft.channel!=='classic')return res.status(422).json({ok:false,error:'Dieser Dienst erstellt ausschließlich Prüfdateien für das klassische Verfahren.'});
      const sources=draft.cases.filter(c=>c.sourceInvoiceId);
      if(sources.some(c=>!UUID.test(c.sourceInvoiceId!)))return res.status(422).json({ok:false,error:'Rechnungsreferenz ist ungültig.'});
      if(draft.cases.some(c=>!c.sourceInvoiceId && (c.lines.some(l=>l.sourceId||l.sourceItemId)||c.proofIds?.length||c.sourceProofs?.length)))return res.status(422).json({ok:false,error:'Verknüpfte Leistungen und Nachweise benötigen ihre Quellrechnung.'});
      const ids=[...new Set(sources.map(c=>c.sourceInvoiceId!))].sort();
      if(ids.length!==sources.length)return res.status(422).json({ok:false,error:'Quellrechnung wurde mehrfach ausgewählt.'});
      const snapshots=async()=>{
        const all:InvoiceSnapshot[]=[];
        for(let offset=0;offset<ids.length;offset+=50){
          const selected=ids.slice(offset,offset+50);
          const response=await deps.fetch(`${url.origin}/rest/v1/rpc/gkv_invoice_source_snapshot`,{method:'POST',headers:{Authorization:auth,apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_tenant_id:input.tenantId,p_invoice_ids:selected}),redirect:'error',signal:timeout()});
          if(!response.ok){const failure=object(await jsonLimited(response,10000));if(['40001','P0001'].includes(String(failure.code)))throw new SourceConflict();throw new Error('Quellprüfung nicht verfügbar.');}
          try { all.push(...readSourceSnapshot(await jsonLimited(response),String(input.tenantId),selected)); } catch { throw new SourceConflict(); }
        }
        return all;
      };
      const canonical=await snapshots();
      for(const source of canonical){
        const index=draft.cases.findIndex(c=>c.sourceInvoiceId===source.id);
        const sourceIssues=verifyCaseSources(draft.cases[index],source).map(issue=>({...issue,path:`cases.${index}.${issue.path}`}));
        if(sourceIssues.length)return res.status(409).json({ok:false,error:sourceIssues[0].message,issues:sourceIssues});
      }
      let pdfBytes=0;const checkedPdfs=new Map<string,string>();
      for(const source of canonical)for(const proof of source.proofs){
        let path:string;try{path=proofStoragePath(proof,String(input.tenantId));}catch{throw new SourceConflict();}
        const expected=normalizeHash(proof.sha256);
        if(checkedPdfs.has(path)){if(checkedPdfs.get(path)!==expected)throw new SourceConflict();continue;}
        const response=await deps.fetch(`${url.origin}/storage/v1/object/authenticated/office-documents/${path.split('/').map(encodeURIComponent).join('/')}`,{headers:{Authorization:auth,apikey:key},redirect:'error',signal:timeout()});
        if(!response.ok||!response.body)throw new SourceConflict();
        const reader=response.body.getReader(),digest=createHash('sha256');let size=0;let prefix=Buffer.alloc(0);
        try {while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;pdfBytes+=next.value.length;
          if(size>20*1024*1024||pdfBytes>50*1024*1024){await reader.cancel();throw new SourceConflict();}
          digest.update(next.value);if(prefix.length<1024)prefix=Buffer.concat([prefix,Buffer.from(next.value)]).subarray(0,1024);
        }}finally{reader.releaseLock();}
        if(!size||!prefix.toString('latin1').includes('%PDF-')||digest.digest('hex')!==expected)throw new SourceConflict();
        checkedPdfs.set(path,expected);
      }
      const file=buildTestInterchange(draft);const sha256=createHash('sha256').update(file.bytes).digest('hex');
      if(JSON.stringify(await snapshots())!==JSON.stringify(canonical))throw new SourceConflict();
      const current=await load();if(current.revision!==row.revision||current.status!==row.status||current.tenant_id!==row.tenant_id||current.id!==row.id)return res.status(409).json({ok:false,error:'Abrechnung wurde während der Prüfung geändert.'});
      if(file.bytes.length>2_000_000)return res.status(413).json({ok:false,error:'Prüfdatei zu groß. Bitte Paket aufteilen.'});
      return res.status(200).json({ok:true,kind:'unencrypted_test',specVersion:'6.4.0',revision:row.revision,name:file.name,
        sha256,dataBase64:Buffer.from(file.bytes).toString('base64'),orderBase64:Buffer.from(file.order).toString('base64'),issues,
        sourceReport:{checkedInvoices:canonical.length,checkedItems:canonical.reduce((n,s)=>n+s.items.length,0),checkedServiceRecords:canonical.reduce((n,s)=>n+s.records.length,0),checkedPdfFiles:checkedPdfs.size,manualCases:draft.cases.length-canonical.length,sourceSha256:createHash('sha256').update(JSON.stringify(canonical)).digest('hex')},
        note:'Interne Prüfdatei. Nicht verschlüsselt, nicht übermittelt, keine Annahmestellen- oder Softwarezertifizierung.'});
    }catch(error){if(error instanceof SourceConflict)return res.status(409).json({ok:false,error:'Rechnungspositionen, Leistungsbestätigung oder Original-PDF fehlen, wurden geändert oder überschreiten das Prüflimit (20 MB je PDF / 50 MB insgesamt). Bitte Rechnung und Nachweise prüfen und erneut übernehmen.'});return res.status(503).json({ok:false,error:'Die Prüfdatei konnte nicht erstellt werden. Bitte Verbindung und Datenbankfreigabe prüfen.'});}
  };
}
