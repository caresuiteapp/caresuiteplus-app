// Synthetic harness for the evidence validator; this file is not PostgreSQL evidence.
import test from 'node:test';import assert from 'node:assert/strict';
import {validateAssessmentPlanningV2PostgresEvidence,assertAssessmentPlanningV2EvidenceTamperRejections} from './validate-assessment-planning-v2-postgres-evidence.mjs';
import {families,scope,id,commandOf,receiptOf,contextOf,sha} from './assessment-path-transport-fixtures.mjs';
function synthetic(){
 const assessment=commandOf(families[0]),base=commandOf(families[1]);let serial=400;
 const ref=(kind,receipt)=>({kind,id:receipt.event.id,snapshot:structuredClone(receipt.event)});
 const source={assessment:base.payload.assessment,topic:base.payload.finding,measure:base.payload.goal};source.assessment.snapshot.subject_id=id(999);source.assessment.snapshot.subject_type='client';source.assessment.snapshot.variant='ambulant';assessment.payload.assessment=structuredClone(source.assessment);source.measure.snapshot.related_risk_key=assessment.payload.measure.snapshot.related_risk_key;assessment.payload.measure=structuredClone(source.measure);const assessmentReceipt=receiptOf(assessment);
 const kinds=['goal_plan','measure_plan','daily_routine','support_boundary','schedule_commitment','plan_review_request'],packets=[],receipts=[];let goal,measure,routine,schedule;
 for(const [index,kind] of kinds.entries()){
  const definition=families[1].domain.carePlanPathDefinitions[kind],payload={};for(const field of definition.fields)payload[field.key]=field.type==='instant'?'2026-10-22T13:00:00.123456Z':field.type==='date'?'2026-10-22':field.type==='sha256'?'a'.repeat(64):field.type==='uuid'?id(++serial):field.type==='enum'?field.values[0]:'Synthetic explicitly authored value';
  if(kind==='goal_plan')Object.assign(payload,{assessment:source.assessment,finding:source.topic,goal:source.measure});
  if(kind==='measure_plan')Object.assign(payload,{goal,measure:source.measure});
  if(kind==='daily_routine')Object.assign(payload,{assessment:source.assessment,plan:goal});
  if(kind==='support_boundary')Object.assign(payload,{plan:goal,finding:source.topic});
  if(kind==='schedule_commitment')Object.assign(payload,{measure,routine});
  if(kind==='plan_review_request')Object.assign(payload,{assessment:source.assessment,goal,measure,schedule});
  const packet={...structuredClone(base),requestId:id(++serial),eventId:id(++serial),kind,expectedHeadId:receipts.at(-1)?.event.id??null,payload:structuredClone(payload)},receipt=receiptOf(packet);receipt.event.sequence=index+1;receipt.event.recordedAt='2026-10-22T12:00:00.'+String(123457+index).padStart(6,'0')+'Z';packets.push(packet);receipts.push(receipt);
  if(kind==='goal_plan')goal=ref('care_plan_path_event',receipt);if(kind==='measure_plan')measure=ref('care_plan_path_event',receipt);if(kind==='daily_routine')routine=ref('care_plan_path_event',receipt);if(kind==='schedule_commitment')schedule=ref('care_plan_path_event',receipt);
 }
 const rows=[source.assessment,source.topic,source.measure,assessment.payload.risk,ref('assessment_path_event',assessmentReceipt),...receipts.map(receipt=>ref('care_plan_path_event',receipt))],context={...contextOf(families[1],packets[0],receipts.map(receipt=>receipt.event)),sources:{count:rows.length,rows}},expected={...scope,subjectId:id(999)};
 const instrument={...expected,catalogRevision:'synthetic',readAt:'2026-10-22T13:00:00.123456Z',stateFingerprint:sha('e'),model:{key:'synthetic',title:'Synthetic model',version:'unit',claim:'product_model',status:'active'},instruments:[],selection:{revision:0,modelKey:'synthetic',modelVersion:'unit',selectedInstrumentIds:[],rationale:'',updatedAt:null}};
 const lifecycle={...expected,packetRevision:0,packetUpdatedAt:null,planVersion:1,stateFingerprint:sha('e'),measureOriginals:[{id:source.measure.id,title:'Synthetic explicit measure',personalGoal:'Synthetic goal',intervention:'Synthetic planned support',frequency:'Explicit frequency',responsibleRole:'Explicit role',relatedTopicKey:'mobility',relatedRiskKey:'fall',status:'planned',nextEvaluationAt:null,timing:'',personContribution:'',relativesContribution:'',warningSigns:'',escalationPath:'',evaluationCriteria:''}],dayRoutines:[],supportBoundaries:[],qualityVisit:null};
 return{expected,assessmentPacket:assessment,assessmentReceipt,planPackets:packets,planReceipts:receipts,context,instrument,lifecycle,rollbackCleanupPassed:true,technicalPlanningOnly:true};
}
test('Synthetic complete projection exercises all production decoders without claiming SQL execution',()=>assert.doesNotThrow(()=>validateAssessmentPlanningV2PostgresEvidence(synthetic())));
test('Synthetic valid projection rejects all independent receipt/source/scope/proof tamper cases',()=>assert.equal(assertAssessmentPlanningV2EvidenceTamperRejections(synthetic()),13));
for(const change of [e=>delete e.expected,e=>{e.planPackets={...e.planPackets,length:6};},e=>{e.planReceipts={...e.planReceipts,length:6};},e=>{e.unsupported='never retained';},e=>{e.rollbackCleanupPassed=false;},e=>{e.technicalPlanningOnly=false;}])test('Malformed synthetic evidence is rejected before a completeness claim',()=>{const evidence=synthetic();change(evidence);assert.throws(()=>validateAssessmentPlanningV2PostgresEvidence(evidence));});
test('Evidence descriptor getters are rejected without executing supplied behavior',()=>{const evidence=synthetic();let reads=0;Object.defineProperty(evidence,'expected',{enumerable:true,get(){reads++;return{};}});assert.throws(()=>validateAssessmentPlanningV2PostgresEvidence(evidence));assert.equal(reads,0);});
