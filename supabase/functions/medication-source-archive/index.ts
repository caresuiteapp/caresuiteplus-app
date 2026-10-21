import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.0';
import {archiveMedicationSource,type ArchivePreparation} from './core.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
async function bounded<T>(task:PromiseLike<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([Promise.resolve(task),new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(Error('Archivantwort fehlt. Dieselbe Anfrage erneut prüfen.')),20_000);})]);}finally{if(timer)clearTimeout(timer);}}
serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return response({ok:false,error:'Methode nicht erlaubt.'},405);
 const authorization=req.headers.get('authorization');
 if(!authorization?.match(/^Bearer\s+\S+$/i))return response({ok:false,error:'Anmeldung erforderlich.'},401);
 try{
  const raw=await req.text();if(raw.length>4096)return response({ok:false,error:'Anfrage zu groß.'},413);
  const body=JSON.parse(raw) as Record<string,unknown>;
  if(!body||typeof body.sourceId!=='string'||typeof body.requestId!=='string')return response({ok:false,error:'Quelle und Anfrage fehlen.'},400);
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!secret)return response({ok:false,error:'Archivdienst ist nicht eingerichtet.'},503);
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const user=createClient(url,anon,{...options,global:{headers:{Authorization:authorization}}});
  const identity=await bounded(user.auth.getUser());if(identity.error||!identity.data.user)return response({ok:false,error:'Anmeldung nicht mehr gültig.'},401);
  // Original reads and permission checks always use the caller's JWT. Admin is archive-only.
  const admin=createClient(url,secret,options);
  const prepare=async(sourceId:string)=>{
   const r=await bounded(user.rpc('prepare_ambulatory_medication_source_archive',{source_id:sourceId}));
   if(r.error||!r.data)throw Error('Quelle nicht zugänglich, geändert oder ohne Inhaltsfingerabdruck.');
   return r.data as ArchivePreparation;
  };
  const download=async(client:typeof user,bucket:string,path:string)=>{const r=await bounded(client.storage.from(bucket).download(path));if(r.error||!r.data)throw Error('Datei konnte nicht zur Archivprüfung geladen werden.');return r.data;};
  const result=await archiveMedicationSource(body.sourceId,body.requestId,{
   prepare,downloadOriginal:path=>download(user,'office-documents',path),
   storeArchive:async(path,blob)=>{const r=await bounded(admin.storage.from('medication-source-archives').upload(path,blob,{upsert:false,contentType:'application/octet-stream'}));if(r.error)throw Error('Archivkopie nicht bestätigt.');},
   downloadArchive:path=>download(admin,'medication-source-archives',path),
   registerArchive:async p=>{
    const r=await bounded(admin.from('medication_source_archives').insert({id:p.requestId,tenant_id:p.tenantId,source_id:p.sourceId,client_id:p.clientId,medication_id:p.medicationId,document_id:p.documentId,document_version:p.documentVersion,original_path:p.originalPath,archive_path:p.archivePath,content_sha256:p.sha256,content_size:p.sizeBytes,recorded_by:p.actorId}).select('id').single());
    let archiveId=r.data?.id as string|undefined;
    if(r.error){
     const existing=await bounded(admin.from('medication_source_archives').select('id,tenant_id,client_id,medication_id,document_id,document_version,original_path,archive_path,content_sha256,content_size').eq('source_id',p.sourceId).eq('tenant_id',p.tenantId).maybeSingle());
     const a=existing.data;
     if(existing.error||!a||a.client_id!==p.clientId||a.medication_id!==p.medicationId||a.document_id!==p.documentId||a.original_path!==p.originalPath||a.archive_path!==p.archivePath||a.content_sha256!==p.sha256||a.content_size!==p.sizeBytes)throw Error('Archivregistrierung nicht bestätigt. Dieselbe Anfrage erneut prüfen.');
     archiveId=a.id;
    }
    if(!archiveId)throw Error('Archivregistrierung nicht bestätigt.');
    const finalized=await bounded(user.rpc('finalize_ambulatory_medication_source_archive',{archive_id:archiveId}));
    if(finalized.error||!finalized.data)throw Error('Archivfreigabe nicht bestätigt. Dieselbe Anfrage erneut prüfen.');
    return finalized.data as string;
   },
  });
  return response({ok:true,data:result});
 }catch{
  // Do not leak storage keys, private metadata, database errors, or credentials.
  return response({ok:false,error:'Archivierung nicht bestätigt. Quelle, Dateistand und Berechtigung prüfen; bei unklarer Antwort dieselbe Anfrage erneut prüfen.',uncertain:true},409);
 }
});
