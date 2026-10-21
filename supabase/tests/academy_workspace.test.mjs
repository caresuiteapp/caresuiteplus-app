import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { academyFixture, content, id } from './academy_workspace_fixture.mjs';
const denied = (promise, code = '42501') => assert.rejects(promise, e => e.code === code);
const own = (f, action, enrollment, data = {}, extra = {}) => f.mutate(action, enrollment.id, enrollment.revision, data, {view:'learner', ...extra});
async function complete(f, kind = 'employee') {
  await f.learner(kind); let e = (await f.load('learner')).enrollments[0];
  await own(f,'complete_lesson',e,{lessonId:'reading'}); e=(await f.load('learner')).enrollments[0];
  await own(f,'submit_quiz',e,{lessonId:'check',answers:{'question-1':'b'}}); e=(await f.load('learner')).enrollments[0];
  await own(f,'submit_enrollment',e); return (await f.load('learner')).enrollments[0];
}
async function approve(f, kind = 'employee') {
 const submitted=await complete(f,kind); await f.actor();
 await f.mutate('review_enrollment',submitted.id,submitted.revision,{decision:'approve',note:'Synthetisch geprüft',validUntil:null});
 return (await f.load()).enrollments.find(e=>e.id===submitted.id);
}

test('actual SQL: reusable templates have their own revisions, archive lifecycle and independent course copies',async()=>{
 const f=await academyFixture();try{
  const sourceCourse=await f.publish();const originalCourse=(await f.load()).courses[0];
  const templateId=randomUUID(),request=randomUUID(),data={name:'  Einarbeitung im Team  ',description:'Wiederverwendbare Grundlage',content:content()};
  let saved=await f.mutate('save_template',templateId,null,data,{request});
  assert.equal(saved.recordId,templateId);assert.equal(saved.revision,1);
  assert.equal((await f.mutate('save_template',templateId,null,data,{request})).replayed,true);
  let ws=await f.load();assert.equal(ws.templates.length,1);assert.equal(ws.courses.length,1);assert.equal(ws.enrollments.length,0);
  assert.equal(ws.templates[0].name,'Einarbeitung im Team');assert.equal(ws.templates[0].status,'active');
  assert.equal(ws.templates[0].content.lessons[1].questions[0].correctOptionId,'b');
  const createdCourse=await f.mutate('save_course',randomUUID(),null,{content:ws.templates[0].content});
  saved=await f.mutate('save_template',templateId,saved.revision,{...data,description:'Überarbeitete eigene Vorlage',content:content({title:'Später überarbeitete Vorlage'})});
  ws=await f.load();assert.deepEqual(ws.courses.find(x=>x.id===sourceCourse.recordId),originalCourse);
  assert.equal(ws.courses.find(x=>x.id===createdCourse.recordId).content.title,'Synthetischer Lernkurs');
  assert.equal(ws.templates[0].content.title,'Später überarbeitete Vorlage');
  await denied(f.mutate('save_template',templateId,1,data),'40001');
  const archiveRequest=randomUUID(),archiveRevision=saved.revision;
  saved=await f.mutate('archive_template',templateId,archiveRevision,{}, {request:archiveRequest});
  assert.equal((await f.load()).templates[0].status,'archived');
  assert.equal((await f.mutate('archive_template',templateId,archiveRevision,{}, {request:archiveRequest})).replayed,true);
  await denied(f.mutate('save_template',templateId,saved.revision,data),'55000');
  await denied(f.mutate('archive_template',templateId,saved.revision),'55000');
  await denied(f.mutate('restore_template',templateId,1),'40001');
  saved=await f.mutate('restore_template',templateId,saved.revision);
  ws=await f.load();assert.equal(ws.templates[0].status,'active');assert.equal(ws.templates[0].revision,4);
  assert.equal(ws.templates[0].content.title,'Später überarbeitete Vorlage');
  await denied(f.mutate('restore_template',templateId,saved.revision),'55000');
  assert.equal(ws.courses.length,2);assert.equal(ws.courses.filter(x=>x.status==='published').length,1);assert.equal(ws.enrollments.length,0);
 }finally{await f.db.close();}
});

