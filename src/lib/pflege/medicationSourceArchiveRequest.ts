type Row = Record<string, unknown>;
type Scope = {tenantId:string;clientId:string;medicationId:string;sourceId:string};
type Result = {ok:true;data:{id:string}} | {ok:false;error:string;uncertain?:boolean};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const object=(v:unknown):Row|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Row:null;
const unknownResult:Result={ok:false,uncertain:true,error:'Die Archivbestätigung fehlt. Bitte dieselbe Anfrage erneut prüfen.'};
// The server response alone is insufficient: read back the ready row under current user rights.
export async function submitMedicationSourceArchive(scope:Scope,requestId:string,gateway:{invoke(sourceId:string,requestId:string):Promise<{data:unknown;error:unknown}>;readConfirmed(id:string):Promise<Row|null>;isCurrent():boolean}):Promise<Result>{
  if(![scope.tenantId,scope.clientId,scope.medicationId,scope.sourceId,requestId].every(uuid))return {ok:false,error:'Ungültige Archivzuordnung oder Anfrage.'};
  if(!gateway.isCurrent())return {ok:false,error:'Die aktive Akte hat sich geändert.'};
  try{
    const response=await gateway.invoke(scope.sourceId,requestId);
    if(!gateway.isCurrent()||response.error)return unknownResult;
    const body=object(response.data),data=object(body?.data);
    if(body?.ok!==true||!uuid(data?.id))return unknownResult;
    const archive=await gateway.readConfirmed(data.id);
    if(!gateway.isCurrent()||!archive||archive.id!==data.id||archive.status!=='ready'||archive.tenant_id!==scope.tenantId||archive.client_id!==scope.clientId||archive.medication_id!==scope.medicationId||archive.source_id!==scope.sourceId||!uuid(archive.finalized_by)||typeof archive.finalized_at!=='string'||!Number.isFinite(Date.parse(archive.finalized_at)))return unknownResult;
    return {ok:true,data:{id:data.id}};
  }catch{return unknownResult;}
}
