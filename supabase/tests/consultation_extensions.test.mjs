import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { consultationFixture, id } from './consultation_workspace_fixture.mjs';
const rejected = code => e => e.code === code;
const content = { kind: '45', title: 'Team: Vorbereitung einer Schulung', category: 'Alltag', description: 'Synthetischer Baustein', preparation: 'Anliegen und Voraussetzungen gemeinsam erfragen.', prompts: ['Welches Ziel ist gewünscht?'], goal: 'Eine vereinbarte Alltagssituation bewältigen können.' };

test('team templates: drafts, reviewed publication, history, archives, tenant/role protection and retries', async () => {
 const f = await consultationFixture(); const { db, actor, owner, portal, load, mutate } = f;
 try {
  assert.equal((await load()).capabilities.teamTemplates, true);
  for (const invalid of [{...content,kind:'invalid'}, {...content,goal:''}, {...content,prompts:'wrong'}, {...content,findingsConsent:'yes'}]) {
   await assert.rejects(mutate('template_save',{content:invalid}),e=>['23514','22023'].includes(e.code));
  }
  const request = randomUUID();
  let result = await mutate('template_save',{content},null,request);
  assert.deepEqual(await mutate('template_save',{content},null,request),result);
  await assert.rejects(mutate('template_save',{content:{...content,title:'different'}},null,request),rejected('22023'));
  const tid = result.template_id;
  await portal();
  assert.deepEqual((await load(true)).teamTemplates,[]);
  await assert.rejects(mutate('template_save',{content}),rejected('42501'));
  await assert.rejects(mutate('template_publish',{template_id:tid,template_version:1,note:'Test'}),rejected('42501'));
  for(const table of ['consultation_team_templates','consultation_template_versions','consultation_followups']) await assert.rejects(db.query(`SELECT * FROM ${table}`),rejected('42501'));
  await assert.rejects(db.query('SELECT care_security.consultation_materialize_followups($1,$2)',[id(10),id(999)]),rejected('42501'));
  await assert.rejects(db.query('SELECT care_security.consultation_mutate($1,$2,$3,NULL,NULL,$4)',[id(10),'create',randomUUID(),'{}']),rejected('42501'));
  await actor();
  await assert.rejects(mutate('template_publish',{template_id:tid,template_version:1,note:''}),rejected('23514'));
  result=await mutate('template_publish',{template_id:tid,template_version:1,note:'Fachlich geprüft.'});
  assert.equal(result.template_version,2);
  await portal(); const published=(await load(true)).teamTemplates[0];
  assert.equal(published.draft,null); assert.deepEqual(published.history,[]); assert.deepEqual(published.published,content);
  await actor();
  const changed={...content,preparation:'Neue Vorbereitung, zunächst nur Entwurf.'};
  await mutate('template_save',{template_id:tid,template_version:2,content:changed});
  await assert.rejects(mutate('template_publish',{template_id:tid,template_version:2,note:'Stale review'}),rejected('40001'));
  await assert.rejects(mutate('template_save',{template_id:tid,template_version:2,content}),rejected('40001'));
  await portal(); assert.equal((await load(true)).teamTemplates[0].published.preparation,content.preparation);
  await actor(24,11); assert.deepEqual((await load(false,null,id(11))).teamTemplates,[]);
  await assert.rejects(mutate('template_save',{template_id:tid,template_version:3,content},null,randomUUID(),id(11)),rejected('42501'));
  await actor(); result=await mutate('template_publish',{template_id:tid,template_version:3,note:'Neue Fassung geprüft.'});
  const office=(await load()).teamTemplates[0]; assert.equal(office.history.length,4); assert.deepEqual(office.history.at(-1).content,content);
  await mutate('template_archive',{template_id:tid,template_version:result.template_version,note:'Durch neuen Baustein ersetzt.'});
  await portal(); assert.deepEqual((await load(true)).teamTemplates,[]);
  await actor(); assert.equal((await load()).teamTemplates[0].archived,true);
  await assert.rejects(mutate('template_save',{template_id:tid,template_version:5,content}),rejected('23514'));
  // Role revocation must also deny an otherwise valid retry response.
  await owner(); for(const permission of ['beratung.cases.view','office.clients.view_sensitive']) await db.query('INSERT INTO role_permissions(role_id,permission_key) VALUES($1,$2)',[id(2),permission]);
  await actor(21); const retryId=randomUUID(); await mutate('template_save',{content},null,retryId);
  await owner(); await db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'beratung.cases.manage',false)",[id(10),id(40)]);
  await actor(21); await assert.rejects(mutate('template_save',{content},null,retryId),rejected('42501'));
  await actor(); await db.query("SELECT set_config('fixture.module_enabled','false',false)"); await assert.rejects(load(),rejected('42501')); await assert.rejects(mutate('template_save',{content}),rejected('42501'));
  await actor(null); await assert.rejects(load(true),rejected('42501'));
 } finally { await db.close(); }
});

