import { sameWoundJson, woundInstant, woundUuid } from '../pflege/woundCareDomain.ts';

export const personnelVersion = '2026-10-16.1' as const;
export type PersonnelRow = Record<string, unknown>;
export type PersonnelScope = { tenantId: string; employeeId: string; actorId: string };
export const personnelKinds = ['employment','qualification','delegation','instruction','double_staffing','education_due','coverage','safety','payroll_time','absence','return_decision','offboard','correct'] as const;
export type PersonnelKind = typeof personnelKinds[number];
export type PersonnelSourceKind = 'employee'|'document'|'qualification'|'training'|'assignment'|'absence'|'time_entry'|'access'|'safety';
export type PersonnelSource = { kind: PersonnelSourceKind; id: string; snapshot: PersonnelRow };
export type PersonnelPerson = { id: string; profileId: string|null; tenantId: string; name: string; roleKey: string; active: boolean; updatedAt: string };
export type PersonnelCommand = PersonnelScope & { version: typeof personnelVersion; requestId: string; eventId: string; expectedHeadId: string|null; kind: PersonnelKind; occurredAt: string; note: string; payload: PersonnelRow };
export type PersonnelEvent = { id:string; sequence:number; previousId:string|null; tenantId:string; employeeId:string; actorId:string; actorName:string; recordedAt:string; command:PersonnelCommand };
export type PersonnelHistory = { version:typeof personnelVersion; tenantId:string; employeeId:string; count:number; headId:string|null; events:PersonnelEvent[] };
export type PersonnelReceipt = { version:typeof personnelVersion; requestId:string; command:PersonnelCommand; event:PersonnelEvent };
export type PersonnelContext = PersonnelScope & { version:typeof personnelVersion; loadedAt:string; employee:PersonnelRow; sources:{count:number;rows:PersonnelSource[]}; people:{count:number;rows:PersonnelPerson[]}; history:PersonnelHistory };
export type PersonnelState = { headId:string|null; events:PersonnelEvent[]; corrected:string[] };

