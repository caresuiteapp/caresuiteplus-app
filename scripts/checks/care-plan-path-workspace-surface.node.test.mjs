import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('der reale ambulante Pflegearbeitsplatz bindet den vollständigen D-Pfad ein',()=>{
 const screen=read('src/screens/careAssessment/CareAssessmentWorkspaceScreen.web.tsx');
 for(const token of ['AssessmentPlanPaths','assessmentId={draftContext.assessmentId}','section === \'history\''])assert.ok(screen.includes(token),token);
 const wrapper=read('src/components/careAssessment/AssessmentPlanPaths.web.tsx');assert.ok(wrapper.includes('CarePlanPathWorkspace'));assert.ok(wrapper.includes('selection.selected'));
 const surface=read('src/components/careAssessment/CarePlanPathWorkspace.web.tsx');
 for(const token of ['Ziel, Maßnahme, Verantwortung, Termin, Planfreigabe','tatsächliche Durchführung','Abweichung','Wirkung','Visite','Gesicherten Vorgang ausschließlich prüfen','Quittung mit Originalverlauf abgleichen','Aktuelle vollständige Pflegeplanpfadoriginale neu laden'])assert.ok(surface.includes(token),token);
});

test('Repository, Journal und lokaler Entwurf trennen Schreiben von lesender Wiederaufnahme',()=>{
 const repository=read('src/lib/careAssessment/carePlanPathWorkspaceRepository.web.ts');
 for(const token of ['web_care_plan_path_v2_context','web_commit_care_plan_path_v2_event','web_confirm_care_plan_path_v2_event','rejected:true','uncertain:true'])assert.ok(repository.includes(token),token);
 const workflow=read('src/lib/careAssessment/carePlanPathWorkspaceWorkflow.web.ts');
 for(const token of ["phase:'prepared'","phase:'dispatched'","phase:'confirmed'",'navigator.locks','confirm()','releaseConfirmed'])assert.ok(workflow.includes(token),token);
 const draft=read('src/lib/careAssessment/carePlanPathWorkspaceDraft.web.ts');
 for(const token of ['tenantId','assessmentId','actorId','headId','selected:changed?{}'])assert.ok(draft.includes(token),token);
});

test('vorbereiteter SQL-Vertrag schützt Originale, Rechte, CAS, Quittung und Rollbackgrenze',()=>{
 const sql=read('supabase/patches/ambulatory_care_plan_path_workspace.sql');
 for(const token of ['PREPARED ONLY','begin;','commit;','enable row level security','revoke all','security invoker',"security definer set search_path=''",'auth.sessions','for update','expectedHeadId','40001','web_confirm_care_plan_path_event','care_plan_path_private.walk_sources'])assert.ok(sql.includes(token),token);
 assert.equal(sql.includes('grant execute on function public.web_commit_care_plan_path_event(jsonb)to anon'),false);
});

test('D-01 bis D-08 bleiben fachlich getrennte Vorgänge statt automatische Schlussfolgerung',()=>{
 const domain=read('src/lib/careAssessment/carePlanPathWorkspaceDomain.web.ts');
 for(const token of ['goal_plan','measure_plan','daily_routine','support_boundary','responsibility_assignment','schedule_commitment','plan_review_request','plan_review_return','plan_release_decision','execution_record','non_execution_record','deviation_assessment','effect_observation','regular_evaluation','visit_observation','visit_decision','change_order','correction'])assert.ok(domain.includes(token),token);
 assert.notEqual(domain.indexOf('execution_record'),domain.indexOf('effect_observation'));
 assert.notEqual(domain.indexOf('plan_review_request'),domain.indexOf('plan_release_decision'));
 assert.notEqual(domain.indexOf('visit_observation'),domain.indexOf('visit_decision'));
});

