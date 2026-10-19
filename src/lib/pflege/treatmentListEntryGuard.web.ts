import type {RoleKey} from '@/types';
import {woundUuid} from './woundCareDomain.ts';
import {isKnownWoundEditorRole} from './woundEditorRequestGuard.web.ts';
import {validateTreatmentCorrectionHistory} from './treatmentCorrectionDomain.ts';
import {sameMedicationListOriginal} from './medicationListOriginal.web.ts';

export type TreatmentEntryOwner={tenantId:string;profileId:string;role:RoleKey};
export type TreatmentEntryAccess={owner:TreatmentEntryOwner|null;scope:string;canRead:boolean;canManage:boolean};
export type TreatmentListOriginal={executions:Record<string,unknown>[];corrections:Record<string,unknown>[];clientNames:Map<string,string>};
export function captureTreatmentEntryOwner(tenantId:unknown,profileId:unknown,role:unknown):TreatmentEntryOwner|null{return woundUuid(tenantId)&&woundUuid(profileId)&&isKnownWoundEditorRole(role)?{tenantId,profileId,role}:null;}
export function treatmentEntryAccess(input:{tenantId:unknown;profileTenantId:unknown;profileId:unknown;profileRole:unknown;runtimeTenantId:unknown;runtimeRole:unknown;canRead:unknown;canManage:unknown}):TreatmentEntryAccess{
 const owner=captureTreatmentEntryOwner(input.profileTenantId,input.profileId,input.profileRole);
 const native=!!owner&&input.tenantId===owner.tenantId&&input.runtimeTenantId===owner.tenantId&&input.runtimeRole===owner.role;
 const canRead=native&&input.canRead===true;
 return {owner,scope:JSON.stringify([owner,input.tenantId,input.runtimeTenantId,input.runtimeRole,canRead]),canRead,canManage:canRead&&input.canManage===true};
}
function lossless(value:unknown,ancestors=new Set<object>()):void{
 if(value===null||value===undefined||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
 if(typeof value!=='object'||ancestors.has(value))throw Error('Originalbestand enthält nicht erhaltene Werte.');
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null&&proto!==Array.prototype)throw Error('Originalbestand enthält nicht bestätigte Objekttypen.');
 const descriptors=Object.getOwnPropertyDescriptors(value);ancestors.add(value);
 if(Array.isArray(value)){
  if(Reflect.ownKeys(descriptors).length!==value.length+1)throw Error('Originalbestand enthält unvollständige Listen.');
  for(let i=0;i<value.length;i++){const d=descriptors[String(i)];if(!d||!('value'in d)||!d.enumerable)throw Error('Originalbestand enthält unvollständige Listen.');lossless(d.value,ancestors);}
 }else for(const key of Reflect.ownKeys(descriptors)){const d=descriptors[key as string];if(typeof key!=='string'||!('value'in d)||!d.enumerable)throw Error('Originalbestand enthält nicht bestätigte Felder.');lossless(d.value,ancestors);}
 ancestors.delete(value);
}
/** Entire actually returned service pool, not an exhaustive roster of care cases. */
export function captureTreatmentListOriginal(value:unknown,tenantId:string):TreatmentListOriginal{
 if(!woundUuid(tenantId)||!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error('Behandlungspflegebestand nicht bestätigt.');
 const descriptors=Object.getOwnPropertyDescriptors(value);
 for(const key of Reflect.ownKeys(descriptors))if(typeof key!=='string'||!('value'in descriptors[key])||!descriptors[key].enumerable)throw Error('Behandlungspflegebestand enthält nicht bestätigte Felder.');
 const names=descriptors.clientNames?.value;if(!(names instanceof Map)||Object.getPrototypeOf(names)!==Map.prototype||Reflect.ownKeys(names).length)throw Error('Fallnamenbestand nicht bestätigt.');
 const clients=new Set<string>();for(const [id,name]of names){if(!woundUuid(id)||clients.has(id.toLowerCase())||typeof name!=='string'||!name.trim())throw Error('Fallzuordnungen fremd oder doppelt.');clients.add(id.toLowerCase());}
 for(const key of Object.keys(descriptors))if(key!=='clientNames')lossless(descriptors[key].value);
 const executions=descriptors.executions?.value,corrections=descriptors.corrections?.value;
 if(!Array.isArray(executions)||!Array.isArray(corrections))throw Error('Originale und Berichtigungen nicht vollständig geliefert.');
 for(const rows of [executions,corrections]){const ids=new Set<string>();for(const row of rows){if(!row||typeof row!=='object'||Array.isArray(row)||!woundUuid(row.id)||ids.has(row.id.toLowerCase())||row.tenant_id!==tenantId||!woundUuid(row.client_id)||!names.has(row.client_id))throw Error('Originale oder Berichtigungen fremd, doppelt oder ohne Pflegefall.');ids.add(row.id.toLowerCase());}}
 validateTreatmentCorrectionHistory(corrections,tenantId,executions);
 return structuredClone(value) as TreatmentListOriginal;
}
export function sameTreatmentListOriginal(a:TreatmentListOriginal,b:TreatmentListOriginal):boolean{
 const {clientNames:left,...leftRows}=a,{clientNames:right,...rightRows}=b;
 return sameMedicationListOriginal(leftRows,rightRows)&&sameMedicationListOriginal([...left],[...right]);
}
export type TreatmentEntrySelection={executionId:string;clientId:string;owner:TreatmentEntryOwner;generation:symbol;mountKey:number};
export type TreatmentEntryView={loading?:boolean;refreshing?:boolean;error?:unknown;refreshError?:unknown;previewData?:boolean;tableMissing?:boolean;fromCache?:boolean;partialDetail?:unknown};
export class TreatmentListEntryGuard{
 private alive=true;private access:TreatmentEntryAccess;private lifetime=Symbol();private attempt=0;private selectionSerial=0;
 private receipt:{source:TreatmentListOriginal;original:TreatmentListOriginal;ticket:number}|null=null;
 constructor(access:TreatmentEntryAccess){this.access=access;}
 update(access:TreatmentEntryAccess){if(access.scope!==this.access.scope){this.lifetime=Symbol();this.attempt++;this.receipt=null;}this.access=access;}
 mount(){this.alive=true;}dispose(){this.alive=false;this.lifetime=Symbol();this.attempt++;this.receipt=null;}
 invalidate(){this.attempt++;this.receipt=null;}
 get readTicket(){return this.attempt;}
 token(){return this.lifetime;}canRead(){return this.alive&&this.access.canRead;}
 async read<T extends {ok:boolean;data?:TreatmentListOriginal;error?:string}>(token:symbol,fetcher:()=>Promise<T>):Promise<T>{
  const denied=()=>({ok:false,error:'Behandlungspflege-Lesekontext geändert. Bitte neu laden.'} as T);
  if(!this.canRead()||token!==this.lifetime)return denied();const ticket=++this.attempt;
  const result=await fetcher();if(!this.canRead()||token!==this.lifetime||ticket!==this.attempt)return denied();
  if(result.ok){try{const original=captureTreatmentListOriginal(result.data,this.access.owner!.tenantId);this.receipt={source:result.data!,original,ticket};}catch(error){return {ok:false,error:error instanceof Error?error.message:'Originalbestand nicht bestätigt.'} as T;}}
  return result;
 }
 current(source:TreatmentListOriginal|null,view:TreatmentEntryView):TreatmentListOriginal|null{
  if(!this.canRead()||!source||!this.receipt||source!==this.receipt.source||this.receipt.ticket!==this.attempt||view.loading||view.refreshing||view.error||view.refreshError||view.previewData||view.tableMissing||view.fromCache||view.partialDetail)return null;
  try{const current=captureTreatmentListOriginal(source,this.access.owner!.tenantId);return sameTreatmentListOriginal(current,this.receipt.original)?current:null;}catch{return null;}
 }
 open(source:TreatmentListOriginal|null,view:TreatmentEntryView,token:symbol,id:string,ticket=this.attempt):TreatmentEntrySelection|null{
  if(token!==this.lifetime||ticket!==this.attempt||!this.access.canManage)return null;const pool=this.current(source,view),row=pool?.executions.find(e=>e.id===id);
  return row&&this.access.owner?{executionId:id,clientId:String(row.client_id),owner:{...this.access.owner},generation:Symbol(),mountKey:++this.selectionSerial}:null;
 }
 /** Child independently confirms its own request/form close. Parent pool may change after that confirmed write. */
 mayClose(selection:TreatmentEntrySelection,current:TreatmentEntrySelection|null):boolean{
  return this.canRead()&&current===selection&&current.generation===selection.generation&&sameMedicationListOriginal(selection.owner,this.access.owner);
 }
 owns(selection:TreatmentEntrySelection){return this.canRead()&&sameMedicationListOriginal(selection.owner,this.access.owner);}
}