test('actual SQL: template authoring needs no person permissions and never leaks answer keys to learners or ordinary viewers',async()=>{
 const f=await academyFixture();try{
  await f.actor(21);const templateId=randomUUID(),request=randomUUID(),data={name:'Interne Vorlage',description:'Nur für Autor:innen',content:content()};
  let saved=await f.mutate('save_template',templateId,null,data,{request});
  await f.owner();await f.db.query("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key IN ('office.employees.view','office.clients.view_sensitive')",[id(2)]);
  await f.actor(21);let ws=await f.load();assert.equal(ws.participants.length,0);assert.equal(ws.templates.length,1);assert.equal(ws.capabilities.manageCourses,true);
  saved=await f.mutate('save_template',templateId,saved.revision,{...data,description:'Ohne Personenleserecht bearbeitet'});
  for(const kind of ['employee','client','family']){
   await f.learner(kind);ws=await f.load('learner');assert.deepEqual(ws.templates,[]);assert.equal(JSON.stringify(ws).includes('correctOptionId'),false);
   for(const action of ['save_template','archive_template','restore_template']) await denied(f.mutate(action,templateId,saved.revision,action==='save_template'?data:{},{view:'learner'}));
  }
  await f.owner();await f.db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'akademie.courses.manage',false)",[id(10),id(40)]);
  await f.actor(21);ws=await f.load();assert.equal(ws.capabilities.manageCourses,false);assert.deepEqual(ws.templates,[]);assert.equal(JSON.stringify(ws).includes('correctOptionId'),false);
  await denied(f.mutate('save_template',templateId,null,data,{request}));
  await denied(f.mutate('archive_template',templateId,saved.revision));
  await denied(f.mutate('restore_template',templateId,saved.revision));
  await f.actor(24,11);assert.deepEqual((await f.load('office',11)).templates,[]);
  for(const action of ['save_template','archive_template','restore_template']) await denied(f.mutate(action,templateId,null,action==='save_template'?data:{},{tenant:11}));
  const otherId=randomUUID();await f.mutate('save_template',otherId,null,data,{tenant:11});assert.equal((await f.load('office',11)).templates[0].id,otherId);
  await f.actor();assert.deepEqual((await f.load()).templates.map(x=>x.id),[templateId]);await denied(f.mutate('save_template',otherId,null,data));
  await f.actor(null);await denied(f.mutate('save_template',randomUUID(),null,data));
 }finally{await f.db.close();}
});

test('actual SQL: template draft validation and private storage prevent malformed content and bypass writes',async()=>{
 const f=await academyFixture();try{
  const data={name:'Gültige Vorlage',description:'',content:content()};const templateId=randomUUID();
  for(const invalid of [{...data,name:''},{...data,name:' '.repeat(20)},{...data,name:'n'.repeat(151)},
   {...data,description:'d'.repeat(2001)},{...data,description:null},{...data,name:123},
   {...data,tenant_id:id(11)},{...data,content:content({title:''})},
   {...data,content:content({lessons:[{id:'external',kind:'document',title:'Datei',body:'',url:'javascript:alert(1)'}]})}]){
   await denied(f.mutate('save_template',templateId,null,invalid),'22023');
  }
  assert.equal((await f.load()).templates.length,0);
  await denied(f.mutate('save_template',templateId,1,data),'40001');
  const unfinished={...data,content:content({summary:'',lessons:[{id:'unfinished',kind:'quiz',title:'',body:'',questions:[]}]})};
  const request=randomUUID(),saved=await f.mutate('save_template',templateId,null,unfinished,{request});
  assert.equal((await f.load()).templates[0].content.lessons[0].questions.length,0);
  await denied(f.mutate('save_template',templateId,null,data,{request}),'22023');
  await denied(f.mutate('archive_template',templateId,saved.revision,{status:'archived'}),'22023');
  await denied(f.mutate('archive_template',randomUUID(),1));
  await denied(f.mutate('restore_template',randomUUID(),1));
  await denied(f.db.query('SELECT * FROM academy_private.course_templates'));
  await denied(f.db.query('UPDATE academy_private.course_templates SET state=$1 WHERE id=$2',['archived',templateId]));
  await denied(f.db.query('DELETE FROM academy_private.course_templates WHERE id=$1',[templateId]));
  await f.owner();const table=(await f.db.query("SELECT relrowsecurity FROM pg_class WHERE oid='academy_private.course_templates'::regclass")).rows[0];assert.equal(table.relrowsecurity,true);
 }finally{await f.db.close();}
});

