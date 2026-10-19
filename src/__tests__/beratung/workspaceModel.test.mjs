import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
// Compile the pure shared contracts with the project's existing bundler; runs on Node 20+.
const result=await build({stdin:{contents:'export * from "../../lib/beratung/workspaceModel"; export * from "../../lib/beratung/workspaceDrafts";',resolveDir:fileURLToPath(new URL('.',import.meta.url)),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',tsconfigRaw:{compilerOptions:{}}});
const {consultationPeriod,consultationIssues,emptyConsultationAnswers,activateConsultationDraftScope,keepConsultationDraft,readConsultationDraft,clearConsultationDrafts}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));

test('§37: half-years for PG2–5; optional quarters for PG4/5; invalid calendar dates rejected',()=>{
 assert.deepEqual(consultationPeriod('2026-07-01',5),{start:'2026-07-01',end:'2026-12-31',label:'2. Halbjahr 2026'});
 assert.deepEqual(consultationPeriod('2026-06-30',2),{start:'2026-01-01',end:'2026-06-30',label:'1. Halbjahr 2026'});
 assert.equal(consultationPeriod('2026-10-19',4,true).start,'2026-10-01');
 assert.equal(consultationPeriod('2026-10-19',3,true).start,'2026-07-01');
 assert.throws(()=>consultationPeriod('2026-02-31',3));assert.throws(()=>consultationPeriod('2026-13-01',3));
});
test('separate submission requirements, risk handling and a valid recommendation date',()=>{
 const a={...emptyConsultationAnswers(),participants:[{id:'p',name:'Testperson',role:'Pflegeperson',authority:''}],situation:'Test',clientPerspective:'Test',caregiverPerspective:'Test',topics:['Pflege'],guidance:'Test',careSecured:'yes',risk:'none',findingsConsent:'no',summary:'Test',measures:[{id:'m',title:'Nachfragen',owner:'Beratung',due:'2026-10-21',status:'open',outcome:''}]};
 assert.deepEqual(consultationIssues('37_3',a),[]);
 assert.ok(consultationIssues('45',a).some(i=>i.section==='training'));
 assert.ok(consultationIssues('37_3',{...a,risk:'urgent'}).some(i=>i.message.includes('Hilfe')));
 assert.deepEqual(consultationIssues('45',{...a,goals:[{id:'g',title:'Transfer',method:'Vormachen',practice:'Geübt',result:'independent',nextStep:''}]}),[]);
});
test('drafts survive route changes in the same identity, are copied, and never cross identity/logout',()=>{
 const a=emptyConsultationAnswers();activateConsultationDraftScope('tenant-a:actor-a');
 keepConsultationDraft('tenant-a:actor-a','visit-a',{answers:a,base:a,version:4});
 const copy=readConsultationDraft('tenant-a:actor-a','visit-a');assert.ok(copy);copy.answers.situation='Changed copy';
 assert.equal(readConsultationDraft('tenant-a:actor-a','visit-a')?.answers.situation,'');
 assert.equal(readConsultationDraft('tenant-a:actor-b','visit-a'),null);
 activateConsultationDraftScope('tenant-b:actor-b');assert.equal(readConsultationDraft('tenant-a:actor-a','visit-a'),null);
 keepConsultationDraft('tenant-b:actor-b','visit-b',{answers:a,base:a,version:1});clearConsultationDrafts();assert.equal(readConsultationDraft('tenant-b:actor-b','visit-b'),null);
});
