import {controlExact,clinicalControlVersion,validateControlSource,type ControlSource} from './clinicalControlDomain.ts';
import {decodeControlSnapshot,decodeControlConfirmation,snapshotControlRequest,type ControlRequest,type ControlRecord} from './clinicalControlGateway.ts';
import {woundUuid} from './woundCareDomain.ts';
import {isDefiniteMedicationRejection} from './medicationRequestState.ts';
type Row=Record<string,unknown>;
export type ControlRpc=(name:string,args:Row)=>Promise<{data:unknown;error:{code?:string;message?:string}|null;status?:number}>;
export type ControlResult<T>={ok:true;data:T}|{ok:false;error:string;uncertain?:boolean};
const kinds=['infusion_event','treatment_execution','wound_assessment','medication_administration','vital_measurement','care_plan','pflege_report','protocol_event','plan_evaluation'];
export function controlSourcePermissions(kind:string,treatmentType=''):string[]{
 if(!kinds.includes(kind))throw Error('Unbekannte Kontrollquelle.');
 return kind==='protocol_event'?['pflege.documentation.view']:kind==='medication_administration'?['pflege.medications.view']:kind==='vital_measurement'?['pflege.vitals.view']:kind==='wound_assessment'?['pflege.wounds.view']:['care_plan','plan_evaluation'].includes(kind)?['pflege.plans.view']:kind==='treatment_execution'?['pflege.medications.view','pflege.vitals.view',...(treatmentType==='wound_dressing'?['pflege.wounds.view']:[])]:[];
}
export function controlWritePermissions(kind:string):string[]{return ['create','assign','reschedule','cancel','reopen'].includes(kind)?['pflege.treatment.manage']:['escalate','acknowledge'].includes(kind)?['pflege.documentation.create','pflege.handovers.manage']:['attempt','resolve'].includes(kind)?['pflege.documentation.create']:(()=>{throw Error('Unbekannte Kontrollhandlung.');})();}
export function decodeControlSources(v:unknown,tenant:string,client:string):ControlSource[]{
 if(!woundUuid(tenant)||!woundUuid(client)||!controlExact(v,['version','tenantId','clientId','count','sources'])||v.version!==clinicalControlVersion||v.tenantId!==tenant||v.clientId!==client||!Array.isArray(v.sources)||!Number.isSafeInteger(v.count)||v.count!==v.sources.length)throw Error('Kontrollquellen unvollständig oder fremd.');
 const ids=new Set<string>();return Array.from(v.sources).map(s=>{validateControlSource(s,{id:client,tenantId:tenant,clientId:client,version:clinicalControlVersion});const key=s.kind+':'+s.id;if(ids.has(key))throw Error('Originalquelle doppelt.');ids.add(key);return structuredClone(s);});
}
export function decodeControlPeople(v:unknown,tenant:string):{id:string;name:string}[]{
 if(!woundUuid(tenant)||!controlExact(v,['version','tenantId','count','people'])||v.version!==clinicalControlVersion||v.tenantId!==tenant||!Array.isArray(v.people)||!Number.isSafeInteger(v.count)||v.count!==v.people.length)throw Error('Aktives eigenes Kontrollteam unvollständig oder fremd.');
 const ids=new Set<string>();return v.people.map(p=>{if(!controlExact(p,['id','tenantId','name'])||!woundUuid(p.id)||p.id!==p.id.toLowerCase()||p.tenantId!==tenant||typeof p.name!=='string'||!p.name.trim()||p.name.length>2000||ids.has(p.id))throw Error('Aktive Person ungültig, fremd oder doppelt.');ids.add(p.id);return {id:p.id,name:p.name};});
}
export async function readControlPeopleRuntime(rpc:ControlRpc,tenant:string):Promise<ControlResult<{id:string;name:string}[]>>{
 if(!woundUuid(tenant))return {ok:false,error:'Kontroll-Mandant ungültig.'};try{const r=await rpc('read_clinical_control_people',{requested_tenant:tenant});if(r.error)return {ok:false,error:r.error.message??'Aktives eigenes Team fehlt.'};return {ok:true,data:decodeControlPeople(r.data,tenant)};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Aktives eigenes Team fehlt.'};}
}
export async function readControlRuntime(rpc:ControlRpc,tenant:string,client:string|null,now=Date.now()):Promise<ControlResult<ControlRecord[]>>{
 if(!woundUuid(tenant)||(client!==null&&!woundUuid(client)))return {ok:false,error:'Kontroll-Aktenkontext ungültig.'};
 try{const r=await rpc('read_clinical_controls',{requested_tenant:tenant,requested_client:client});if(r.error)return {ok:false,error:r.error.message??'Kontrollbestand nicht zugänglich.'};return {ok:true,data:decodeControlSnapshot(r.data,tenant,client,now)};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Kontrollbestand fehlt.'};}
}
export async function readControlSourcesRuntime(rpc:ControlRpc,tenant:string,client:string):Promise<ControlResult<ControlSource[]>>{
 if(!woundUuid(tenant)||!woundUuid(client))return {ok:false,error:'Kontroll-Aktenkontext ungültig.'};
 try{const r=await rpc('read_clinical_control_sources',{requested_tenant:tenant,requested_client:client});if(r.error)return {ok:false,error:r.error.message??'Originalquellen nicht zugänglich.'};return {ok:true,data:decodeControlSources(r.data,tenant,client)};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Originalquellen fehlen.'};}
}
export async function writeControlRuntime(rpc:ControlRpc,tenant:string,id:string,p:ControlRequest,replay=false):Promise<ControlResult<{id:string}>>{
 if(!woundUuid(tenant)||!woundUuid(id)||id!==id.toLowerCase())return {ok:false,error:'Kontroll-Anfragekennung ungültig.'};
 let payload=p;
 try{payload=replay?structuredClone(p):snapshotControlRequest(tenant,p);}catch(e){return {ok:false,error:e instanceof Error?e.message:'Kontrollangaben ungültig.'};}
 try{const r=await rpc('write_clinical_control_event',{request_id:id,payload});if(r.error)return {ok:false,error:r.error.message??'Kontrollereignis nicht gespeichert.',uncertain:replay||!isDefiniteMedicationRejection(r.error.code,r.status)};return {ok:true,data:decodeControlConfirmation(r.data,tenant,id,payload)};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Speicherbestätigung fehlt. Dieselbe Anfrage erneut prüfen.',uncertain:true};}
}
