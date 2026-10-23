// Synthetic, complete DTOs for actual Web-domain boundary checks; no PostgreSQL evidence.
import * as assessment from '../../src/lib/careAssessment/assessmentPathWorkspaceDomain.web.ts';
import * as plan from '../../src/lib/careAssessment/carePlanPathWorkspaceDomain.web.ts';
export const pathFamilies=[
 {name:'Assessment',api:assessment,prefix:'assessmentPath',upper:'AssessmentPath',kind:'measure_plan_revision'},
 {name:'CarePlan',api:plan,prefix:'carePlanPath',upper:'CarePlanPath',kind:'goal_plan'},
];
export const uid=n=>`abcdefab-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const scope={tenantId:uid(1),assessmentId:uid(2),actorId:uid(3)};
export const at='2026-10-22T12:13:14.123456Z',recorded='2026-10-22T12:13:14.300000Z',proof='sha256:'+'a'.repeat(64);
let serial=100;const next=()=>uid(++serial);
export function makePathCommand(family,kind=family.kind){
 const d=family.api[family.prefix+'Definitions'][kind],payload={};
 for(const rule of d.sources){const native=rule.kinds.find(k=>!k.endsWith('_path_event')),sourceKind=native??rule.kinds[0],id=next();
  if(sourceKind.endsWith('_path_event')){const other=sourceKind==='assessment_path_event'?pathFamilies[0]:pathFamilies[1],eventKind=rule.eventKinds?.[0]??other.kind,command=makePathCommand(other,eventKind),event=makePathEvent(command);payload[rule.key]={kind:sourceKind,id:event.id,snapshot:event};}
  else payload[rule.key]={kind:sourceKind,id,snapshot:{id,tenant_id:scope.tenantId,assessment_id:scope.assessmentId,title:'Synthetic full native original',optionalLegacyFact:null}};
 }
 for(const rule of d.fields)payload[rule.key]=rule.type==='uuid'?next():rule.type==='instant'?at:rule.type==='sha256'?'b'.repeat(64):rule.type==='enum'?rule.values[0]:rule.type==='date'?'2026-10-22':'Synthetic individually recorded original text';
 return{version:family.api[family.prefix+'Version'],requestId:next(),eventId:next(),...scope,expectedHeadId:null,kind,occurredAt:at,note:'Synthetic independently authored original reason',payload};
}
export function makePathEvent(command,sequence=1,recordedAt=recorded){return{id:command.eventId,sequence,previousId:command.expectedHeadId,tenantId:command.tenantId,assessmentId:command.assessmentId,actorId:command.actorId,actorName:'Synthetic actual original author',recordedAt,command:structuredClone(command)};}
export function makePathHistory(family,count=2){let previous=null;const events=[];for(let index=0;index<count;index++){const command=makePathCommand(family);command.expectedHeadId=previous;const event=makePathEvent(command,index+1,`2026-10-22T12:13:14.${String(300000+index).padStart(6,'0')}Z`);events.push(event);previous=event.id;}return{version:family.api[family.prefix+'Version'],tenantId:scope.tenantId,assessmentId:scope.assessmentId,count:events.length,headId:previous,events};}
export function makePathContext(family){const history=makePathHistory(family),ownKind=family.name==='Assessment'?'assessment_path_event':'care_plan_path_event',rows=history.events.flatMap(event=>[...family.api[family.prefix+'Definitions'][event.command.kind].sources.map(rule=>structuredClone(event.command.payload[rule.key])),{kind:ownKind,id:event.id,snapshot:structuredClone(event)}]);return{version:family.api[family.prefix+'Version'],...scope,loadedAt:'2026-10-22T12:13:15.000000Z',stateFingerprint:proof,supportedWriteKinds:[...family.api[family.prefix+'SupportedWriteKinds']],sources:{count:rows.length,rows},history};}
export function makePathReceipt(family){const command=makePathCommand(family);return{command,receipt:{version:family.api[family.prefix+'Version'],requestId:command.requestId,command:structuredClone(command),event:makePathEvent(command)}};}
/** Explicit synthetic native links for NEW technical-write tests, not clinical defaults. */
export function makeGroundedPathWriteCommand(family,kind=family.kind){
 const command=makePathCommand(family,kind);
 const ground=c=>{
  const p=c.payload;for(const value of Object.values(p))if(value&&typeof value==='object'&&value.kind?.endsWith('_path_event'))ground(value.snapshot.command);
  if(p.assessment){p.assessment.id=c.assessmentId;p.assessment.snapshot.id=c.assessmentId;}
  if(c.version===assessment.assessmentPathVersion&&c.kind==='measure_plan_revision'){
   p.risk.snapshot.risk_key='fall';p.measure.snapshot.related_risk_key='fall';
  }else if(c.version===plan.carePlanPathVersion){
   if(c.kind==='goal_plan'){if(p.finding.kind==='assessment_topic'){p.finding.snapshot.topic_key='mobility';p.goal.snapshot.related_topic_key='mobility';}else if(p.finding.kind==='assessment_risk'){p.finding.snapshot.risk_key='fall';p.goal.snapshot.related_risk_key='fall';}}
   else if(c.kind==='measure_plan')p.measure=structuredClone(p.goal.snapshot.command.payload.goal);
   else if(c.kind==='support_boundary'){const body=p.plan.snapshot.command;p.finding=structuredClone(body.kind==='goal_plan'?body.payload.finding:body.payload.goal.snapshot.command.payload.finding);}
   else if(c.kind==='schedule_commitment')p.routine.snapshot.command.payload.plan=structuredClone(p.measure);
   else if(c.kind==='plan_review_request'){p.goal=structuredClone(p.measure.snapshot.command.payload.goal);p.schedule.snapshot.command.payload.measure=structuredClone(p.measure);p.schedule.snapshot.command.payload.routine.snapshot.command.payload.plan=structuredClone(p.measure);}
  }
 };
 ground(command);return command;
}
