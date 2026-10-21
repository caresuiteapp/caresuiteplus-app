import { applyPersonnelCommand, emptyPersonnelState, personnelVersion } from '../../src/lib/office/personnelWorkspaceDomain.web.ts';
import { applyTourPlanningCommand, emptyTourPlanningState, tourPlanningVersion } from '../../src/lib/pflege/tourPlanningWorkspaceDomain.web.ts';
import { buildPlanningPacket } from '../../src/lib/pflege/tourPlanningWorkspaceRules.web.ts';

export const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
export const tenantId = id(1), planId = id(2), actorId = id(3), otherId = id(4), clientId = id(50);
export const NOW = Date.parse('2026-10-16T09:00:00Z');
export const time = hhmm => '2026-10-16T' + hhmm + ':00.000000Z';
let serial = 10000;
export const source = (kind, n, extra = {}) => ({kind, id:id(n),snapshot:{id:id(n),tenant_id:tenantId,...extra}});
export const person = (n = 3) => ({id:id(n),profileId:id(n),tenantId,name:n===3?'Alex Pflege':'Bea Pflege',roleKey:n===3?'dispatch':'nurse',active:true,updatedAt:time('00:00')});
export const tour = source('tour',2,{tour_date:'2026-10-16',name:'Nordtour',employee_id:actorId,status:'draft',updated_at:time('00:00')});
export const stop = source('stop',10,{tour_id:planId,client_id:clientId,client_name_snapshot:'Erika Beispiel',status:'planned'});
export const shift = source('shift',12,{employee_id:actorId,shift_date:'2026-10-16',start_time:'07:00:00',end_time:'18:00:00',break_minutes:30,status:'published'});
export const rule = {...shift,kind:'work_rule'};
export const admission = source('admission',14,{client_id:clientId,status:'active'});
export const carePlan = source('care_plan',15,{client_id:clientId,status:'active'});
export const preference = source('preference',16,{client_id:clientId,preferred_times:'vormittags'});
export const absence = source('absence',17,{employee_id:actorId,starts_at:time('06:00'),ends_at:time('12:00'),status:'approved'});
export const series = source('series',19,{care_plan_id:carePlan.id});
export const vehicle = source('vehicle',20,{active:true,plate:'TEST-20'});
export const maintenance = {...vehicle,kind:'maintenance'};
export function personnel(n = 3) {
  const employee = source('employee',n,{first_name:n===3?'Alex':'Bea',last_name:'Pflege',status:'active'});
  const document = source('document',200+n,{employee_id:id(n),category:'qualification',title:'Originalnachweis'});
  const qualification = source('qualification',300+n,{employee_id:id(n),document_id:document.id,status:'valid',title:'Geprüfte Qualifikation'});
  let state = emptyPersonnelState();
  const append = (kind,payload) => {
    const c = {version:personnelVersion,requestId:id(serial++),eventId:id(serial++),tenantId,employeeId:id(n),actorId,expectedHeadId:state.headId,kind,occurredAt:time('01:00'),note:'Eigene verantwortliche Personalentscheidung',payload};
    const next = applyPersonnelCommand(state,c,NOW);
    next.events.push({id:c.eventId,sequence:state.events.length+1,previousId:state.headId,tenantId,employeeId:id(n),actorId,actorName:'Alex Leitung',recordedAt:time('02:00'),command:structuredClone(c)});
    state = next;return c;
  };
  append('employment',{employee,employmentType:'Vollzeit',location:'Nord',role:'Pflege',validFrom:'2026-01-01',validUntil:'2027-12-31',decision:'Tatsächliche Beschäftigungsfassung geprüft'});
  append('qualification',{qualification,document,activity:'Grundpflege',validFrom:'2026-01-01',validUntil:'2027-12-31',result:'verified',reviewer:person()});
  const proof = () => source('personnel',n,{history:{version:personnelVersion,tenantId,employeeId:id(n),count:state.events.length,headId:state.headId,events:structuredClone(state.events)},qualifications:[structuredClone(qualification)],documents:[structuredClone(document)]});
  return {employee,document,qualification,append,proof,get state(){return state;}};
}
export function command(kind,payload,head=null,who=actorId,occurredAt=time('07:00')) {
  return {version:tourPlanningVersion,requestId:id(serial++),eventId:id(serial++),tenantId,planId,actorId:who,expectedHeadId:head,kind,occurredAt,note:'Nachvollziehbarer eigener Planungsanlass',payload};
}
export function append(state,c) {
  const next = applyTourPlanningCommand(state,c,NOW);
  next.events.push({id:c.eventId,sequence:state.events.length+1,previousId:state.headId,tenantId,planId,actorId:c.actorId,actorName:c.actorId===otherId?'Bea Pflege':'Alex Planung',recordedAt:time('08:00'),command:structuredClone(c)});
  return next;
}
export function fixture({assign=true, publish=false}={}) {
  let state = emptyTourPlanningState();const q=personnel(),q2=personnel(4);
  const version=command('plan_version',{tour,versionLabel:'Nord / 1',validFrom:'2026-10-16',validUntil:'2026-10-31',decision:'Aktuelle Fassung geprüft'},state.headId);state=append(state,version);
  const rules=command('rule_review',{rule,shift,startedAt:time('05:00'),endedAt:time('15:00'),breakMinutes:30,result:'compliant',exceptionReason:'Konkrete Regelgrundlage durch verantwortliche Disposition geprüft'},state.headId);state=append(state,rules);
  const visit=command('visit_binding',{tour,stop,admission,carePlan,frequency:'täglich',serviceType:'Grundpflege',windowStart:time('06:30'),windowEnd:time('07:00'),continuity:'active',decision:'planned'},state.headId);state=append(state,visit);
  const cleared=command('maintenance',{vehicle,maintenance,dueAt:'2027-01-01T00:00:00.000000Z',status:'cleared',outcome:'Eigenen Wartungsbeleg geprüft',replacement:null,decision:'Befristete Einsatzfreigabe dokumentiert'},state.headId,actorId,time('05:00'));state=append(state,cleared);
  const assignmentPayload={tour,shift,primary:person(),primaryQualification:q.qualification,secondary:null,secondaryQualification:null,vehicle,maintenance,capacityMinutes:300,travelMinutes:40,accessSummary:'Zugangsvoraussetzungen abgestimmt, keine Zugangscodes',decision:'Zuordnung eigenständig geprüft',planVersionEventId:version.eventId,primaryPersonnel:q.proof(),secondaryPersonnel:null,startedAt:time('06:00'),endedAt:time('12:00'),activity:'Grundpflege',maintenanceEventId:cleared.eventId};
  let assignment=null,publication=null;
  if(assign){assignment=command('assignment',assignmentPayload,state.headId);state=append(state,assignment);}
  const publicationPayload=()=>({tour,planVersionEventId:version.eventId,versionLabel:'Nord / 1',validFrom:'2026-10-16',validUntil:'2026-10-31',recipients:[person(),person(4)],decision:'Diesen vollständigen Planinhalt freigegeben',packet:buildPlanningPacket(state)});
  if(publish){publication=command('publish',publicationPayload(),state.headId);state=append(state,publication);}
  const context=()=>structuredClone({version:tourPlanningVersion,tenantId,planId,actorId,loadedAt:time('08:30'),plan:tour.snapshot,sources:{count:13,rows:[tour,stop,shift,rule,admission,carePlan,preference,series,vehicle,maintenance,q.qualification,q.proof(),q2.proof()]},people:{count:2,rows:[person(),person(4)]},history:{version:tourPlanningVersion,tenantId,planId,count:state.events.length,headId:state.headId,events:structuredClone(state.events)}});
  return {q,q2,version,rules,visit,cleared,assignment,assignmentPayload,publication,publicationPayload,context,get state(){return state;},add(kind,payload,who=actorId,occurredAt=time('07:00')){const c=command(kind,payload,state.headId,who,occurredAt);state=append(state,c);return c;}};
}
export function store(){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),map:m};}