test('actual SQL: renewal requires current course and source revisions, eligible state, current audience and no active or later completed course',async()=>{
 const f=await academyFixture();try{
  let c=await f.publish();c=await f.assign(c);let open=(await f.load()).enrollments[0];
  await denied(f.mutate('renew_enrollment',open.id,open.revision,{dueDate:null,note:'Noch offen',courseRevision:c.revision}),'55000');
  const first=await approve(f);const sourceRevision=first.revision;
  await denied(f.mutate('renew_enrollment',first.id,sourceRevision,{dueDate:null,note:'Veralteter Kurs',courseRevision:c.revision-1}),'40001');
  await denied(f.mutate('renew_enrollment',first.id,sourceRevision,{dueDate:null,note:'Ungültiger Kurs',courseRevision:1.5}),'22023');
  c=await f.mutate('save_course',c.recordId,c.revision,{content:content({title:'Aktualisierte Schulung'})});
  await denied(f.mutate('renew_enrollment',first.id,sourceRevision,{dueDate:null,note:'Entwurf gesperrt',courseRevision:c.revision}),'55000');
  c=await f.mutate('publish_course',c.recordId,c.revision);c=await f.assign(c);
  await denied(f.mutate('renew_enrollment',first.id,sourceRevision,{dueDate:null,note:'Andere Teilnahme läuft',courseRevision:c.revision}),'55000');
  const latest=await approve(f);await denied(f.mutate('renew_enrollment',first.id,sourceRevision,{dueDate:null,note:'Alten Abschluss wiederholen',courseRevision:c.revision}),'55000');
  c=await f.mutate('save_course',c.recordId,c.revision,{content:content({title:'Nur für Klienten',audiences:['client']})});c=await f.mutate('publish_course',c.recordId,c.revision);
  await denied(f.mutate('renew_enrollment',latest.id,latest.revision,{dueDate:null,note:'Falsche Zielgruppe',courseRevision:c.revision}),'22023');
  c=await f.mutate('save_course',c.recordId,c.revision,{content:content({title:'Fassung vier'})});c=await f.mutate('publish_course',c.recordId,c.revision);
  await f.mutate('revoke_certificate',latest.certificateId,null,{note:'Neue Prüfung erforderlich'});
  const renewed=await f.mutate('renew_enrollment',latest.id,latest.revision,{dueDate:null,note:'Nachweis erneut erwerben',courseRevision:c.revision});
  const ws=await f.load();assert.equal(ws.enrollments.find(x=>x.id===renewed.createdEnrollmentId).versionNumber,4);assert.ok(ws.certificates.find(x=>x.id===latest.certificateId).revokedAt);
  const originalCancelledCourse=await f.publish(content({title:'Abgebrochene Erstteilnahme'}));await f.assign(originalCancelledCourse);open=(await f.load()).enrollments.find(x=>x.courseId===originalCancelledCourse.recordId);await f.mutate('cancel_enrollment',open.id,open.revision,{note:'Erstteilnahme beendet'});open=(await f.load()).enrollments.find(x=>x.id===open.id);
  await denied(f.mutate('renew_enrollment',open.id,open.revision,{dueDate:null,note:'Kein Abschluss vorhanden',courseRevision:originalCancelledCourse.revision+1}),'55000');
 }finally{await f.db.close();}
});

test('actual SQL: planning mutations enforce tenant, person rights and active identity before cached replay',async()=>{
 const f=await academyFixture();try{
  let c=await f.publish();c=await f.assign(c,[{kind:'client',id:id(50)}]);const source=await approve(f,'client');
  const request=randomUUID(),data={dueDate:null,note:'Geplante Wiederholung',courseRevision:c.revision};
  await f.actor(24,11);await denied(f.mutate('renew_enrollment',source.id,source.revision,data));
  await f.learner('family');await denied(f.mutate('renew_enrollment',source.id,source.revision,data,{view:'learner'}));
  await f.actor(21);const renewed=await f.mutate('renew_enrollment',source.id,source.revision,data,{request});
  await f.owner();await f.db.query('UPDATE client_portal_access SET portal_enabled=false WHERE id=$1',[id(61)]);
  await f.actor(21);await denied(f.mutate('renew_enrollment',source.id,source.revision,data,{request}));
  const deadline=await f.mutate('change_due_date',renewed.createdEnrollmentId,1,{dueDate:'2040-01-01',note:'Frist bei gesperrtem Zugang anpassen'});assert.equal(deadline.revision,2);
  await f.owner();await f.db.query('UPDATE client_portal_access SET portal_enabled=true WHERE id=$1',[id(61)]);
  await f.owner();await f.db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'akademie.enrollments.assign',false)",[id(10),id(40)]);
  await f.actor(21);await denied(f.mutate('renew_enrollment',source.id,source.revision,data,{request}));
  await f.owner();await f.db.exec('DELETE FROM employee_permission_overrides');await f.db.query("INSERT INTO employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'clients','client','restricted')",[id(10),id(40)]);
  await f.actor(21);await denied(f.mutate('renew_enrollment',source.id,source.revision,data,{request}));
  await f.owner();await f.db.exec('DELETE FROM employee_data_scopes');await f.db.query("UPDATE clients SET status='inactive' WHERE id=$1",[id(50)]);
  await f.actor(21);await denied(f.mutate('renew_enrollment',source.id,source.revision,data,{request}));await denied(f.mutate('change_due_date',renewed.createdEnrollmentId,1,{dueDate:'2040-01-01',note:'Inaktive Person'}));
 }finally{await f.db.close();}
});