export const personnelLabels:Record<PersonnelKind,string>={
 employment:'Beschäftigungsfassung festhalten', qualification:'Qualifikation mit Original prüfen', delegation:'Konkrete Aufgabe delegieren', instruction:'Einarbeitung / Einweisung dokumentieren', double_staffing:'Doppelbesetzung planen oder bestätigen', education_due:'Fortbildung und Frist festhalten', coverage:'Vertretung / Bereitschaft befristen', safety:'Arbeitsschutz und Belastung dokumentieren', payroll_time:'Lohnrelevante Zeit getrennt prüfen', absence:'Abwesenheit dokumentieren', return_decision:'Rückkehr und Einschränkung entscheiden', offboard:'Austritt und Zugänge sperren', correct:'Früheres Ereignis berichtigen',
};
export const personnelBaseRights=['office.employees.view','office.employees.view_sensitive'] as const;
export const personnelWriteRights=(_kind:PersonnelKind)=>['office.employees.edit'] as const;
function fail(m:string): never {throw Error(m);}
export const personnelObject=(v:unknown):v is PersonnelRow=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
export const personnelId=(v:unknown):v is string=>woundUuid(v)&&v===v.toLowerCase();
const instant=(v:unknown):v is string=>typeof v==='string'&&woundInstant(v)!==null;
const at=(v:string)=>woundInstant(v)!;
const text=(v:unknown,max=4000):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!v.includes('\u0000');
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
function exact(v:unknown,keys:string[]):v is PersonnelRow{return personnelObject(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
export function personnelJson(v:unknown,limit=4_000_000){
 const walk=(x:unknown,d=0):void=>{if(d>30)fail('Die Originaldaten sind zu tief verschachtelt.');if(x===null||typeof x==='boolean'||typeof x==='string'&&!x.includes('\u0000')||typeof x==='number'&&Number.isFinite(x))return;if(Array.isArray(x)){if(Reflect.ownKeys(x).length!==x.length+1)fail('Die Originalliste ist unvollständig.');for(let i=0;i<x.length;i++){const p=Object.getOwnPropertyDescriptor(x,String(i));if(!p||!p.enumerable||!('value'in p))fail('Die Originalliste ist nicht vollständig lesbar.');walk(p.value,d+1);}return;}if(!personnelObject(x))fail('Es werden vollständige einfache JSON-Originale benötigt.');for(const k of Reflect.ownKeys(x)){const p=Object.getOwnPropertyDescriptor(x,k);if(typeof k!=='string'||['__proto__','constructor','prototype'].includes(k)||!p||!p.enumerable||!('value'in p))fail('Die Originaldaten enthalten einen unzulässigen Schlüssel.');walk(p.value,d+1);}};walk(v);const raw=JSON.stringify(v);if(!raw||raw.length>limit||!sameWoundJson(JSON.parse(raw),v))fail('Der vollständige Originalbestand ist nicht darstellbar.');
}
function source(v:unknown,scope:Pick<PersonnelScope,'tenantId'|'employeeId'>,allowed:PersonnelSourceKind[]):asserts v is PersonnelSource{
 if(!exact(v,['kind','id','snapshot'])||!allowed.includes(v.kind as PersonnelSourceKind)||!personnelId(v.id)||!personnelObject(v.snapshot)||v.snapshot.tenant_id!==scope.tenantId)fail('Der vollständige Originalbezug fehlt.');
 const employee=v.kind==='employee'?v.snapshot.id:v.snapshot.employee_id;
 if(employee!==scope.employeeId)fail('Der Originalbeleg gehört nicht zu dieser Personalakte.');
 if(v.kind==='employee'&&v.snapshot.id!==v.id||v.kind!=='employee'&&v.snapshot.id!==v.id)fail('Die Originalkennung ist widersprüchlich.');personnelJson(v);
}
function person(v:unknown,tenantId:string):asserts v is PersonnelPerson{
 if(!exact(v,['id','profileId','tenantId','name','roleKey','active','updatedAt'])||!personnelId(v.id)||!(v.profileId===null||personnelId(v.profileId))||v.tenantId!==tenantId||!text(v.name,300)||!text(v.roleKey,100)||v.active!==true||!instant(v.updatedAt))fail('Eine aktuell aktive beteiligte Person fehlt.');
}
const words=(p:PersonnelRow,keys:string[])=>{if(keys.some(k=>!text(p[k])))fail('Begründung, Umfang oder Ergebnis fehlen.');};
const times=(p:PersonnelRow,a:string,b:string)=>{if(!instant(p[a])||!instant(p[b])||at(p[a] as string)>at(p[b] as string))fail('Der tatsächliche Zeitraum ist ungültig.');};
const choice=(p:PersonnelRow,k:string,v:string[])=>{if(!v.includes(String(p[k])))fail('Eine eindeutige Auswahl für '+k+' fehlt.');};
const src=(p:PersonnelRow,k:string,s:PersonnelScope,a:PersonnelSourceKind[])=>source(p[k],s,a);
const who=(p:PersonnelRow,k:string,s:PersonnelScope)=>person(p[k],s.tenantId);
export function validatePersonnelCommand(v:unknown,now=Date.now()):asserts v is PersonnelCommand{
 if(!exact(v,['version','requestId','eventId','tenantId','employeeId','actorId','expectedHeadId','kind','occurredAt','note','payload'])||v.version!==personnelVersion||!['requestId','eventId','tenantId','employeeId','actorId'].every(k=>personnelId(v[k]))||v.requestId===v.eventId||!(v.expectedHeadId===null||personnelId(v.expectedHeadId))||!personnelKinds.includes(v.kind as PersonnelKind)||!instant(v.occurredAt)||at(v.occurredAt as string)>BigInt(Math.trunc(now))*1000n||!text(v.note)||!personnelObject(v.payload))fail('Der Personalvorgang ist ungültig. Tatsächliche Zeit und Anlass prüfen.');
 personnelJson(v);const p=v.payload,s=v as PersonnelCommand;
 switch(v.kind as PersonnelKind){
  case'employment':if(!exact(p,['employee','employmentType','location','role','validFrom','validUntil','decision']))fail('Die Beschäftigungsfassung ist unvollständig.');src(p,'employee',s,['employee']);words(p,['employmentType','location','role','decision']);if(!date(p.validFrom)||!(p.validUntil===null||date(p.validUntil))||p.validUntil&&p.validFrom>p.validUntil)fail('Beschäftigungsgültigkeit prüfen.');break;
  case'qualification':if(!exact(p,['qualification','document','activity','validFrom','validUntil','result','reviewer']))fail('Die Qualifikationsprüfung ist unvollständig.');src(p,'qualification',s,['qualification']);src(p,'document',s,['document']);who(p,'reviewer',s);words(p,['activity']);choice(p,'result',['verified','rejected','expired']);if(!date(p.validFrom)||!date(p.validUntil)||p.validFrom>p.validUntil)fail('Qualifikationszeitraum prüfen.');break;
  case'delegation':if(!exact(p,['assignment','activity','validFrom','validUntil','assignee','qualificationEventId','decision']))fail('Die Delegation ist unvollständig.');src(p,'assignment',s,['assignment']);who(p,'assignee',s);words(p,['activity','decision']);times(p,'validFrom','validUntil');if(!personnelId(p.qualificationEventId))fail('Die konkrete Qualifikationsprüfung fehlt.');break;
  case'instruction':if(!exact(p,['training','document','subject','version','instructor','result','validUntil']))fail('Die Einweisung ist unvollständig.');src(p,'training',s,['training']);src(p,'document',s,['document']);who(p,'instructor',s);words(p,['subject','version']);choice(p,'result',['attended','instructed','not_passed']);if(!date(p.validUntil))fail('Einweisungsgültigkeit fehlt.');break;
  case'double_staffing':if(!exact(p,['assignment','primary','secondary','phase','reason','validFrom','validUntil']))fail('Die Doppelbesetzung ist unvollständig.');src(p,'assignment',s,['assignment']);who(p,'primary',s);who(p,'secondary',s);if((p.primary as PersonnelPerson).id===(p.secondary as PersonnelPerson).id)fail('Doppelbesetzung benötigt zwei verschiedene aktive Personen.');choice(p,'phase',['planned','primary_ack','secondary_ack','cancelled']);words(p,['reason']);times(p,'validFrom','validUntil');break;
  case'education_due':if(!exact(p,['training','document','requirement','dueAt','status']))fail('Die Fortbildungsfrist ist unvollständig.');src(p,'training',s,['training']);src(p,'document',s,['document']);words(p,['requirement']);if(!instant(p.dueAt))fail('Die Fortbildungsfrist fehlt.');choice(p,'status',['assigned','reminded','completed','verified','rejected']);break;
  case'coverage':if(!exact(p,['absence','delegate','scope','validFrom','validUntil','accessUntil','decision']))fail('Die Vertretung ist unvollständig.');src(p,'absence',s,['absence']);who(p,'delegate',s);words(p,['scope','decision']);times(p,'validFrom','validUntil');if(!instant(p.accessUntil)||at(p.accessUntil as string)>at(p.validUntil as string))fail('Vertretungszugriff muss spätestens mit der Vertretung enden.');break;
  case'safety':if(!exact(p,['safety','document','hazard','measure','status','responsible']))fail('Der Arbeitsschutzvorgang ist unvollständig.');src(p,'safety',s,['safety']);src(p,'document',s,['document']);who(p,'responsible',s);words(p,['hazard','measure']);choice(p,'status',['open','mitigated','accepted','rejected']);break;
  case'payroll_time':if(!exact(p,['timeEntry','classification','startedAt','endedAt','decision','reviewer']))fail('Die Zeitprüfung ist unvollständig.');src(p,'timeEntry',s,['time_entry']);who(p,'reviewer',s);words(p,['decision']);choice(p,'classification',['work','travel','standby','break','not_payroll']);times(p,'startedAt','endedAt');break;
  case'absence':if(!exact(p,['absence','category','validFrom','validUntil','decision']))fail('Die Abwesenheit ist unvollständig.');src(p,'absence',s,['absence']);choice(p,'category',['sick','vacation','training','unavailable','other']);words(p,['decision']);times(p,'validFrom','validUntil');break;
  case'return_decision':if(!exact(p,['absence','decision','validFrom','validUntil','restrictions','reviewer']))fail('Die Rückkehrentscheidung ist unvollständig.');src(p,'absence',s,['absence']);who(p,'reviewer',s);choice(p,'decision',['fit','restricted','not_fit']);words(p,['restrictions']);times(p,'validFrom','validUntil');break;
  case'offboard':if(!exact(p,['employee','exitDate','reason','accesses','decision']))fail('Der Austrittsvorgang ist unvollständig.');src(p,'employee',s,['employee']);if(!date(p.exitDate)||!Array.isArray(p.accesses)||!p.accesses.length)fail('Austrittsdatum und aktuelle Zugangsoriginale fehlen.');for(const x of p.accesses)source(x,s,['access']);words(p,['reason','decision']);break;
  case'correct':if(!exact(p,['targetId','reason']))fail('Die Berichtigung ist unvollständig.');if(!personnelId(p.targetId))fail('Das zu berichtigende Originalereignis fehlt.');words(p,['reason']);break;
 }
}
const latest=(events:PersonnelEvent[],kind:PersonnelKind,test:(p:PersonnelRow,e:PersonnelEvent)=>boolean)=>events.findLast(e=>e.command.kind===kind&&test(e.command.payload,e));
export function applyPersonnelCommand(previous:PersonnelState,c:PersonnelCommand,now=Date.now()):PersonnelState{
 validatePersonnelCommand(c,now);if(c.expectedHeadId!==previous.headId||previous.events.some(e=>e.id===c.eventId||e.command.requestId===c.requestId))fail('Die Personalakte wurde geändert oder die Anfrage ist bereits enthalten. Neu laden.');
 const state=structuredClone(previous);const p=c.payload;
 if(c.kind==='delegation'){
  const q=state.events.find(e=>e.id===p.qualificationEventId&&e.command.kind==='qualification');if(!q||q.command.payload.result!=='verified'||q.command.payload.activity!==p.activity||String(q.command.payload.validUntil)<new Date(p.validUntil as string).toISOString().slice(0,10))fail('Die konkrete Aufgabe ist nicht durch eine aktuelle geprüfte Qualifikation gedeckt.');
 }
 if(c.kind==='double_staffing'&&p.phase!=='planned'){
  const planned=latest(state.events,'double_staffing',q=>(q.assignment as PersonnelSource).id===(p.assignment as PersonnelSource).id&&q.phase==='planned');if(!planned||!sameWoundJson(planned.command.payload.assignment,p.assignment)||!sameWoundJson(planned.command.payload.primary,p.primary)||!sameWoundJson(planned.command.payload.secondary,p.secondary))fail('Die Bestätigung passt nicht zur aktuellen Doppelbesetzungsplanung.');
  const expected=p.phase==='primary_ack'?(p.primary as PersonnelPerson).profileId:p.phase==='secondary_ack'?(p.secondary as PersonnelPerson).profileId:null;if(expected===null||c.actorId!==expected)fail('Nur die jeweils eingeplante und aktuell verknüpfte Person darf ihre eigene Beteiligung bestätigen.');
 }
 if(c.kind==='return_decision'){
  const absence=latest(state.events,'absence',q=>(q.absence as PersonnelSource).id===(p.absence as PersonnelSource).id);if(!absence||at(absence.command.payload.validUntil as string)>at(p.validFrom as string))fail('Die Rückkehrentscheidung benötigt eine abgeschlossene ursprüngliche Abwesenheit.');
 }
 if(c.kind==='correct'){
  const target=state.events.find(e=>e.id===p.targetId);if(!target||target.command.kind==='correct'||state.corrected.includes(target.id))fail('Nur ein vorhandenes noch nicht berichtigtes Originalereignis kann korrigiert werden.');state.corrected.push(target.id);
 }
 state.headId=c.eventId;return state;
}
export const emptyPersonnelState=():PersonnelState=>({headId:null,events:[],corrected:[]});
export function decodePersonnelHistory(v:unknown,scope:Pick<PersonnelScope,'tenantId'|'employeeId'>,now=Date.now()){
 if(!exact(v,['version','tenantId','employeeId','count','headId','events'])||v.version!==personnelVersion||v.tenantId!==scope.tenantId||v.employeeId!==scope.employeeId||!Array.isArray(v.events)||v.count!==v.events.length||v.events.length>10000)fail('Der vollständige Personalverlauf fehlt.');personnelJson(v,16_000_000);
 let state=emptyPersonnelState();const requests=new Set<string>();let recorded:bigint|null=null;
 for(const raw of v.events){if(!exact(raw,['id','sequence','previousId','tenantId','employeeId','actorId','actorName','recordedAt','command'])||!personnelId(raw.id)||raw.tenantId!==scope.tenantId||raw.employeeId!==scope.employeeId||raw.sequence!==state.events.length+1||raw.previousId!==state.headId||!text(raw.actorName,300)||!instant(raw.recordedAt)||recorded!==null&&at(raw.recordedAt as string)<recorded)fail('Die Originalereigniskette ist abgeschnitten oder widersprüchlich.');const e=raw as unknown as PersonnelEvent;validatePersonnelCommand(e.command,Number(at(e.recordedAt)/1000n)+1);if(e.command.eventId!==e.id||e.command.tenantId!==e.tenantId||e.command.employeeId!==e.employeeId||e.command.actorId!==e.actorId||requests.has(e.command.requestId)||at(e.command.occurredAt)>at(e.recordedAt))fail('Die Originalanfrage passt nicht zum Ereignis.');state=applyPersonnelCommand(state,e.command,Number(at(e.recordedAt)/1000n)+1);state.events.push(structuredClone(e));requests.add(e.command.requestId);recorded=at(e.recordedAt);}
 if(v.headId!==state.headId)fail('Der gemeldete Kopf passt nicht zur Originalhistorie.');return{history:structuredClone(v) as PersonnelHistory,state};
}
export function decodePersonnelContext(v:unknown,scope:PersonnelScope,now=Date.now()):PersonnelContext{
 if(!exact(v,['version','tenantId','employeeId','actorId','loadedAt','employee','sources','people','history'])||v.version!==personnelVersion||!Object.entries(scope).every(([k,x])=>personnelId(x)&&v[k]===x)||!instant(v.loadedAt)||at(v.loadedAt as string)>BigInt(Math.trunc(now))*1000n||!personnelObject(v.employee)||v.employee.id!==scope.employeeId||v.employee.tenant_id!==scope.tenantId||!exact(v.sources,['count','rows'])||!Array.isArray(v.sources.rows)||v.sources.count!==v.sources.rows.length||!exact(v.people,['count','rows'])||!Array.isArray(v.people.rows)||v.people.count!==v.people.rows.length)fail('Der vollständige aktuelle Personalaktenkontext ist nicht bestätigt.');
 personnelJson(v,20_000_000);const seen=new Set<string>();for(const r of v.sources.rows){source(r,scope,Object.values(['employee','document','qualification','training','assignment','absence','time_entry','access','safety']) as PersonnelSourceKind[]);const key=r.kind+':'+r.id;if(seen.has(key))fail('Originalquellen sind doppelt vorhanden.');seen.add(key);}const people=new Set<string>();for(const p of v.people.rows){person(p,scope.tenantId);if(people.has(p.id))fail('Aktive Personen sind doppelt vorhanden.');people.add(p.id);}decodePersonnelHistory(v.history,scope,now);return structuredClone(v) as PersonnelContext;
}
export function assertPersonnelSelectionCurrent(c:PersonnelCommand,context:PersonnelContext){validatePersonnelCommand(c);if(c.tenantId!==context.tenantId||c.employeeId!==context.employeeId||c.actorId!==context.actorId||c.expectedHeadId!==context.history.headId)fail('Personalakte, Konto oder Fassung wurden geändert.');const check=(x:unknown):void=>{if(Array.isArray(x))return void x.forEach(check);if(personnelObject(x)&&Object.hasOwn(x,'snapshot')&&!context.sources.rows.some(r=>sameWoundJson(r,x)))fail('Ein Originalbeleg wurde geändert oder ist nicht mehr aktuell zugänglich.');if(personnelObject(x)&&Object.hasOwn(x,'roleKey')&&!context.people.rows.some(p=>sameWoundJson(p,x)))fail('Eine beteiligte Person wurde geändert oder ist nicht mehr aktiv zugänglich.');};Object.values(c.payload).forEach(check);applyPersonnelCommand(decodePersonnelHistory(context.history,context).state,c);}
export function decodePersonnelReceipt(v:unknown,c:PersonnelCommand):PersonnelReceipt{if(!exact(v,['version','requestId','command','event'])||v.version!==personnelVersion||v.requestId!==c.requestId||!sameWoundJson(v.command,c)||!exact(v.event,['id','sequence','previousId','tenantId','employeeId','actorId','actorName','recordedAt','command']))fail('Die native Quittung passt nicht zur gesicherten Anfrage.');const e=v.event;if(e.id!==c.eventId||e.previousId!==c.expectedHeadId||e.tenantId!==c.tenantId||e.employeeId!==c.employeeId||e.actorId!==c.actorId||!Number.isSafeInteger(e.sequence)||Number(e.sequence)<1||!text(e.actorName,300)||!instant(e.recordedAt)||at(c.occurredAt)>at(e.recordedAt)||!sameWoundJson(e.command,c))fail('Die native Ereignisquittung ist widersprüchlich.');personnelJson(v);return structuredClone(v) as PersonnelReceipt;}
