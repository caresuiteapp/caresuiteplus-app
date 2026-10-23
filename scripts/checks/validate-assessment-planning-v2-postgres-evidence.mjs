// Validate the exact synthetic projection emitted by the rolled-back V2 Staging unit.
// This runner performs no RPC and supplies no clinical, browser, HTTP or concurrency proof.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {captureAssessmentWorkspaceJson} from '../../src/lib/careAssessment/assessmentWorkspaceTransport.web.ts';
import {assessmentPathVersion,validateAssessmentPathWriteCommand,decodeAssessmentPathReceipt,assessmentPathDefinitions} from '../../src/lib/careAssessment/assessmentPathWorkspaceDomain.web.ts';
import {carePlanPathVersion,validateCarePlanPathWriteCommand,decodeCarePlanPathReceipt,decodeCarePlanPathContext,carePlanPathDefinitions} from '../../src/lib/careAssessment/carePlanPathWorkspaceDomain.web.ts';
import {validateAssessmentInstrumentSnapshot} from '../../src/lib/careAssessment/assessmentInstrumentPacket.web.ts';
import {validatePlanLifecycleSnapshot} from '../../src/lib/careAssessment/planLifecyclePacket.web.ts';
const uuid=value=>typeof value==='string'&&value.length===36&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const clone=value=>structuredClone(value);
export function validateAssessmentPlanningV2PostgresEvidence(input){
 const evidence=captureAssessmentWorkspaceJson(input);assert.ok(evidence&&typeof evidence==='object'&&!Array.isArray(evidence));assert.deepEqual(Object.keys(evidence).sort(),['assessmentPacket','assessmentReceipt','context','expected','instrument','lifecycle','planPackets','planReceipts','rollbackCleanupPassed','technicalPlanningOnly']);const expected=evidence.expected;
 assert.ok(expected&&typeof expected==='object'&&!Array.isArray(expected),'Separate native seed expectations are required.');
 assert.deepEqual(Object.keys(expected).sort(),['actorId','assessmentId','subjectId','tenantId']);
 for(const key of Object.keys(expected))assert.ok(uuid(expected[key]),'Expected '+key+' must be an exact UUID.');
 assert.equal(evidence.rollbackCleanupPassed,true);assert.equal(evidence.technicalPlanningOnly,true);
 const own=(packet)=>{for(const key of ['tenantId','assessmentId','actorId'])assert.equal(packet[key],expected[key],'Exact seed '+key);};
 const assessment=evidence.assessmentPacket;own(assessment);assert.equal(assessment.version,assessmentPathVersion);assert.equal(assessment.kind,'measure_plan_revision');assert.equal(assessment.expectedHeadId,null);validateAssessmentPathWriteCommand(assessment);
 const nativeAssessment=assessment.payload.assessment.snapshot;assert.equal(nativeAssessment.subject_id,expected.subjectId,'Native assessment subject is the independently seeded client.');assert.equal(nativeAssessment.subject_type,'client');assert.equal(nativeAssessment.variant,'ambulant');
 const retained=decodeAssessmentPathReceipt(evidence.assessmentReceipt,assessment);assert.equal(retained.event.sequence,1);assert.equal(retained.event.previousId,null);
 const context=decodeCarePlanPathContext(evidence.context,expected);own(context);assert.equal(context.version,carePlanPathVersion);
 const kinds=['goal_plan','measure_plan','daily_routine','support_boundary','schedule_commitment','plan_review_request'];
 assert.ok(Array.isArray(evidence.planPackets));assert.ok(Array.isArray(evidence.planReceipts));assert.equal(evidence.planPackets.length,kinds.length);assert.equal(evidence.planReceipts.length,kinds.length);assert.equal(context.history.count,kinds.length);
 const events=[],requests=new Set([assessment.requestId.toLowerCase()]),eventIds=new Set([assessment.eventId.toLowerCase()]);
 for(let index=0;index<kinds.length;index++){
  const packet=evidence.planPackets[index];own(packet);assert.equal(packet.version,carePlanPathVersion);assert.equal(packet.kind,kinds[index]);assert.equal(packet.expectedHeadId,index===0?null:events[index-1].id);validateCarePlanPathWriteCommand(packet);
  assert.ok(!requests.has(packet.requestId.toLowerCase()),'Distinct retained request IDs.');requests.add(packet.requestId.toLowerCase());assert.ok(!eventIds.has(packet.eventId.toLowerCase()),'Distinct retained event IDs.');eventIds.add(packet.eventId.toLowerCase());
  const receipt=decodeCarePlanPathReceipt(evidence.planReceipts[index],packet);assert.equal(receipt.event.sequence,index+1);events.push(receipt.event);
  for(const rule of carePlanPathDefinitions[packet.kind].sources){const source=packet.payload[rule.key];assert.deepEqual(context.sources.rows.find(row=>row.kind===source.kind&&row.id===source.id),source,'Current exact chosen source '+rule.key);}
 }
 assert.deepEqual(context.history.events,events);assert.equal(context.history.headId,events.at(-1).id);
 for(const rule of assessmentPathDefinitions[assessment.kind].sources){const source=assessment.payload[rule.key];assert.deepEqual(context.sources.rows.find(row=>row.kind===source.kind&&row.id===source.id),source,'Exact native Assessment source '+rule.key);}
 const selectedAssessment=context.sources.rows.find(row=>row.kind==='assessment_path_event'&&row.id===retained.event.id);assert.ok(selectedAssessment);assert.deepEqual(selectedAssessment.snapshot,retained.event);
 assert.equal(validateAssessmentInstrumentSnapshot(evidence.instrument,expected),null);assert.equal(validatePlanLifecycleSnapshot(evidence.lifecycle,expected),null);
 assert.equal(evidence.instrument.stateFingerprint,context.stateFingerprint);assert.equal(evidence.lifecycle.stateFingerprint,context.stateFingerprint);
 assert.equal(evidence.lifecycle.packetRevision,0);assert.equal(evidence.lifecycle.packetUpdatedAt,null);
 assert.equal(evidence.lifecycle.measureOriginals.length,1);assert.equal(evidence.lifecycle.measureOriginals[0].id,assessment.payload.measure.id);
 return evidence;
}
export function assertAssessmentPlanningV2EvidenceTamperRejections(input){
 const valid=validateAssessmentPlanningV2PostgresEvidence(input);
 const mutate=[
  e=>{e.expected.actorId=e.expected.subjectId;},
  e=>{const replace=value=>{if(!value||typeof value!=='object')return;if(value.kind==='care_assessment'&&value.snapshot)value.snapshot.subject_id=e.expected.actorId;for(const nested of Object.values(value))replace(nested);};replace(e);},
  
  e=>{e.assessmentReceipt.event.actorId=e.expected.subjectId;},
  e=>{e.assessmentReceipt.command.note+=' substituted';},
  e=>{e.planReceipts[0].requestId=e.planPackets[1].requestId;},
  e=>{e.planReceipts[0].event.recordedAt='2026-02-30T12:00:00.000001Z';},
  e=>{e.planPackets[1].payload.measure.snapshot.title+=' changed';},
  e=>{e.context.history.events[0].actorName+=' changed';},
  e=>{e.context.stateFingerprint='sha256:'+(e.context.stateFingerprint[7]==='0'?'1':'0')+e.context.stateFingerprint.slice(8);},
  e=>{e.instrument.stateFingerprint='sha256:'+(e.instrument.stateFingerprint[7]==='0'?'1':'0')+e.instrument.stateFingerprint.slice(8);},
  e=>{e.lifecycle.subjectId=e.expected.actorId;},
  e=>{e.context.sources.rows=e.context.sources.rows.filter(row=>row.kind!=='assessment_path_event');e.context.sources.count=e.context.sources.rows.length;},
  e=>{e.assessmentPacket.version='2026-10-16.3';e.assessmentReceipt.version=e.assessmentPacket.version;e.assessmentReceipt.command.version=e.assessmentPacket.version;e.assessmentReceipt.event.command.version=e.assessmentPacket.version;},
 ];
 for(const change of mutate){const wrong=clone(valid);change(wrong);assert.throws(()=>validateAssessmentPlanningV2PostgresEvidence(wrong));}
 return mutate.length;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 assert.ok(process.argv[2],'Pass the saved synthetic V2 Staging JSON file.');let evidence=JSON.parse(readFileSync(process.argv[2],'utf8'));
 if(Array.isArray(evidence)){assert.equal(evidence.length,1);evidence=evidence[0].synthetic_evidence;}else if(evidence&&Object.hasOwn(evidence,'synthetic_evidence'))evidence=evidence.synthetic_evidence;
 if(typeof evidence==='string')evidence=JSON.parse(evidence);
 validateAssessmentPlanningV2PostgresEvidence(evidence);const negatives=assertAssessmentPlanningV2EvidenceTamperRejections(evidence);
 process.stdout.write(`Actual synthetic V2 projection accepted; ${negatives} independent tamper cases rejected.\n`);
}
