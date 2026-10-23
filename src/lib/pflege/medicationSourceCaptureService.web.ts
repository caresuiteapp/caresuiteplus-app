import type { RoleKey } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { MedicationDocumentation, MedicationWriteResult } from './medicationAdministrationService';
import { isDefiniteMedicationRejection } from './medicationRequestState';
import { validateMedicationSource, type MedicationSourceDocument, type MedicationSourcePayload } from './medicationSourceDomain';
import { submitMedicationSourceCapture } from './medicationSourceCaptureReceipt.web';
import { woundUuid } from './woundCareDomain';

/** Prepared Web-only capture; quarantined RPCs keep this separate from existing native behavior. */
export async function captureMedicationSourceWeb(order:MedicationDocumentation,document:MedicationSourceDocument,tenantId:string,requestId:string,payload:MedicationSourcePayload,role?:RoleKey|null,replay=false,context?:{actorId:string;isCurrent():boolean}):Promise<MedicationWriteResult>{
  for(const permission of ['pflege.medications.manage','pflege.medications.view','office.documents.view','office.clients.view_sensitive'] as const){const denied=enforcePermission<{id:string}>(role,permission);if(denied)return denied;}
  const denied=guardServiceTenant(tenantId);if(denied)return denied;
  if(order.tenantId!==tenantId||!woundUuid(requestId)||!context||!woundUuid(context.actorId))return {ok:false,error:'Ungültige eigene Zuordnung oder Anfrage.'};
  if(!replay){const error=validateMedicationSource(order,document,payload);if(error)return {ok:false,error};}
  const client=getSupabaseClient();if(!client||getServiceMode()!=='supabase')return {ok:false,error:'Die Medikationsdatenbank ist nicht verbunden.'};
  const rpc=client as unknown as {rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:{code?:string}|null;status?:number}>};
  return submitMedicationSourceCapture({order:{id:order.id,tenantId,clientId:order.clientId,updatedAt:payload.expectedUpdatedAt},document,actorId:context.actorId,requestId,payload},{
    isCurrent:()=>context.isCurrent()&&!guardServiceTenant(tenantId),
    write:async()=>{
      const {data,error,status}=await withServiceQueryTimeout(Promise.resolve(rpc.rpc('capture_ambulatory_medication_source',{medication_id:order.id,request_id:requestId,payload})),'Quellenzuordnung',20_000);
      if(error)return {ok:false as const,error:toGermanSupabaseError(error),uncertain:!isDefiniteMedicationRejection(error.code,status)};
      if(!woundUuid(data))return {ok:false as const,error:'Speicherergebnis ungeklärt. Dieselbe Anfrage erneut prüfen.',uncertain:true};
      return {ok:true as const,data:{id:data}};
    },
    readReturned:async id=>{
      const result=await withServiceQueryTimeout(Promise.resolve(rpc.rpc('confirm_ambulatory_medication_source_capture',{source_id:id,request_id:requestId})),'Eigener Quellennachweis',20_000);
      if(result.error||!result.data)throw Error('Der vollständige eigene Quellennachweis fehlt.');
      return result.data;
    },
  });
}
