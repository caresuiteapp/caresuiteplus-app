import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { buildCareProofClientConfirmation, type CareProofClientConfirmationInput, type CareProofSignerKind } from './careProofClientConfirmationDomain';

type Row=Record<string,unknown>;const text=(v:unknown)=>v==null?'':String(v);
export type CareProofClientConfirmation=Readonly<{id:string;proofId:string;proofUpdatedAt:string;proofContentHash:string;signerKind:CareProofSignerKind;signerName:string;representationBasis:string;confirmedAt:string}>;
export type CareProofClientConfirmationState=Readonly<{proofUpdatedAt:string;confirmation:CareProofClientConfirmation|null}>;
const guard=<T>(tenant:string):ServiceResult<T>|null=>{const invalid=guardServiceTenant(tenant);if(invalid)return invalid as ServiceResult<T>;if(getServiceMode()!=='supabase'||!getSupabaseClient())return{ok:false,error:'Die Klientenbestätigung ist ausschließlich live verfügbar.'};return null;};
export const newCareProofClientConfirmationRequestId=()=>globalThis.crypto?.randomUUID?.()??'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,(token)=>{const value=Math.floor(Math.random()*16);return(token==='x'?value:(value&3)|8).toString(16);});

export async function fetchCareProofClientConfirmationState(tenant:string,role:RoleKey|null|undefined,proofId:string):Promise<ServiceResult<CareProofClientConfirmationState>>{
 const denied=enforcePermission<CareProofClientConfirmationState>(role,'pflege.proofs.view');if(denied)return denied;const blocked=guard<CareProofClientConfirmationState>(tenant);if(blocked)return blocked;
 const client=getSupabaseClient()!;const [proofResult,confirmationResult]=await Promise.all([
  fromUnknownTable(client,'pfleger_service_proofs').select('id,updated_at').eq('tenant_id',tenant).eq('id',proofId).maybeSingle(),
  fromUnknownTable(client,'pfleger_proof_client_confirmations').select('id,proof_id,proof_updated_at,proof_content_hash,signer_kind,signer_name,representation_basis,confirmed_at').eq('tenant_id',tenant).eq('proof_id',proofId).maybeSingle(),
 ]);
 const error=proofResult.error??confirmationResult.error;if(error)return{ok:false,error:(error as {code?:string}).code==='42P01'?'Die versionsgebundene Klientenbestätigung ist in der Datenbank noch nicht freigeschaltet.':toGermanSupabaseError(error)};
 const proof=proofResult.data as Row|null;if(!proof)return{ok:false,error:'Leistungsnachweis nicht gefunden.'};const row=confirmationResult.data as Row|null;
 return{ok:true,data:{proofUpdatedAt:text(proof.updated_at),confirmation:row?{id:text(row.id),proofId:text(row.proof_id),proofUpdatedAt:text(row.proof_updated_at),proofContentHash:text(row.proof_content_hash),signerKind:text(row.signer_kind) as CareProofSignerKind,signerName:text(row.signer_name),representationBasis:text(row.representation_basis),confirmedAt:text(row.confirmed_at)}:null}};
}

export async function captureCareProofClientConfirmation(tenant:string,role:RoleKey|null|undefined,input:CareProofClientConfirmationInput):Promise<ServiceResult<{id:string}>>{
 const denied=enforcePermission<{id:string}>(role,'pflege.proofs.sign');if(denied)return denied;const blocked=guard<{id:string}>(tenant);if(blocked)return blocked;const built=buildCareProofClientConfirmation(input);if(!built.ok)return{ok:false,error:built.error};
 try{const client=getSupabaseClient()! as unknown as{rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:Row|null;error:{code?:string;message?:string}|null}>};const {data,error}=await client.rpc('capture_pfleger_proof_client_confirmation',{p_proof_id:built.value.proofId,p_expected_proof_updated_at:built.value.expectedProofUpdatedAt,p_signer_kind:built.value.signerKind,p_signer_name:built.value.signerName,p_representation_basis:built.value.representationBasis,p_png_data_url:built.value.pngDataUrl,p_request_id:built.value.requestId});
  if(error||!data){const message=error?.code==='PGRST202'?'Die versionsgebundene Klientenbestätigung ist in der Datenbank noch nicht freigeschaltet.':['P0001','23514','40001'].includes(error?.code??'')?error?.message:toGermanSupabaseError(error);return{ok:false,error:message||'Bestätigung fehlgeschlagen.'};}return data.id?{ok:true,data:{id:text(data.id)}}:{ok:false,error:'Die Bestätigung wurde nicht vollständig quittiert.'};
 }catch{return{ok:false,error:'Verbindung unterbrochen. Dieselbe unveränderte Bestätigungsanfrage kann erneut gesendet werden.'};}
}

