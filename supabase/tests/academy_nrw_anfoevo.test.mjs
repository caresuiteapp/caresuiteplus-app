import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { academyFixture, id } from './academy_workspace_fixture.mjs';

const migration = readFileSync(new URL('../migrations/20261110141500_academy_nrw_anfoevo.sql', import.meta.url), 'utf8');
const denied = (promise, code) => assert.rejects(promise, error => error.code === code);

test('NRW mandatory course, resumable examination, restricted review and immutable Klarblatt certificate', async () => {
  const f = await academyFixture();
  try {
    await f.owner();
    await f.db.exec(migration);
    await f.db.query("INSERT INTO employee_portal_accounts VALUES($1,$2,$3,$4,'active')", [id(65), id(10), id(40), id(121)]);
    await f.db.exec("ALTER TABLE employees ADD COLUMN personnel_number text");
    await f.db.query("UPDATE employees SET personnel_number='M-042' WHERE id=$1", [id(41)]);
    const source = (await f.db.query('SELECT academy_private.nrw_content() AS content')).rows[0].content;
    const key = new Map(source.lessons.flatMap(lesson => lesson.questions ?? []).map(q => [q.id, q.correctOptionId]));
    await f.actor();
    const courseId = (await f.load()).nrwCourseId;
    const request = randomUUID();
    const installed = await f.mutate('install_nrw_course', courseId, null, {}, { request });
    assert.equal((await f.mutate('install_nrw_course', courseId, null, {}, { request })).replayed, true);
    const draft = (await f.load()).courses.find(course => course.id === courseId);
    assert.equal(draft.status, 'draft');
    assert.equal(draft.content.estimatedMinutes, 1800);
    assert.equal(draft.content.lessons.filter(l => /-ue\d$/.test(l.id)).length, 40);
    assert.equal(draft.content.lessons.filter(l => l.id.endsWith('-case')).length, 8);
    assert.equal(draft.content.lessons.some(l => l.kind === 'video'), false);
    assert.equal(draft.content.mandatory, true);
    assert.equal(JSON.stringify(draft).includes('correctOptionId'), false);
    await denied(f.db.query('SELECT academy_private.nrw_content()'), '42501');
    await denied(f.db.query('SELECT * FROM academy_private.nrw_exam_drafts'), '42501');
    await denied(f.mutate('save_course', courseId, installed.revision, { content: source }), '42501');
    const published = await f.mutate('publish_course', courseId, installed.revision);
    const assignment = await f.assign(published, [{ kind: 'employee', id: id(40) }, { kind: 'employee', id: id(41) }]);
    assert.equal(assignment.createdCount, 2);
    await f.learner('client');
    assert.deepEqual((await f.load('learner')).enrollments, []);
    await f.learner();
    const loadOwn = async () => {
      const ws = await f.load('learner');
      assert.equal(ws.enrollments.length, 1);
      assert.equal(JSON.stringify(ws).includes('correctOptionId'), false);
      return ws.enrollments[0];
    };
    let e = await loadOwn();
    const eId = e.id;
    let revision = e.revision;
    const own = (action, data = {}, options = {}) => f.mutate(action, eId, revision, data, { view: 'learner', ...options });
    const finalQuestions = enrollment => enrollment.content.lessons.find(l => l.id === 'nrw-final').questions;
    revision = (await own('start_enrollment')).revision;
    await denied(own('submit_quiz', { lessonId: 'nrw-final' }), '55000');
    await denied(own('complete_lesson', { lessonId: 'nrw-final' }), '22023');
    for (const lesson of e.content.lessons.filter(l => l.id !== 'nrw-final')) {
      const result = lesson.kind === 'quiz'
        ? await own('submit_quiz', { lessonId: lesson.id, answers: Object.fromEntries(lesson.questions.map(q => [q.id, key.get(q.id)])) })
        : await own('complete_lesson', { lessonId: lesson.id });
      revision = result.revision;
    }
    e = await loadOwn();
    assert.equal(e.completedLessonIds.length, 56);
    const drawn = finalQuestions(e);
    assert.equal(drawn.length, 16);
    const chapters = new Map();
    for (const q of drawn) {
      const chapter = q.id.slice(0, 6);
      chapters.set(chapter, (chapters.get(chapter) ?? 0) + 1);
    }
    assert.deepEqual([...chapters.values()], [2,2,2,2,2,2,2,2]);
    assert.deepEqual(finalQuestions(await loadOwn()), drawn);
    const chosen = drawn[0].options.find(o => o.id !== key.get(drawn[0].id));
    const saveRequest = randomUUID();
    const data = { questionId: drawn[0].id, optionId: chosen.id };
    await denied(own('save_nrw_exam_answer', { ...data, optionId: 'invalid' }), '22023');
    const saved = await own('save_nrw_exam_answer', data, { request: saveRequest });
    assert.equal((await own('save_nrw_exam_answer', data, { request: saveRequest })).replayed, true);
    revision = saved.revision;
    assert.equal((await loadOwn()).nrwExam.draftAnswers[drawn[0].id], chosen.id);
    await denied(own('submit_quiz', { lessonId: 'nrw-final' }), '22023');
    for (const q of drawn.slice(1)) {
      revision = (await own('save_nrw_exam_answer', { questionId: q.id, optionId: q.options.find(o => o.id !== key.get(q.id)).id })).revision;
    }
    const failed = await own('submit_quiz', { lessonId: 'nrw-final' });
    revision = failed.revision;
    assert.equal(failed.passed, false);
    assert.equal((await loadOwn()).nrwExam.state, 'failed');
    await denied(own('unlock_nrw_exam', { note: 'Selbstfreigabe' }), '42501');
    await denied(own('submit_quiz', { lessonId: 'nrw-final' }), '55000');
    await f.actor();
    e = (await f.load()).enrollments.find(x => x.id === eId);
    assert.equal(e.nrwExam.mistakes.length, 16);
    assert.equal(Object.keys(e.nrwExam.draftAnswers).length, 0);
    const unlocked = await f.mutate('unlock_nrw_exam', eId, revision, { note: 'Wiederholung nach Nachbesprechung' });
    await denied(f.mutate('unlock_nrw_exam', eId, unlocked.revision, { note: 'Zweite parallele Freigabe' }), '55000');
    revision = unlocked.revision;
    await f.learner();
    e = await loadOwn();
    assert.equal(e.nrwExam.state, 'ready');
    assert.equal(e.nrwExam.attemptLimit, 2);
    assert.equal(e.completedLessonIds.length, 56);
    for (const [index, q] of finalQuestions(e).entries()) {
      const optionId = index < 12 ? key.get(q.id) : q.options.find(o => o.id !== key.get(q.id)).id;
      revision = (await own('save_nrw_exam_answer', { questionId: q.id, optionId })).revision;
    }
    const passed = await own('submit_quiz', { lessonId: 'nrw-final' });
    revision = passed.revision;
    assert.equal(passed.passed, true);
    assert.equal(passed.score, 75);
    e = await loadOwn();
    assert.equal(e.progress, 100);
    assert.equal(e.state, 'submitted');
    assert.equal(e.certificateId, null);
    await f.actor();
    const approval = { decision: 'approve', note: 'Geeignete Vermittlung und Lernumfang fachlich geprüft', nrwConfirmed: true };
    await denied(f.mutate('review_enrollment', eId, revision, { decision: 'approve', note: approval.note }), '22023');
    await denied(f.mutate('review_enrollment', eId, revision, approval), '55000');
    const date = (await f.db.query('SELECT current_date::text date')).rows[0].date;
    const evidence = { kind: 'first_aid', date, provider: 'Synthetische Kursstelle', reference: 'Testakte 42' };
    await denied(f.mutate('record_nrw_practice', eId, revision, { ...evidence, date: '2000-01-01' }), '22023');
    revision = (await f.mutate('record_nrw_practice', eId, revision, evidence)).revision;
    const certified = await f.mutate('review_enrollment', eId, revision, approval);
    assert.ok(certified.certificateId);
    const office = await f.load();
    assert.equal(office.enrollments.find(x => x.id === eId).nrwExam.mistakes.length, 20);
    const c = office.certificates.find(x => x.id === certified.certificateId);
    assert.equal(c.qualification.template, 'klarblatt');
    assert.equal(c.qualification.examScore, 75);
    assert.equal(c.qualification.practiceKind, 'first_aid');
    assert.equal(c.qualification.practiceDate, date);
    assert.equal(c.qualification.personnelNumber, 'M-042');
    await f.learner();
    const learner = await f.load('learner');
    assert.deepEqual(learner.certificates[0], c);
    assert.deepEqual(learner.enrollments[0].nrwExam.mistakes, []);
    assert.equal(JSON.stringify(learner).includes('Testakte 42'), false);
    await denied(f.db.query("SELECT academy_private.workspace_mutate_before_nrw($1,'learner','submit_enrollment',$2,$3,$4,'{}')", [id(10), randomUUID(), eId, revision]), '42501');
  } finally { await f.db.close(); }
});