test('actual SQL: changed deadlines reach each personal portal, retain immutable history and reject invalid or closed edits',async()=>{
 const f=await academyFixture();try{
  const c=await f.publish();await f.assign(c,[{kind:'employee',id:id(41)},{kind:'client',id:id(50)},{kind:'family',id:id(52)}]);
  for(const kind of ['employee','client','family']){
   await f.actor();let e=(await f.load()).enrollments.find(x=>x.participant.kind===kind);
   const request=randomUUID(),data={dueDate:'2040-01-31',note:'Termin gemeinsam abgestimmt'};
   const changed=await f.mutate('change_due_date',e.id,e.revision,data,{request});assert.equal(changed.revision,e.revision+1);
   assert.equal((await f.mutate('change_due_date',e.id,e.revision,data,{request})).replayed,true);
   await denied(f.mutate('change_due_date',e.id,e.revision,{...data,dueDate:'2040-02-01'}),'40001');
   await f.learner(kind);e=(await f.load('learner')).enrollments[0];
   assert.equal(e.dueDate,data.dueDate);assert.equal(e.dateChanges.length,1);
   assert.deepEqual({...e.dateChanges[0],changedAt:undefined},{previousDueDate:null,dueDate:data.dueDate,note:data.note,changedAt:undefined});
   assert.ok(e.dateChanges[0].changedAt);
   await denied(own(f,'change_due_date',e,{dueDate:null,note:'Nicht selbst ändern'}));
   await f.owner();const canonical=(await f.db.query('SELECT due_at::date::text AS deadline FROM course_enrollments WHERE id=$1',[e.id])).rows[0];assert.equal(canonical.deadline,data.dueDate);
  }
  await f.learner();let e=(await f.load('learner')).enrollments[0];await own(f,'start_enrollment',e);await f.actor();e=(await f.load()).enrollments.find(x=>x.id===e.id);
  for(const data of [{dueDate:'2040-02-30',note:'Ungültiger Tag'},{dueDate:'infinity',note:'Ungültige Frist'},{dueDate:17,note:'Ungültiger Typ'},{note:'Fehlendes Feld'},{dueDate:null,note:'x'}]) await denied(f.mutate('change_due_date',e.id,e.revision,data),'22023');
  await f.mutate('change_due_date',e.id,e.revision,{dueDate:null,note:'Frist vorläufig aufgehoben'});
  const submitted=await complete(f);await f.actor();await denied(f.mutate('change_due_date',submitted.id,submitted.revision,{dueDate:'2040-03-31',note:'Bereits eingereicht'}),'55000');
  await f.mutate('review_enrollment',submitted.id,submitted.revision,{decision:'return',note:'Inhalt ergänzen',validUntil:null});
  e=(await f.load()).enrollments.find(x=>x.id===submitted.id);await f.mutate('change_due_date',e.id,e.revision,{dueDate:'2040-03-31',note:'Zusätzliche Bearbeitungszeit'});
  await f.learner();e=(await f.load('learner')).enrollments[0];assert.equal(e.dateChanges.length,3);assert.equal(e.dueDate,'2040-03-31');
  await own(f,'submit_enrollment',e);await f.actor();e=(await f.load()).enrollments.find(x=>x.id===e.id);await f.mutate('review_enrollment',e.id,e.revision,{decision:'approve',note:'',validUntil:null});
  e=(await f.load()).enrollments.find(x=>x.id===e.id);await denied(f.mutate('change_due_date',e.id,e.revision,{dueDate:null,note:'Nach Abschluss gesperrt'}),'55000');
  await f.owner();await denied(f.db.exec("UPDATE academy_private.review_events SET note='verändert' WHERE action='change_due_date'"),'55000');
 }finally{await f.db.close();}
});

