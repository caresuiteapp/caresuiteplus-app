import {UUID} from './sources';
import {isDate} from './model';

export const EMPLOYEE_REGISTRATION_STATES={pending:'Prüfung ausstehend',approved:'Freigegeben',rejected:'Abgelehnt',withdrawn:'Zurückgezogen',revoked:'Widerrufen'} as const;
export type EmployeeRegistration={id:string;tenant_id:string;employee_id:string;actor_id:string;employee_number:string;
 evidence_reference:string;submitted_at:string;revision:number;state:keyof typeof EMPLOYEE_REGISTRATION_STATES;
 reviewed_by:string|null;reviewed_at:string|null;review_reference:string|null;review_note:string|null;
 valid_from:string|null;valid_until:string|null;closed_by:string|null;closed_at:string|null;close_reason:string|null;employee_name:string};
export type EmployeeWorkspace={tenantId:string;actorId:string;employeeId:string|null;employeeName:string|null;canReview:boolean;
 checkedAt:string;items:EmployeeRegistration[];nextCursor:string|null};
export type EmployeeCommand={action:'submit';input:{id:string;employeeNumber:string;evidenceReference:string}}
 | {action:'approve';input:{id:string;revision:number;reviewReference:string;reviewNote:string;validUntil:string;reviewed:true}}
 | {action:'reject'|'withdraw'|'revoke';input:{id:string;revision:number;reason:string}};
export type EmployeeRequestStatus={state:'not-found';tenantId:string;requestId:string}
 | {state:'applied';tenantId:string;requestId:string;registration:EmployeeRegistration};
export type PersonalEmployeeCapture={id:string;registrationId:string;actorId:string;employeeId:string;employeeNumber:string;
 proofId:string;proofPayloadHash:string;capturedAt:string;policy:'personal-proof-insert-15m-v1';reviewedBy:string;reviewedAt:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&UUID.test(v)&&v===v.toLowerCase();
const stamp=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v));
const text=(v:unknown,min:number,max:number):v is string=>typeof v==='string'&&v.trim()===v&&[...v].length>=min&&[...v].length<=max&&!/[\p{Cc}\p{Cf}]/u.test(v);
const shape=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function fail():never{throw Error('Die Beschäftigtenzuordnung ist unvollständig oder gehört nicht zu diesem Zugang.');}
/** End of the chosen German calendar day, including summer time. */
export function employeeValidUntil(day:string):string{
 if(!isDate(day))fail();
 const noon=new Date(`${day}T12:00:00Z`),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',hourCycle:'h23'}).format(noon));
 return new Date(Date.parse(`${day}T00:00:00Z`)+86400000-(hour-12)*3600000-1).toISOString();
}
export function readEmployeeRegistration(v:unknown,tenantId:string):EmployeeRegistration{
 if(!object(v)||!shape(v,['id','tenant_id','employee_id','actor_id','employee_number','evidence_reference','submitted_at','revision','state',
  'reviewed_by','reviewed_at','review_reference','review_note','valid_from','valid_until','closed_by','closed_at','close_reason','employee_name'])
  ||v.tenant_id!==tenantId||![v.id,v.employee_id,v.actor_id].every(uuid)||typeof v.employee_number!=='string'||!/^\d{9}$/.test(v.employee_number)
  ||!text(v.evidence_reference,3,500)||!text(v.employee_name,1,300)||!stamp(v.submitted_at)||!Number.isSafeInteger(v.revision)||Number(v.revision)<1
  ||typeof v.state!=='string'||!Object.hasOwn(EMPLOYEE_REGISTRATION_STATES,v.state))fail();
 const approved=v.state==='approved'||v.state==='revoked';
 if(approved? !uuid(v.reviewed_by)||v.reviewed_by===v.actor_id||!stamp(v.reviewed_at)||Date.parse(v.reviewed_at)<Date.parse(v.submitted_at)
   ||!text(v.review_reference,3,500)||!text(v.review_note,3,2000)||!stamp(v.valid_from)||!stamp(v.valid_until)
   ||Date.parse(v.valid_from)<Date.parse(v.reviewed_at)||Date.parse(v.valid_until)<=Date.parse(v.valid_from)
   :['reviewed_by','reviewed_at','review_reference','review_note','valid_from','valid_until'].some(k=>v[k]!==null))fail();
 const closed=['rejected','withdrawn','revoked'].includes(v.state);
 if(closed?!uuid(v.closed_by)||!stamp(v.closed_at)||Date.parse(v.closed_at)<Date.parse(v.submitted_at)||!text(v.close_reason,3,2000)
  :['closed_by','closed_at','close_reason'].some(k=>v[k]!==null))fail();
 if(v.state==='withdrawn'&&v.closed_by!==v.actor_id||['rejected','revoked'].includes(v.state)&&v.closed_by===v.actor_id)fail();
 return structuredClone(v) as EmployeeRegistration;
}
export function readEmployeeWorkspace(v:unknown,tenantId:string,actorId:string,after:string|null=null):EmployeeWorkspace{
 if(!object(v)||!shape(v,['tenantId','actorId','employeeId','employeeName','canReview','checkedAt','items','nextCursor'])
  ||v.tenantId!==tenantId||v.actorId!==actorId||!uuid(actorId)||!stamp(v.checkedAt)||typeof v.canReview!=='boolean'
  ||(v.employeeId===null?v.employeeName!==null:!uuid(v.employeeId)||!text(v.employeeName,1,300))
  ||!Array.isArray(v.items)||v.items.length>50||!(v.nextCursor===null||uuid(v.nextCursor)))fail();
 let previous=after??'';
 for(const item of v.items){const r=readEmployeeRegistration(item,tenantId);if(r.id<=previous||(!v.canReview&&(r.actor_id!==actorId||r.employee_id!==v.employeeId)))fail();previous=r.id;}
 if(v.nextCursor!==null&&(v.items.length!==50||v.nextCursor!==previous))fail();
 return structuredClone(v) as EmployeeWorkspace;
}
export function readEmployeeCommand(v:unknown):EmployeeCommand{
 if(!object(v)||!shape(v,['action','input'])||!object(v.input)||!uuid(v.input.id))fail();
 const i=v.input;
 if(v.action==='submit'){
  if(!shape(i,['id','employeeNumber','evidenceReference'])||typeof i.employeeNumber!=='string'||!/^\d{9}$/.test(i.employeeNumber)||!text(i.evidenceReference,3,500))fail();
 }else{
  if(!Number.isSafeInteger(i.revision)||Number(i.revision)<1)fail();
  if(v.action==='approve'){
   if(!shape(i,['id','revision','reviewReference','reviewNote','validUntil','reviewed'])||!text(i.reviewReference,3,500)||!text(i.reviewNote,3,2000)||!stamp(i.validUntil)||i.reviewed!==true)fail();
  }else if(!['reject','withdraw','revoke'].includes(String(v.action))||!shape(i,['id','revision','reason'])||!text(i.reason,3,2000))fail();
 }
 return structuredClone(v) as EmployeeCommand;
}
export function readEmployeeRequestStatus(v:unknown,tenantId:string,requestId:string):EmployeeRequestStatus{
 if(!object(v)||v.tenantId!==tenantId||v.requestId!==requestId||!uuid(requestId)
  ||!['applied','not-found'].includes(String(v.state))||!shape(v,['state','tenantId','requestId',...(v.state==='applied'?['registration']:[])]))fail();
 if(v.state==='applied')readEmployeeRegistration(v.registration,tenantId);
 return structuredClone(v) as EmployeeRequestStatus;
}
export function readPersonalEmployeeCapture(v:unknown):PersonalEmployeeCapture{
 if(!object(v)||!shape(v,['id','registrationId','actorId','employeeId','employeeNumber','proofId','proofPayloadHash','capturedAt','policy','reviewedBy','reviewedAt'])
  ||![v.id,v.registrationId,v.actorId,v.employeeId,v.proofId,v.reviewedBy].every(uuid)||v.reviewedBy===v.actorId
  ||typeof v.employeeNumber!=='string'||!/^\d{9}$/.test(v.employeeNumber)||typeof v.proofPayloadHash!=='string'||!/^sha256:[a-f0-9]{64}$/.test(v.proofPayloadHash)
  ||!stamp(v.capturedAt)||!stamp(v.reviewedAt)||Date.parse(v.reviewedAt)>Date.parse(v.capturedAt)||v.policy!=='personal-proof-insert-15m-v1')fail();
 return structuredClone(v) as PersonalEmployeeCapture;
}
export class EmployeeWriteError extends Error{readonly uncertain:boolean;constructor(message:string,uncertain:boolean){super(message);this.uncertain=uncertain;}}
/** An uncertain write retains its exact request. Recovery first reads status;
 * it never auto-replays a review or turns a revoked registration active again. */
