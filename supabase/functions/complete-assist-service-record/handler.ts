import { canonicalJson, hashBytes, requireSignaturePath, verifyOriginalSignature } from './proofBytes.ts';
import type { ProofSource } from './visitProofPdf.ts';
type Result = { data: unknown; error: unknown };
type Client = {
 auth: { getUser(): PromiseLike<{data: {user: {id:string}|null};error:unknown}> };
 rpc(name:string,args:Record<string,unknown>): PromiseLike<Result>;
 storage: {from(bucket:string): {download(path:string):PromiseLike<{data:Blob|null;error:unknown}>;
   upload(path:string,bytes:Uint8Array,options:{contentType:string;upsert:boolean}):PromiseLike<{error:unknown}>}};
};
type Dependencies = {userClient(auth:string):Client;serviceClient():Client;render(source:ProofSource,signature:Uint8Array):Promise<Uint8Array>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
async function smallJson(req:Request) {
 const reader=req.body?.getReader();if(!reader)throw new Error('Anfrage fehlt.');
 const chunks:Uint8Array[]=[];let count=0;
 while(true){const next=await reader.read();if(next.done)break;count+=next.value.length;if(count>2048){await reader.cancel();throw new Error('Anfrage zu groß.');}chunks.push(next.value);}
 const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export function createProofCompletionHandler(deps:Dependencies) {
 return async(req:Request):Promise<Response>=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  if(req.method!=='POST')return reply({ok:false,error:'Methode nicht erlaubt.'},405);
  const auth=req.headers.get('Authorization')??'';
  if(!/^Bearer\s+\S+$/i.test(auth))return reply({ok:false,error:'Bitte erneut anmelden.'},401);
  let tenant:string,assignment:string;
  try{const body=await smallJson(req);tenant=body.tenantId;assignment=body.assignmentId;if(typeof tenant!=='string'||typeof assignment!=='string'||!uuid.test(tenant)||!uuid.test(assignment))throw new Error();}
  catch{return reply({ok:false,error:'Eine gültige Mandanten- und Einsatz-ID ist erforderlich.'},400);}
  const user=deps.userClient(auth);
  const verified=await user.auth.getUser();if(verified.error||!verified.data.user)return reply({ok:false,error:'Bitte erneut anmelden.'},401);
  const read=await user.rpc('workflow_assignment_proof_source',{p_tenant_id:tenant,p_assignment_id:assignment});
  if(read.error)return reply({ok:false,error:'Die aktuelle signierte Einsatzfassung ist nicht freigegeben oder nicht vollständig. Bitte Einsatzzuordnung, Dokumentation und Unterschrift prüfen.'},409);
  try {
   const source=read.data as ProofSource;const r=source?.receipt;
   if(!r||r.version!=='workflow-assignment-record-v1'||r.tenant_id!==tenant||r.assignment_id!==assignment
     ||!uuid.test(String(r.visit_id))||!uuid.test(String(r.proof_id))||source.signature_id!==r.signature_id
     ||typeof source.signature_hash!=='string'||JSON.stringify(source.snapshot).length>256000)throw new Error('Quellfassung ungültig.');
   if(await hashBytes(new TextEncoder().encode(canonicalJson(source.snapshot)))!==r.proof_payload_hash)throw new Error('Quellhash stimmt nicht überein.');
   const signaturePath=requireSignaturePath(source.signature_storage_path,tenant,String(r.visit_id));
   const service=deps.serviceClient();const storage=service.storage.from('office-documents');
   const original=await storage.download(signaturePath);if(original.error||!original.data||original.data.size>2*1024*1024)throw new Error('Originalsignatur nicht verfügbar.');
   const signature=new Uint8Array(await original.data.arrayBuffer());await verifyOriginalSignature(signature,source.signature_hash);
   let pdfPath:string,pdfHash:string;
   if(source.attested_pdf){
    pdfHash=String(source.pdf_hash);pdfPath=String(source.pdf_storage_path);
    if(!/^sha256:[0-9a-f]{64}$/.test(pdfHash)||pdfPath!==`tenant/${tenant}/assist/visits/${r.visit_id}/server-proofs/${r.proof_id}-${pdfHash.slice(7)}.pdf`)throw new Error('Bestätigter PDF-Pfad ungültig.');
   }else{
    const pdf=await deps.render(source,signature);if(pdf.length>10*1024*1024||pdf.length<100)throw new Error('PDF konnte nicht erzeugt werden.');
    pdfHash=await hashBytes(pdf);pdfPath=`tenant/${tenant}/assist/visits/${r.visit_id}/server-proofs/${r.proof_id}-${pdfHash.slice(7)}.pdf`;
    // On a lost upload reply, the read below proves the actual stored bytes.
    await storage.upload(pdfPath,pdf,{contentType:'application/pdf',upsert:false});
   }
   const stored=await storage.download(pdfPath);if(stored.error||!stored.data||stored.data.size>10*1024*1024)throw new Error('PDF-Speicherung nicht bestätigt.');
   const storedBytes=new Uint8Array(await stored.data.arrayBuffer());
   if(new TextDecoder().decode(storedBytes.slice(0,5))!=='%PDF-'||await hashBytes(storedBytes)!==pdfHash)throw new Error('Gespeicherte PDF-Bytes stimmen nicht überein.');
   const committed=await service.rpc('workflow_commit_proof_attestation',{t:tenant,a_id:assignment,p_id:r.proof_id,
    expected_payload_hash:r.proof_payload_hash,expected_signature_hash:source.signature_hash,pdf_path:pdfPath,pdf_sha:pdfHash});
   const receipt=committed.data as Record<string,unknown>|null;
   if(committed.error||!receipt?.confirmed||receipt.proof_id!==r.proof_id||receipt.pdf_storage_path!==pdfPath||receipt.pdf_sha256!==pdfHash)throw new Error('Die Nachweisfassung wurde inzwischen geändert oder nicht bestätigt.');
   return reply({ok:true,data:{proofId:r.proof_id,pdfPath,pdfSha256:pdfHash}});
  }catch(cause){
   const message=cause instanceof Error?cause.message:'Nachweisabschluss nicht bestätigt.';
   return reply({ok:false,error:message},409);
  }
 };
}
