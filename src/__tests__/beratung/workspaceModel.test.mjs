import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
// Compile the pure shared contracts with the project's existing bundler; runs on Node 20+.
const result=await build({stdin:{contents:'export * from "../../lib/beratung/workspaceModel"; export * from "../../lib/beratung/workspaceDrafts"; export * from "../../lib/beratung/workspaceTemplates"; export * from "../../lib/beratung/workspaceFilters";',resolveDir:fileURLToPath(new URL('.',import.meta.url)),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',tsconfigRaw:{compilerOptions:{}}});
const {consultationPeriod,consultationIssues,emptyConsultationAnswers,activateConsultationDraftScope,keepConsultationDraft,readConsultationDraft,clearConsultationDrafts,CONSULTATION_TEMPLATES,goalFromTemplate,addTemplateGoal,measureFromTemplate,appendDistinctText,careGradeLabel,dateAfterDays,qualificationCovers,filterConsultationVisits}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));

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

test('templates leave observations, performed exercises, learning outcomes and consent for the actual visit',()=>{
 const original={...emptyConsultationAnswers(),situation:'Individuelle Beschreibung',risk:'clarify',findingsConsent:'no'};
 for(const t of CONSULTATION_TEMPLATES){
  const next=addTemplateGoal(original,t,'unique-goal');
  assert.equal(next.situation,original.situation);assert.equal(next.risk,'clarify');assert.equal(next.findingsConsent,'no');
  assert.equal(next.careSecured,'');assert.deepEqual(next.topics,[]);assert.equal(next.guidance,'');
  if(t.kind==='45'){
   assert.equal(next.goals.length,1);assert.equal(next.goals[0].method,'');assert.equal(next.goals[0].practice,'');assert.equal(next.goals[0].result,'');
   assert.ok(consultationIssues('45',next).some(i=>i.section==='training'));
   assert.equal(addTemplateGoal(next,t,'second-goal'),next,'same learning goal is not silently duplicated');
   assert.deepEqual(goalFromTemplate(t,'unique-goal'),next.goals[0]);
  }else assert.equal(next,original);
 }
 assert.equal(original.goals.length,0);
 const measure=measureFromTemplate('Kontakt klären','m');assert.equal(measure.status,'open');assert.equal(measure.owner,'');assert.equal(measure.due,'');assert.equal(measure.outcome,'');
 assert.equal(appendDistinctText('Individuelle Notiz','Ausgewählter Baustein'),'Individuelle Notiz\nAusgewählter Baustein');
 assert.equal(appendDistinctText('Individuelle Notiz\nAusgewählter Baustein','Ausgewählter Baustein'),'Individuelle Notiz\nAusgewählter Baustein');
});

test('dates cross month, year and daylight-saving boundaries; qualifications cover the entire visit',()=>{
 assert.equal(dateAfterDays(7,'2026-10-24'),'2026-10-31');assert.equal(dateAfterDays(14,'2026-12-25'),'2027-01-08');
 const q={active:true,service_kind:'45',valid_from:'2026-10-20',valid_until:'2026-10-21'};
 assert.equal(qualificationCovers(q,'45','2026-10-20','2026-10-21'),true);
 assert.equal(qualificationCovers(q,'45','2026-10-20','2026-10-22'),false);
 assert.equal(qualificationCovers(q,'37_3','2026-10-20'),false);
 assert.equal(qualificationCovers({...q,active:false},'45','2026-10-20'),false);
 assert.equal(careGradeLabel('none'),'Pflegegrad nicht hinterlegt');assert.equal(careGradeLabel(null),'Pflegegrad nicht hinterlegt');assert.equal(careGradeLabel('3'),'Pflegegrad 3');
});

test('filters combine Berlin calendar dates, assigned staff, archived states and follow-up ordering without changing source data',()=>{
 const make=(id,changes={})=>({id,case_id:'c',client_snapshot:{name:'Erika Sommer',address:'Berlin'},employee_name:'Mara',assigned_employee_id:'e',service_kind:'37_3',status:'scheduled',scheduled_start:'2026-10-19T22:30:00Z',answers:emptyConsultationAnswers(),...changes});
 const visits=[make('a'),make('b',{status:'draft',scheduled_start:null,assigned_employee_id:null}),make('c',{status:'cancelled',answers:{...emptyConsultationAnswers(),followUpDate:'2026-10-18'}}),make('d',{status:'approved',answers:{...emptyConsultationAnswers(),followUpDate:'2026-10-19'}})];
 const w={cases:[{id:'c',title:'Entlastung'}],encounters:visits};const f={search:'',kind:'all',status:'today',employee:'all',sort:'date',from:'',until:''};
 assert.deepEqual(filterConsultationVisits(w,f,'2026-10-20').map(e=>e.id),['a','d']);
 assert.deepEqual(filterConsultationVisits(w,{...f,status:'due'},'2026-10-20').map(e=>e.id),['d']);
 assert.deepEqual(filterConsultationVisits(w,{...f,status:'all',employee:'unassigned'},'2026-10-20').map(e=>e.id),['b']);
 assert.deepEqual(filterConsultationVisits(w,{...f,status:'all',from:'2026-10-21'},'2026-10-20'),[]);
 assert.deepEqual(filterConsultationVisits(w,{...f,status:'all',kind:'45'},'2026-10-20'),[]);
 assert.deepEqual(filterConsultationVisits(w,{...f,search:'Entlastung',employee:'e'},'2026-10-20').map(e=>e.id),['a','d']);
 assert.deepEqual(visits.map(e=>e.id),['a','b','c','d']);
});
