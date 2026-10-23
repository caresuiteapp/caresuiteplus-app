import test from 'node:test';
import assert from 'node:assert/strict';
import {pathFamilies,uid,makeGroundedPathWriteCommand,makePathCommand} from './assessment-plan-path-boundary-fixtures.mjs';
for(const f of pathFamilies){
 const base=f.api['validate'+f.upper+'Command'],write=f.api['validate'+f.upper+'WriteCommand'];
 for(const kind of f.api[f.prefix+'SupportedWriteKinds'])test(`${f.name}: genuine exact native relations permit technical ${kind}`,()=>assert.doesNotThrow(()=>write(makeGroundedPathWriteCommand(f,kind))));
 test(`${f.name}: new write restrictions preserve historical clinical command decoding`,()=>{const kind=f.name==='Assessment'?'release_decision':'plan_release_decision',command=makePathCommand(f,kind);assert.doesNotThrow(()=>base(command));assert.throws(()=>write(command),/gesperrt/);});
 test(`${f.name}: write validation rejects a descriptor before invoking or changing an owner`,()=>{const c=makeGroundedPathWriteCommand(f);let calls=0;Object.defineProperty(c,'payload',{enumerable:true,get(){calls++;throw Error('must not evaluate');}});assert.throws(()=>write(c));assert.equal(calls,0);});
}
{
 const f=pathFamilies[0],write=f.api.validateAssessmentPathWriteCommand,base=f.api.validateAssessmentPathCommand;
 for(const[label,mutate]of [['foreign current assessment',p=>{p.assessment.id=uid(900);p.assessment.snapshot.id=p.assessment.id;}],['different native risk',p=>p.risk.snapshot.risk_key='nutrition'],['missing risk key',p=>p.risk.snapshot.risk_key=null],['unlinked native measure',p=>p.measure.snapshot.related_risk_key=null]])test(`Assessment new planning rejects ${label} while historical schema stays readable`,()=>{const c=makeGroundedPathWriteCommand(f);mutate(c.payload);assert.doesNotThrow(()=>base(c));assert.throws(()=>write(c));});
}
{
 const f=pathFamilies[1],write=f.api.validateCarePlanPathWriteCommand,base=f.api.validateCarePlanPathCommand;
 for(const[label,kind,mutate]of [
  ['different native topic','goal_plan',p=>p.finding.snapshot.topic_key='self_care'],
  ['missing native topic','goal_plan',p=>delete p.finding.snapshot.topic_key],
  ['goal measure without native relation','goal_plan',p=>p.goal.snapshot.related_topic_key=null],
  ['different measure body with same native ID','measure_plan',p=>p.measure.snapshot.title='Different native full body'],
  ['support from another genuine finding','support_boundary',p=>{p.finding.id=uid(901);p.finding.snapshot.id=p.finding.id;}],
  ['routine from another goal','schedule_commitment',p=>p.routine.snapshot.command.payload.plan=makeGroundedPathWriteCommand(f,'measure_plan').payload.goal],
  ['review of another goal','plan_review_request',p=>p.goal=makeGroundedPathWriteCommand(f,'measure_plan').payload.goal],
  ['review of another scheduled measure','plan_review_request',p=>p.schedule.snapshot.command.payload.measure=makeGroundedPathWriteCommand(f,'schedule_commitment').payload.measure],
 ])test(`CarePlan new ${kind} rejects ${label} without rewriting historical schema`,()=>{const c=makeGroundedPathWriteCommand(f,kind);mutate(c.payload);assert.doesNotThrow(()=>base(c));assert.throws(()=>write(c));});
 test('CarePlan native risk finding must match the goal measure exact native risk key',()=>{const c=makeGroundedPathWriteCommand(f),p=c.payload,id=uid(910);p.finding={kind:'assessment_risk',id,snapshot:{id,tenant_id:c.tenantId,assessment_id:c.assessmentId,risk_key:'fall'}};p.goal.snapshot.related_risk_key='fall';assert.doesNotThrow(()=>write(c));p.goal.snapshot.related_risk_key='nutrition';assert.doesNotThrow(()=>base(c));assert.throws(()=>write(c));});
 test('CarePlan support follows the exact finding through the selected measure original',()=>{const c=makeGroundedPathWriteCommand(f,'support_boundary'),measure=makeGroundedPathWriteCommand(f,'schedule_commitment').payload.measure;c.payload.plan=structuredClone(measure);c.payload.finding=structuredClone(measure.snapshot.command.payload.goal.snapshot.command.payload.finding);assert.doesNotThrow(()=>write(c));c.payload.finding.snapshot.title='Changed retained native finding';assert.doesNotThrow(()=>base(c));assert.throws(()=>write(c));});
 test('CarePlan schedule can explicitly use the same goal original instead of the measure original',()=>{const c=makeGroundedPathWriteCommand(f,'schedule_commitment');c.payload.routine.snapshot.command.payload.plan=structuredClone(c.payload.measure.snapshot.command.payload.goal);assert.doesNotThrow(()=>write(c));});
 test('CarePlan schedule cannot move the due instant before the start by one microsecond',()=>{const c=makeGroundedPathWriteCommand(f,'schedule_commitment');c.payload.startsAt='2026-10-22T12:13:14.123457Z';c.payload.dueAt='2026-10-22T12:13:14.123456Z';assert.doesNotThrow(()=>base(c));assert.throws(()=>write(c));});
 for(const kind of ['goal_plan','daily_routine','plan_review_request'])test(`CarePlan ${kind} requires the actual current Assessment original`,()=>{const c=makeGroundedPathWriteCommand(f,kind);c.payload.assessment.id=uid(920);c.payload.assessment.snapshot.id=uid(920);assert.doesNotThrow(()=>base(c));assert.throws(()=>write(c));});
 test('CarePlan exact full-native links remain independent of JSON key insertion order',()=>{const c=makeGroundedPathWriteCommand(f,'measure_plan');c.payload.measure=Object.fromEntries(Object.entries(c.payload.measure).reverse());c.payload.measure.snapshot=Object.fromEntries(Object.entries(c.payload.measure.snapshot).reverse());assert.doesNotThrow(()=>write(c));});
}