test('actual SQL: same-version renewal preserves evidence, starts empty, replays once and continues a cancelled successor chain',async()=>{
 const f=await academyFixture();try{
  let c=await f.publish();c=await f.assign(c,[{kind:'family',id:id(52)}]);const source=await approve(f,'family');const certificate=(await f.load()).certificates[0];
  const data={dueDate:'2040-12-31',note:'Wiederholung gemeinsam geplant',courseRevision:c.revision},request=randomUUID();
  const renewed=await f.mutate('renew_enrollment',source.id,source.revision,data,{request});
  assert.equal(renewed.recordId,source.id);assert.equal(renewed.revision,source.revision+1);assert.equal(renewed.createdCount,1);assert.notEqual(renewed.createdEnrollmentId,source.id);
  assert.equal((await f.mutate('renew_enrollment',source.id,source.revision,data,{request})).createdEnrollmentId,renewed.createdEnrollmentId);
  await denied(f.mutate('renew_enrollment',source.id,source.revision,{...data,note:'Geänderte Anfrage'},{request}),'22023');
  await denied(f.mutate('renew_enrollment',source.id,source.revision,data),'40001');
  let ws=await f.load(),old=ws.enrollments.find(x=>x.id===source.id),next=ws.enrollments.find(x=>x.id===renewed.createdEnrollmentId);
  assert.equal(old.state,'completed');assert.equal(old.nextEnrollmentId,next.id);assert.equal(old.previousEnrollmentId,null);assert.equal(old.certificateId,certificate.id);
  assert.equal(next.previousEnrollmentId,source.id);assert.equal(next.nextEnrollmentId,null);assert.equal(next.versionId,source.versionId);assert.equal(next.state,'assigned');assert.equal(next.progress,0);assert.deepEqual(next.attempts,[]);assert.deepEqual(next.completedLessonIds,[]);assert.deepEqual(next.dateChanges,[]);assert.equal(next.certificateId,null);assert.equal(next.dueDate,data.dueDate);
  assert.deepEqual(ws.certificates[0],certificate);
  await denied(f.mutate('renew_enrollment',old.id,old.revision,data),'55000');
  c=await f.assign(c,[{kind:'family',id:id(52)}]);assert.equal(c.createdCount,0);assert.equal((await f.load()).enrollments.length,2);
  await f.learner('family');const personal=await f.load('learner');assert.equal(personal.enrollments.length,2);assert.equal(personal.certificates.length,1);assert.equal(personal.enrollments.find(x=>x.id===next.id).previousEnrollmentId,source.id);
  await denied(own(f,'renew_enrollment',next,{...data,courseRevision:c.revision}));
  await f.actor();await f.mutate('cancel_enrollment',next.id,next.revision,{note:'Neuer Termin erforderlich'});next=(await f.load()).enrollments.find(x=>x.id===next.id);
  const resumed=await f.mutate('renew_enrollment',next.id,next.revision,{...data,courseRevision:c.revision});
  ws=await f.load();assert.equal(ws.enrollments.length,3);assert.equal(ws.enrollments.find(x=>x.id===resumed.createdEnrollmentId).previousEnrollmentId,next.id);assert.equal(ws.enrollments.find(x=>x.id===next.id).nextEnrollmentId,resumed.createdEnrollmentId);
  assert.deepEqual(ws.certificates[0],certificate);
 }finally{await f.db.close();}
});

test('actual SQL: employee, client and family complete separate immutable versioned enrollments and receive reviewed certificates', async () => {
  const f=await academyFixture(); try {
    const c=await f.publish(); await f.assign(c,[{kind:'employee',id:id(41)},{kind:'client',id:id(50)},{kind:'family',id:id(52)}]);
    assert.equal((await f.load()).enrollments.length,3);
    const enrollmentIds=[];
    for (const kind of ['employee','client','family']) {
      await f.learner(kind); const before=await f.load('learner');
      assert.equal(before.enrollments.length,1); assert.equal(before.viewer.audience,kind);
      assert.equal(JSON.stringify(before).includes('correctOptionId'),false);
      assert.equal(before.enrollments[0].participant.id,id(kind==='employee'?41:kind==='client'?50:52));
      if(kind==='family') assert.equal((await f.db.query('SELECT public.current_tenant_id() t')).rows[0].t,null);
      const e=await complete(f,kind); enrollmentIds.push(e.id); assert.equal(e.state,'submitted');
      await f.actor(); const approval=await f.mutate('review_enrollment',e.id,e.revision,{decision:'approve',note:'Synthetisch geprüft',validUntil:null});
      assert.ok(approval.certificateId);
      await f.learner(kind); const done=await f.load('learner'); assert.equal(done.enrollments[0].state,'completed');
      assert.equal(done.certificates.length,1); assert.equal(done.certificates[0].audience,kind); assert.equal(done.certificates[0].versionNumber,1);
    }
    assert.equal(new Set(enrollmentIds).size,3);
    await f.actor(); const snapshot=(await f.load()).certificates[0];
    await f.owner(); await f.db.query("UPDATE tenants SET name='Changed later' WHERE id=$1",[id(10)]);
    await f.actor(); assert.equal((await f.load()).certificates.find(x=>x.id===snapshot.id).organizationName,snapshot.organizationName);
  } finally {await f.db.close();}
});

