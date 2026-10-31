import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('der reale ambulante Dokumentationsarbeitsplatz bindet den vollständigen E-Pfad ein',()=>{
 const screen=read('src/screens/pflege/CareDocumentationListScreen.web.tsx');
 for(const token of ['CareDocumentationPathWorkspace','clientId={clientId}'])assert.ok(screen.includes(token),token);
 const surface=read('src/components/pflege/CareDocumentationPathWorkspace.web.tsx');
 for(const token of ['Pflegebericht, Leistungsdokumentation, Ablehnung, Vorkommnis','tatsächliche Durchführung','Teil- oder Nichtleistung','Fachentscheidung','Gesicherten Vorgang ausschließlich prüfen','Quittung mit Originalverlauf abgleichen','Aktuelle vollständige Dokumentationsoriginale neu laden'])assert.ok(surface.includes(token),token);
 assert.ok(surface.includes("version:'2026-10-16.5'"));
});

test('Repository, Journal und lokaler Entwurf trennen Schreiben von lesender Wiederaufnahme',()=>{
 const repository=read('src/lib/pflege/careDocumentationPathWorkspaceRepository.web.ts');
 for(const token of ['web_care_documentation_path_workspace_context','requireCareWorkspaceAuthorityWeb','cloneClientNativeOriginal','rejected:true','uncertain:true'])assert.ok(repository.includes(token),token);
 const workflow=read('src/lib/pflege/careDocumentationPathWorkspaceWorkflow.web.ts');
 for(const token of ["phase:'prepared'","phase:'dispatched'","phase:'confirmed'",'navigator.locks','confirm()','releaseConfirmed'])assert.ok(workflow.includes(token),token);
 const draft=read('src/lib/pflege/careDocumentationPathWorkspaceDraft.web.ts');
 for(const token of ['tenantId','clientId','actorId','headId','selected:changed?{}'])assert.ok(draft.includes(token),token);
});

test('vorbereiteter SQL-Vertrag schützt Originale, Rechte, CAS, Quittung und Rollbackgrenze',()=>{
 const sql=read('supabase/patches/ambulatory_care_documentation_path_workspace.sql');
 for(const token of ['PREPARED ONLY','begin;','commit;','enable row level security','revoke all','security invoker',"security definer set search_path=''",'auth.sessions','for update','expectedHeadId','40001','web_confirm_care_documentation_path_event','care_documentation_path_private.walk_sources','pflege.documentation.sign','pflege.audit.view','care_plan_path_private.events','care_documentation_private.versions'])assert.ok(sql.includes(token),token);
 assert.equal(sql.includes('grant execute on function public.web_commit_care_documentation_path_event(jsonb)to anon'),false);
});

test('E-01 bis E-10 bleiben fachlich getrennte Vorgänge statt automatische Schlussfolgerung',()=>{
 const domain=read('src/lib/pflege/careDocumentationPathWorkspaceDomain.web.ts');
 for(const token of ['care_report','planned_service_record','partial_service_record','non_service_record','refusal_record','incident_report','incident_closure','protocol_record','content_confirmation','history_review','control_order','control_result','control_nonperformance','external_document_review','documentation_review_request','documentation_review_return','documentation_review_decision','correction'])assert.ok(domain.includes(token),token);
 assert.notEqual(domain.indexOf('planned_service_record'),domain.indexOf('partial_service_record'));
 assert.notEqual(domain.indexOf('care_report'),domain.indexOf('content_confirmation'));
 assert.notEqual(domain.indexOf('control_result'),domain.indexOf('documentation_review_decision'));
});

test('Web-Pfad importiert keine Android-spezifische Oberfläche',()=>{
 const screen=read('src/screens/pflege/CareDocumentationListScreen.web.tsx');
 const surface=read('src/components/pflege/CareDocumentationPathWorkspace.web.tsx');
 assert.equal(/from\s*['\"][^'\"]*android[^'\"]*['\"]/i.test(screen+surface),false);
});