const answers={schemaVersion:1,participants:[{id:'p',name:'Synthetic Client',role:'Pflegebedürftige Person',authority:''}],clientPerspective:'Wünscht Unterstützung.',caregiverPerspective:'Wünscht Entlastung.',situation:'Synthetischer Besuch.',burden:'',topics:['Mobilität'],guidance:'Möglichkeiten besprochen.',careSecured:'yes',risk:'none',riskNotes:'',riskAction:'',findingsConsent:'no',goals:[],materials:'',measures:[{id:'m',title:'Hilfsmittel gemeinsam klären',owner:'Beratungsperson',due:'2026-11-01',status:'open',outcome:''},{id:'m2',title:'Bereits erledigte Vereinbarung',owner:'Beratungsperson',due:'2026-11-01',status:'done',outcome:'Im Besuch geklärt.'},{id:'m3',title:'Ein weiterer offener Punkt',owner:'Pflegeperson',due:'2026-11-02',status:'open',outcome:''}],summary:'Nächste Schritte vereinbart.',followUpDate:'2026-11-03',followUpNote:'Rückmeldung zu den Empfehlungen erfragen.'};
const signatures=['client','counselor'].map(role=>({name:`Synthetic ${role}`,role,authority:'',image:'data:image/png;base64,'+'A'.repeat(240)}));
test('follow-ups: approval materialization, independent completion/reopening, immutable documents, conflicts and revoked assignment',async()=>{
 const f=await consultationFixture(); const {db,actor,owner,portal,load,mutate}=f;
 try {
  await mutate('qualify',{employee_id:id(41),service_kind:'37_3',valid_from:'2025-01-01',valid_until:'2030-01-01',evidence:'Synthetische Qualifikation',active:true});
  let e=await mutate('create',{client_id:id(50),title:'Testfall',service_kind:'37_3'});
  e=await mutate('plan',{employee_id:id(41),scheduled_start:'2026-10-20T08:00:00Z',scheduled_end:'2026-10-20T09:00:00Z'},e);
  await portal(); e=await mutate('read',{},e); e=await mutate('start',{},e); e=await mutate('finish',{},e); e=await mutate('submit',{answers,signatures},e);
  assert.deepEqual((await load(true)).followUps,[]);
  await actor(); const approveRequest=randomUUID(),submitted={...e}; e=await mutate('approve',{},e,approveRequest);
  assert.deepEqual(await mutate('approve',{},submitted,approveRequest),e);
  let state=await load(false,e.case_id); assert.equal(state.followUps.length,3);
  assert.equal(state.followUps.find(t=>t.source_key.startsWith('followup:')).description,answers.followUpNote);
  const frozen=structuredClone(state.revisions);const encounterVersion=e.version;
  let task=state.followUps.find(t=>t.title==='Hilfsmittel gemeinsam klären');
  await portal(); state=await load(true,e.case_id); assert.equal(state.followUps.length,3); assert.ok(state.followUps.every(t=>t.can_edit));
  await assert.rejects(mutate('followup_update',{followup_id:task.id,followup_version:1,status:'done',due_date:task.due_date,note:''},e),rejected('23514'));
  const update={followup_id:task.id,followup_version:1,status:'done',due_date:task.due_date,note:'Rückmeldung erhalten; Empfehlung umgesetzt.'}; const updateRequest=randomUUID();
  let r=await mutate('followup_update',update,e,updateRequest); assert.equal(r.version,encounterVersion); assert.equal(r.followup_version,2);
  assert.deepEqual(await mutate('followup_update',update,e,updateRequest),r);
  await assert.rejects(mutate('followup_update',{...update,note:'Andere Rückmeldung'},e),rejected('40001'));
  await actor(); state=await load(false,e.case_id);
  assert.equal(state.followUps.find(t=>t.id===task.id).status,'done'); assert.deepEqual(state.revisions,frozen); assert.deepEqual(state.encounters[0].answers,answers); assert.equal(state.encounters[0].version,encounterVersion);
  await mutate('followup_import',{},e); await mutate('followup_import',{},e); state=await load(false,e.case_id); assert.equal(state.followUps.length,3); assert.equal(state.followUps.find(t=>t.id===task.id).status,'done');
  await mutate('followup_update',{...update,followup_version:2,status:'open',due_date:'2026-11-10',note:'Erneute Rückfrage erforderlich.'},e);
  state=await load(false,e.case_id); task=state.followUps.find(t=>t.id===task.id); assert.equal(task.version,3);assert.equal(task.completed_at,null);assert.equal(task.due_date,'2026-11-10');assert.equal(state.events.filter(x=>x.action==='followup_update').length,2);
  const createRequest=randomUUID(),manual={title:'Zusätzlichen Kontakt vereinbaren',owner_label:'Beratungsperson',due_date:'2026-11-12'};
  const manualResult=await mutate('followup_create',manual,e,createRequest); assert.deepEqual(await mutate('followup_create',manual,{...e,version:e.version},createRequest),manualResult);
  let other=await mutate('add_visit',{case_id:e.case_id,service_kind:'37_3'});
  await assert.rejects(mutate('followup_update',{...update,followup_version:3},other),rejected('42501'));
  await actor(24,11); await assert.rejects(mutate('followup_create',manual,e,randomUUID(),id(11)),rejected('42501'));
  // Assignment changes hide the source visit and tasks and invalidate old replay requests.
  await owner(); await db.query('UPDATE consultation_encounters SET assigned_employee_id=$1 WHERE id=$2',[id(42),e.encounter_id]);
  await portal(); assert.deepEqual((await load(true)).followUps,[]); await assert.rejects(mutate('followup_update',update,e,updateRequest),rejected('42501'));
  await owner(); const flags=await db.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('consultation_team_templates','consultation_template_versions','consultation_followups')"); assert.ok(flags.rows.every(r=>r.relrowsecurity));
  const publicRpc=await db.query("SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('consultation_workspace_load','consultation_workspace_mutate')");assert.ok(publicRpc.rows.every(r=>!r.prosecdef));
 } finally {await db.close();}
});
