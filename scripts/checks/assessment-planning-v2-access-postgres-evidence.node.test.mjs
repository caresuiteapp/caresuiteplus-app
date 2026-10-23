import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeAssessmentPathContext,decodeAssessmentPathReceipt,validateAssessmentPathWriteCommand} from '../../src/lib/careAssessment/assessmentPathWorkspaceDomain.web.ts';
import {createAssessmentPathRepository} from '../../src/lib/careAssessment/assessmentPathWorkspaceRepository.web.ts';
const url=new URL('./fixtures/assessment-planning-v2-access-staging-synthetic-20261023.json',import.meta.url),bytes=readFileSync(url),e=JSON.parse(bytes.toString('utf8'));
const provenance=JSON.parse(readFileSync(new URL('./fixtures/assessment-planning-v2-access-staging-synthetic-20261023.provenance.json',import.meta.url),'utf8'));
const root=new URL('../../',import.meta.url),hash=v=>createHash('sha256').update(v).digest('hex');
const scope={tenantId:e.expected.tenantId,assessmentId:e.expected.assessmentId,actorId:e.expected.actorId};

test('Actual four-case access evidence preserves the original native command and complete current history',()=>{
 assert.equal(e.partialAccessUnit,true);assert.equal(e.authorityCaseCount,4);assert.equal(e.rollbackCleanupPassed,true);assert.equal(e.sameProfileRelinkCovered,false);
 assert.doesNotThrow(()=>validateAssessmentPathWriteCommand(e.packet));
 assert.deepEqual(decodeAssessmentPathReceipt(e.receipt,e.packet),e.receipt);
 assert.deepEqual(decodeAssessmentPathContext(e.context,scope),e.context);
 assert.equal(e.context.history.count,1);assert.equal(e.context.history.headId,e.packet.eventId);
 assert.deepEqual(e.context.history.events,[e.receipt.event]);
 assert.equal(e.packet.payload.assessment.snapshot.subject_id,e.expected.subjectId);
});
test('Actual own access receipt rejects a substituted request, actor and native source snapshot',()=>{
 for(const change of [r=>r.requestId='00000000-0000-4000-8000-999999999999',r=>r.event.actorId='00000000-0000-4000-8000-999999999999',r=>r.command.payload.measure.snapshot.intervention='Synthetic replaced source']){
  const r=structuredClone(e.receipt);change(r);assert.throws(()=>decodeAssessmentPathReceipt(r,e.packet));
 }
});
test('Retained access evidence binds its exact executed subset and unchanged full authority candidate',()=>{
 assert.equal(hash(bytes),provenance.evidenceSha256);assert.equal(bytes.length,provenance.evidenceBytes);
 const sql=readFileSync(new URL(provenance.sqlFixture,root));assert.equal(hash(sql),provenance.sqlFixtureSha256);assert.equal(sql.length,provenance.sqlFixtureBytes);
 assert.equal(hash(readFileSync(new URL(provenance.parentFixture,root))),provenance.parentFixtureSha256);
 assert.equal(hash(readFileSync(new URL(provenance.patch,root))),provenance.appliedSourceSha256);
 assert.equal(hash(readFileSync(new URL(provenance.migration,root))),provenance.appliedSourceSha256);
 assert.equal(provenance.appliedMigrationVersion,'20261023010345');assert.equal(provenance.observedAccessCases.length,4);assert.equal(provenance.sameProfileRelinkCovered,false);
});
test('Actual access evidence retains no credentials, JWT claims, sessions or private Auth mappings',()=>{
 const walk=v=>{if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){assert.doesNotMatch(k,/access.?token|refresh.?token|password|secret|jwt|session.?id|raw_user_meta|raw_app_meta|authorization|bearer|auth_user_id/i);walk(x);}else if(typeof v==='string')assert.doesNotMatch(v,/eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.|-----BEGIN .*PRIVATE KEY-----/);};walk(e);
});

function harness(change=p=>p,after=()=>{}){
 const state={current:true},calls=[],envelope=data=>({data:structuredClone(data),error:null,status:200});
 const sdk={auth:{getSession:async()=>envelope({session:{user:{id:scope.actorId},access_token:'synthetic-local-proof',expires_at:4102444800}}),getUser:async()=>envelope({user:{id:scope.actorId}})},rpc:async(name,args)=>{
  if(name==='resolve_current_profile_id')return envelope(scope.actorId);if(name==='current_tenant_id')return envelope(scope.tenantId);
  calls.push({name,args:structuredClone(args)});const result=envelope(change(structuredClone(name==='web_assessment_path_v2_context'?e.context:e.receipt),name,calls.length));after(state);return result;
 }};
 return{state,calls,authority:{...scope,accessToken:'synthetic-local-proof',expiresAt:4102444800000,isCurrent:()=>state.current},repo:createAssessmentPathRepository({getSdk:()=>sdk,query:async request=>await request})};
}
test('Production Assessment repository publishes actual complete SQL context only after both current reads',async()=>{
 const h=harness(),r=await h.repo.context(h.authority);assert.equal(r.ok,true,JSON.stringify(r));assert.deepEqual(r.data,e.context);assert.equal(h.calls.length,2);assert(h.calls.every(c=>c.name==='web_assessment_path_v2_context'));
});
test('Production Assessment repository confirms the exact historical own SQL receipt',async()=>{
 const h=harness(),r=await h.repo.confirm(h.authority,e.packet);assert.equal(r.ok,true);assert.deepEqual(r.data,e.receipt);assert.equal(h.calls[0].name,'web_confirm_assessment_path_v2_event');assert.deepEqual(h.calls[0].args.p_command,e.packet);
});
test('Production Assessment repository refuses complete-state drift before publishing actual SQL context',async()=>{
 const h=harness((p,name,n)=>{if(name==='web_assessment_path_v2_context'&&n===2)p.stateFingerprint='sha256:'+'0'.repeat(64);return p;}),r=await h.repo.context(h.authority);assert.equal(r.ok,false);assert.equal(Object.hasOwn(r,'data'),false);
});
test('Production Assessment repository leaves a dispatched own result unknown after current owner loss',async()=>{
 const h=harness(p=>p,state=>{state.current=false;}),r=await h.repo.commit(h.authority,e.packet);assert.equal(r.ok,false);assert.equal(r.uncertain,true);assert.equal(Object.hasOwn(r,'data'),false);assert.equal(h.calls.length,1);
});
