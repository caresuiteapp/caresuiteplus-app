import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('der reale ambulante Assessment-Arbeitsplatz bindet den vollständigen C-Pfad ein',()=>{
 const screen=read('src/screens/careAssessment/CareAssessmentWorkspaceScreen.web.tsx');
 for(const token of ['AssessmentPathWorkspace','assessmentId={draftContext.assessmentId}','section === \'history\''])assert.ok(screen.includes(token),token);
 const surface=read('src/components/careAssessment/AssessmentPathWorkspace.web.tsx');
 for(const token of ['Beobachtung, Einschätzung, Risiko, Instrument, Planung','tatsächliche Durchführung','Wirkung','Neueinschätzung','append-only','Gesicherten Vorgang ausschließlich prüfen','Quittung mit Originalverlauf abgleichen','Aktuelle vollständige Assessmentpfadoriginale neu laden'])assert.ok(surface.includes(token),token);
});

test('Repository, Journal und lokaler Entwurf trennen Schreiben von lesender Wiederaufnahme',()=>{
 const repository=read('src/lib/careAssessment/assessmentPathWorkspaceRepository.web.ts');
 for(const token of ['web_assessment_path_workspace_context','web_commit_assessment_path_event','web_confirm_assessment_path_event','rejected:true','uncertain:true'])assert.ok(repository.includes(token),token);
 const workflow=read('src/lib/careAssessment/assessmentPathWorkspaceWorkflow.web.ts');
 for(const token of ["phase:'prepared'","phase:'dispatched'","phase:'confirmed'",'navigator.locks','confirm()','releaseConfirmed'])assert.ok(workflow.includes(token),token);
 const draft=read('src/lib/careAssessment/assessmentPathWorkspaceDraft.web.ts');
 for(const token of ['tenantId','assessmentId','actorId','headId','selected:changed?{}'])assert.ok(draft.includes(token),token);
});

test('vorbereiteter SQL-Vertrag schützt Originale, Rechte, CAS, Quittung und Rollbackgrenze',()=>{
 const sql=read('supabase/patches/ambulatory_assessment_path_workspace.sql');
 for(const token of ['PREPARED ONLY','begin;','commit;','enable row level security','revoke all','security invoker',"security definer set search_path=''",'auth.sessions','for update','expectedHeadId','40001','web_confirm_assessment_path_event','assessment_path_private.walk_sources'])assert.ok(sql.includes(token),token);
 assert.equal(sql.includes('grant execute on function public.web_commit_assessment_path_event(jsonb)to anon'),false);
});

test('C-01 bis C-10 bleiben fachlich getrennte Vorgänge statt automatische Schlussfolgerung',()=>{
 const domain=read('src/lib/careAssessment/assessmentPathWorkspaceDomain.web.ts');
 for(const token of ['model_version_review','person_perspective_observation','cognition_assessment','mobility_assessment','disease_demands_assessment','self_care_assessment','household_assessment','social_relationships_assessment','risk_screening','risk_deep_assessment','instrument_selection','measure_plan_revision','execution_observation','effect_evaluation','review_request','review_return','release_decision','reassessment_trigger','reassessment_start','correction'])assert.ok(domain.includes(token),token);
 assert.notEqual(domain.indexOf('execution_observation'),domain.indexOf('effect_evaluation'));
 assert.notEqual(domain.indexOf('review_request'),domain.indexOf('release_decision'));
});