test('actual SQL: authorization precedes replay, denies and company/academy scopes fail closed; ordinary course view cannot write', async()=>{
 const f=await academyFixture(); try {
  await f.actor(21); const request=randomUUID(),courseId=randomUUID(),data={content:content()};
  const saved=await f.mutate('save_course',courseId,null,data,{request});
  assert.equal((await f.mutate('save_course',courseId,null,data,{request})).replayed,true);
  await denied(f.mutate('save_course',courseId,null,{content:content({title:'changed'})},{request}),'22023');
  await denied(f.mutate('save_course',courseId,0,data),'40001');
  await f.owner(); await f.db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'akademie.courses.manage',false)",[id(10),id(40)]);
  await f.actor(21); await denied(f.mutate('save_course',courseId,null,data,{request}));
  await f.owner(); await f.db.exec('DELETE FROM employee_permission_overrides');
  await f.db.query("INSERT INTO employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'akademie','site','restricted')",[id(10),id(40)]);
  await f.actor(21); await denied(f.load());
  await f.owner(); await f.db.exec('DELETE FROM employee_data_scopes');
  await f.db.query("INSERT INTO company_scope_profiles(tenant_id,profile_id,scope_limited,version,updated_by) VALUES($1,$2,true,1,$2)",[id(10),id(21)]);
  await f.actor(21); await denied(f.load());
  await f.owner(); await f.db.exec('DELETE FROM company_scope_profiles');
  await f.db.query("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key='akademie.courses.manage'",[id(2)]);
  await f.actor(21); assert.equal((await f.load()).capabilities.manageCourses,false); await denied(f.mutate('save_course',courseId,saved.revision,data));
  await f.owner(); await f.db.query("INSERT INTO employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'clients','client','restricted')",[id(10),id(40)]);
  await f.actor(21); assert.equal((await f.load()).participants.filter(x=>x.kind!=='employee').length,0);
  await f.actor(23); await denied(f.load()); await f.actor(24,11); await denied(f.load('office',10));
  await f.actor(null); await denied(f.load());
 } finally {await f.db.close();}
});

test('actual SQL: direct reads/writes, helper execution and insecure progress RPC cannot bypass the workflow', async()=>{
 const f=await academyFixture(); try {
  const c=await f.publish();await f.assign(c);
  for(const table of ['courses','course_lessons','course_enrollments','certificates']) {
   await denied(f.db.query(`SELECT * FROM public.${table}`));
   await denied(f.db.query(`DELETE FROM public.${table}`));
  }
  for(const view of ['v_course_overview','v_course_lesson_overview','v_course_enrollment_overview','v_certificate_overview']) await denied(f.db.query(`SELECT * FROM ${view}`));
  assert.ok((await f.db.query('SELECT * FROM audit_logs')).rows.length>0);
  await f.learner(); assert.equal((await f.db.query('SELECT * FROM audit_logs')).rows.length,0);
  await f.owner();
  for(const permission of ['akademie.enrollments.assign','akademie.enrollments.review']) await f.db.query('INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,$3,false)',[id(10),id(40),permission]);
  await f.actor(21);assert.equal((await f.db.query("SELECT * FROM audit_logs WHERE table_name='course_enrollments'")).rows.length,0);
  await f.actor();
  await denied(f.db.query('SELECT * FROM academy_private.course_versions'));
  await denied(f.db.query('SELECT academy_private.learner($1)',[id(10)]));
  await denied(f.db.query('SELECT public.update_course_progress($1,100)',[(await f.load()).enrollments[0].id]));
  await f.owner(); const wrappers=(await f.db.query("SELECT proname,prosecdef,proconfig FROM pg_proc WHERE proname IN ('academy_workspace_load','academy_workspace_mutate')")).rows;
  assert.equal(wrappers.length,2);assert.ok(wrappers.every(x=>!x.prosecdef&&x.proconfig.includes('search_path=pg_catalog')));
 } finally {await f.db.close();}
});