export class EmployeeWriter{
 pending:{command:EmployeeCommand;requestId:string}|null=null;busy=false;checkedNotFound=false;
 private transport:{execute(c:EmployeeCommand,id:string):Promise<EmployeeRegistration>;status(id:string):Promise<EmployeeRequestStatus>};
 private newId:()=>string;
 constructor(transport:{execute(c:EmployeeCommand,id:string):Promise<EmployeeRegistration>;status(id:string):Promise<EmployeeRequestStatus>},newId:()=>string){this.transport=transport;this.newId=newId;}
 async submit(c:EmployeeCommand){if(this.busy||this.pending)throw Error('Bitte zuerst den offenen Auftrag klären.');this.pending={command:readEmployeeCommand(c),requestId:this.newId()};return this.send();}
 private async send(){if(this.busy||!this.pending)throw Error('Kein offener Auftrag.');const p=this.pending;this.busy=true;this.checkedNotFound=false;
  try{const r=await this.transport.execute(p.command,p.requestId);if(r.id!==p.command.input.id)fail();this.pending=null;return r;}
  catch(e){if(e instanceof EmployeeWriteError&&!e.uncertain)this.pending=null;throw e;}finally{this.busy=false;}}
 async check(){if(this.busy||!this.pending)throw Error('Kein offener Auftrag.');this.busy=true;const p=this.pending;this.checkedNotFound=false;
  try{const r=await this.transport.status(p.requestId);if(r.state==='applied'){if(r.registration.id!==p.command.input.id)fail();this.pending=null;}else this.checkedNotFound=true;return r;}
  finally{this.busy=false;}}
 async retry(){if(!this.checkedNotFound)throw Error('Bitte zuerst den gespeicherten Auftrag prüfen.');return this.send();}
}
