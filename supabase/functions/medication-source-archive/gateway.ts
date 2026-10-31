import type {ArchiveGateway,ArchivePreparation} from './core.ts';
import {callerFromValidatedToken,workerProofPacket} from './workerProof.ts';
import {ArchiveHttpError,bounded} from './handler.ts';

type BackendResult<T>={data:T|null;error:unknown};
export type ArchiveBackendClient={
 auth:{getUser():PromiseLike<{data:{user:{id:string;is_anonymous?:boolean}|null};error:unknown}>};
 rpc(name:string,args:Record<string,unknown>):PromiseLike<BackendResult<unknown>>;
 storage:{from(bucket:string):{
  download(path:string):PromiseLike<BackendResult<Blob>>;
  upload(path:string,blob:Blob,options:{upsert:false;contentType:string}):PromiseLike<{error:unknown}>;
 }};
};
export type ArchiveClientFactory=(url:string,key:string,options:{auth:{persistSession:false;autoRefreshToken:false};global?:{headers:{Authorization:string}}})=>ArchiveBackendClient;
export type ArchiveEnvironment={url:string|undefined;anonKey:string|undefined;serviceKey:string|undefined};

// This is the production adapter used by index.ts. Keeping transport creation injectable
// lets the real Auth/RPC/Storage boundary run in the existing Node checks without an SDK install.
export async function createMedicationArchiveGateway(environment:ArchiveEnvironment,authorization:string,createClient:ArchiveClientFactory):Promise<ArchiveGateway>{
 const {url,anonKey,serviceKey}=environment;
 if(!url||!anonKey||!serviceKey)throw new ArchiveHttpError(503,'Archivdienst ist nicht eingerichtet.');
 const options={auth:{persistSession:false as const,autoRefreshToken:false as const}};
 const user=createClient(url,anonKey,{...options,global:{headers:{Authorization:authorization}}});
 const identity=await bounded(user.auth.getUser());
 if(identity.error||!identity.data?.user||identity.data.user.is_anonymous===true)throw new ArchiveHttpError(401,'Anmeldung nicht mehr gültig.');
 const caller=callerFromValidatedToken(authorization,identity.data.user.id);
 // Admin is constructed only after this exact caller token has been verified.
 const admin=createClient(url,serviceKey,options);
 const download=async(client:ArchiveBackendClient,bucket:string,path:string)=>{
  const r=await bounded(client.storage.from(bucket).download(path));
  if(r.error||!(r.data instanceof Blob))throw Error('Datei konnte nicht zur Archivprüfung geladen werden.');
  return r.data;
 };
 return {
  recover:async(sourceId,requestId)=>{
   const r=await bounded(user.rpc('recover_ambulatory_medication_source_proof',{source_id:sourceId,request_id:requestId}));
   if(r.error)throw Error('Gespeicherter Prüfauftrag nicht zugänglich oder widersprüchlich.');
   if(r.data===null)return null;
   if(!r.data||typeof r.data!=='object'||Array.isArray(r.data))throw Error('Gespeicherter Prüfauftrag nicht bestätigt.');
   return r.data as ArchivePreparation;
  },
  prepare:async sourceId=>{
   const r=await bounded(user.rpc('prepare_ambulatory_medication_source_proof',{source_id:sourceId}));
   if(r.error||!r.data)throw Error('Quelle nicht zugänglich, geändert oder ohne Inhaltsfingerabdruck.');
   return r.data as ArchivePreparation;
  },
  downloadOriginal:path=>download(user,'office-documents',path),
  storeArchive:async(path,blob)=>{
   const r=await bounded(admin.storage.from('medication-source-archives').upload(path,blob,{upsert:false,contentType:'application/octet-stream'}));
   if(r.error)throw Error('Archivkopie nicht bestätigt.');
  },
  downloadArchive:path=>download(admin,'medication-source-archives',path),
  registerArchive:async p=>{
   const r=await bounded(admin.rpc('commit_ambulatory_medication_source_proof',{packet:workerProofPacket(p,caller)}));
   if(r.error||!r.data)throw Error('Archivabschluss nicht bestätigt. Dieselbe Anfrage erneut prüfen.');
   return r.data as string;
  },
 };
}