test('actual SQL: server checks all quiz answers, immutable attempt limits, lesson membership, submitted state and CAS',async()=>{
 const f=await academyFixture();try {
  const c=await f.publish();await f.assign(c);await f.learner();let e=(await f.load('learner')).enrollments[0];
  await denied(own(f,'complete_lesson',e,{lessonId:'check'}),'22023');
  await denied(own(f,'complete_lesson',e,{lessonId:'other'}),'22023');
  await denied(own(f,'submit_quiz',e,{lessonId:'check',answers:{},score:100}),'22023');
  await denied(own(f,'submit_quiz',e,{lessonId:'check',answers:{unknown:'b'}}),'22023');
  await denied(own(f,'submit_quiz',e,{lessonId:'check',answers:{'question-1':'invalid'}}),'22023');
  await denied(own(f,'submit_enrollment',e),'55000');
  const request=randomUUID();await own(f,'complete_lesson',e,{lessonId:'reading'},{request});
  assert.equal((await own(f,'complete_lesson',e,{lessonId:'reading'},{request})).replayed,true);
  await denied(own(f,'submit_quiz',e,{lessonId:'check',answers:{'question-1':'b'}}),'40001');
  e=(await f.load('learner')).enrollments[0];
  for(let i=0;i<2;i++){const r=await own(f,'submit_quiz',e,{lessonId:'check',answers:{'question-1':'a'}});assert.equal(r.score,0);assert.equal(r.passed,false);e=(await f.load('learner')).enrollments[0];}
  assert.equal(e.attempts.length,2);assert.equal(e.progress,50);
  await denied(own(f,'submit_quiz',e,{lessonId:'check',answers:{'question-1':'b'}}),'55000');
  await denied(own(f,'submit_enrollment',e),'55000');
  await f.owner();await denied(f.db.query('DELETE FROM academy_private.quiz_attempts'),'55000');
 }finally{await f.db.close();}
});

test('actual SQL: draft edits cannot change assigned content; republish permits a separate version and archives preserve history',async()=>{
 const f=await academyFixture();try{
  let c=await f.publish();c=await f.assign(c);const old=(await f.load()).enrollments[0];
  c=await f.mutate('save_course',c.recordId,c.revision,{content:content({title:'Version two'})});
  await denied(f.assign(c,[{kind:'client',id:id(50)}]),'55000');
  assert.equal((await f.load()).enrollments[0].content.title,'Synthetischer Lernkurs');
  c=await f.mutate('publish_course',c.recordId,c.revision);c=await f.assign(c);
  const rows=(await f.load()).enrollments;assert.equal(rows.length,2);assert.deepEqual(rows.map(x=>x.versionNumber).sort(),[1,2]);
  assert.equal(rows.find(x=>x.id===old.id).content.title,'Synthetischer Lernkurs');
  c=await f.mutate('archive_course',c.recordId,c.revision);await denied(f.assign(c),'55000');
  await f.learner();assert.equal((await f.load('learner')).enrollments.length,2);
  await f.owner();await denied(f.db.query("UPDATE academy_private.course_versions SET content='{}'"),'55000');
 }finally{await f.db.close();}
});

test('actual SQL: portal identity, cross-tenant target, family/client separation, disabled accounts and revoked legacy sessions',async()=>{
 const f=await academyFixture();try{
  const c=await f.publish();await denied(f.assign(c,[{kind:'client',id:id(51)}]));
  await f.assign(c,[{kind:'employee',id:id(41)},{kind:'client',id:id(50)},{kind:'family',id:id(52)}]);
  await f.owner();await f.db.query('UPDATE client_contacts SET portal_enabled=false WHERE id=$1',[id(52)]);await f.actor();
  const office=await f.load(),client=office.enrollments.find(x=>x.participant.kind==='client');
  await f.learner('family');await denied(own(f,'start_enrollment',client));await denied(f.load('learner',11));
  await f.actor(31,10,{app_metadata:{portal_type:'client',portal_account_id:id(62)}});await denied(f.load('learner'));
  await f.actor(30,10,{app_metadata:{portal_type:'academy_family',portal_account_id:id(61)}});await denied(f.load('learner'));
  await f.owner();await f.db.query('UPDATE client_contacts SET portal_enabled=true WHERE id=$1',[id(52)]);
  await f.learner('relative');assert.equal((await f.load('learner')).enrollments[0].participant.kind,'family');
  await f.owner();await f.db.query('UPDATE portal_sessions SET revoked_at=now() WHERE id=$1',[id(64)]);await f.learner('relative');await denied(f.load('learner'));
  await f.learner('employee');const e=(await f.load('learner')).enrollments[0],request=randomUUID();await own(f,'start_enrollment',e,{}, {request});
  await f.owner();await f.db.query("UPDATE employee_portal_accounts SET status='disabled' WHERE id=$1",[id(60)]);await f.learner();await denied(own(f,'start_enrollment',e,{}, {request}));
  await f.owner();await f.db.query('UPDATE client_portal_access SET contact_id=NULL WHERE id=$1',[id(62)]);await f.learner('family');await denied(f.load('learner'));
  await f.owner();await f.db.query('UPDATE client_portal_access SET contact_id=$1,access_generation=2 WHERE id=$2',[id(52),id(62)]);await f.learner('family');await denied(f.load('learner'));
  await f.owner();await f.db.query("UPDATE clients SET status='inactive' WHERE id=$1",[id(50)]);await f.learner('client');await denied(f.load('learner'));
 }finally{await f.db.close();}
});

