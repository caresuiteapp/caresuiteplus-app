import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.0';
import type {ArchivePreparation,ArchiveGateway} from './core.ts';
import {callerFromValidatedToken,workerProofPacket} from './workerProof.ts';
import {createArchiveHandler,ArchiveHttpError,bounded} from './handler.ts';
serve(createArchiveHandler(async (authorization):Promise<ArchiveGateway>=>{
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!secret)throw new ArchiveHttpError(503,'Archivdienst ist nicht eingerichtet.');
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 const user=createClient(url,anon,{...options,global:{headers:{Authorization:authorization}}});
 const identity=await bounded(user.auth.getUser());
 if(identity.error||!identity.data.user)throw new ArchiveHttpError(401,'Anmeldung nicht mehr gültig.');
 const caller=callerFromValidatedToken(authorization,identity.data.user.id);
 // Caller JWT controls original reads and fresh authorization. Admin only archives bytes
 // and calls the quarantined worker receipt RPC; no direct archive metadata inserts.
 const admin=createClient(url,secret,options);
 const prepare=async(sourceId:string)=>{
  const r=await bounded(user.rpc('prepare_ambulatory_medication_source_proof',{source_id:sourceId}));
  if(r.error||!r.data)throw Error('Quelle nicht zugänglich, geändert oder ohne Inhaltsfingerabdruck.');
  return r.data as ArchivePreparation;
 };
 const download=async(client:typeof user,bucket:string,path:string)=>{const r=await bounded(client.storage.from(bucket).download(path));if(r.error||!r.data)throw Error('Datei konnte nicht zur Archivprüfung geladen werden.');return r.data;};
 return {
  prepare,downloadOriginal:path=>download(user,'office-documents',path),
  storeArchive:async(path,blob)=>{const r=await bounded(admin.storage.from('medication-source-archives').upload(path,blob,{upsert:false,contentType:'application/octet-stream'}));if(r.error)throw Error('Archivkopie nicht bestätigt.');},
  downloadArchive:path=>download(admin,'medication-source-archives',path),
  registerArchive:async p=>{
   const finalized=await bounded(admin.rpc('commit_ambulatory_medication_source_proof',{packet:workerProofPacket(p,caller)}));
   if(finalized.error||!finalized.data)throw Error('Archivabschluss nicht bestätigt. Dieselbe Anfrage erneut prüfen.');
   return finalized.data as string;
  },
 };
}));