test('actual SQL: independent review, return with reason, cancellation and certificate revocation preserve evidence',async()=>{
 const f=await academyFixture();try{
  const c=await f.publish();await f.assign(c,[{kind:'employee',id:id(40)},{kind:'employee',id:id(41)}]);
  // Manager also learns via their verified active personnel link.
  await f.actor(21);let self=(await f.load('learner')).enrollments[0];
  await own(f,'complete_lesson',self,{lessonId:'reading'});self=(await f.load('learner')).enrollments[0];await own(f,'submit_quiz',self,{lessonId:'check',answers:{'question-1':'b'}});self=(await f.load('learner')).enrollments[0];await own(f,'submit_enrollment',self);self=(await f.load('learner')).enrollments[0];
  await denied(f.mutate('review_enrollment',self.id,self.revision,{decision:'approve',note:'',validUntil:null}));
  await f.actor();await denied(f.mutate('review_enrollment',self.id,self.revision,{decision:'return',note:'',validUntil:null}),'22023');
  await f.mutate('review_enrollment',self.id,self.revision,{decision:'return',note:'Bitte erneut prüfen',validUntil:null});
  await f.actor(21);self=(await f.load('learner')).enrollments[0];assert.equal(self.state,'returned');await own(f,'submit_enrollment',self);self=(await f.load('learner')).enrollments[0];
  await f.actor();const approval=await f.mutate('review_enrollment',self.id,self.revision,{decision:'approve',note:'Geprüft',validUntil:null});
  const request=randomUUID();await f.mutate('revoke_certificate',approval.certificateId,null,{note:'Synthetische Korrektur'},{request});
  assert.equal((await f.mutate('revoke_certificate',approval.certificateId,null,{note:'Synthetische Korrektur'},{request})).replayed,true);
  let ws=await f.load();assert.ok(ws.certificates[0].revokedAt);assert.equal(ws.enrollments.find(x=>x.id===self.id).state,'completed');
  const other=ws.enrollments.find(x=>x.participant.id===id(41));await f.mutate('cancel_enrollment',other.id,other.revision,{note:'Teilnahme entfällt'});
  await f.learner();const cancelled=(await f.load('learner')).enrollments[0];assert.equal(cancelled.state,'cancelled');await denied(own(f,'start_enrollment',cancelled),'55000');
  await f.owner();await denied(f.db.query("UPDATE academy_private.certificate_snapshots SET snapshot='{}'"),'55000');
 }finally{await f.db.close();}
});

test('actual SQL: publication rejects answer-key errors, duplicate question IDs and unsafe resources atomically',async()=>{
 const f=await academyFixture();try{
  for(const invalid of [
   content({lessons:[{id:'x',title:'x',kind:'video',body:'',url:'javascript:alert(1)'}]}),
   content({lessons:[{id:'x',title:'x',kind:'quiz',body:'',questions:[{id:'q',prompt:'?',options:[{id:'a',text:'A'},{id:'a',text:'B'}],correctOptionId:'a'}]}]}),
   content({lessons:[{id:'x',title:'x',kind:'quiz',body:'',questions:[{id:'q',prompt:'?',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'c'}]}]}),
  ]) await denied(f.mutate('save_course',randomUUID(),null,{content:invalid}),'22023');

  const incomplete=content({lessons:[{id:'empty',title:'',kind:'text',body:''},{id:'quiz',title:'',kind:'quiz',body:'',questions:[{id:'q',prompt:'',options:[]}]}]});
  const draft=await f.mutate('save_course',randomUUID(),null,{content:incomplete});
  assert.deepEqual((await f.load()).courses.find(x=>x.id===draft.recordId).content,incomplete);
  await denied(f.mutate('publish_course',draft.recordId,draft.revision),'22023');
  const saved=await f.mutate('save_course',randomUUID(),null,{content:content({lessons:[]})});
  await denied(f.mutate('publish_course',saved.recordId,saved.revision),'22023');
  assert.equal((await f.load()).courses[0].status,'draft');
 }finally{await f.db.close();}
});
