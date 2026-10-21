import { expect, it, vi } from 'vitest';
import { academyFixture, id } from '../../../supabase/tests/academy_workspace_fixture.mjs';
import type { AcademyCommand } from '@/lib/akademie/workspaceModel';
import { createAcademyTemplate } from '@/lib/akademie/workspaceTemplates';
import { cloneAcademyContent } from '@/lib/akademie/workspaceAuthoring';

const rpc = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/lib/supabase/client', () => {
  const client = { rpc: rpc.invoke, auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
  return { getSupabaseClient: () => client };
});
import { loadAcademyWorkspace, mutateAcademyWorkspace } from '@/lib/akademie/workspaceService';

it('accepts real SQL course, enrollment, quiz and certificate responses through the application boundary', async () => {
  const fixture = await academyFixture();
  try {
    rpc.invoke.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      try {
        const result = name === 'academy_workspace_load'
          ? await fixture.db.query('SELECT public.academy_workspace_load($1,$2) r', [args.p_tenant, args.p_view])
          : await fixture.db.query('SELECT public.academy_workspace_mutate($1,$2,$3,$4,$5,$6,$7) r', [args.p_tenant, args.p_view,
            args.p_action, args.p_request, args.p_record, args.p_revision, JSON.stringify(args.p_data)]);
        return { data: (result.rows[0] as { r: unknown }).r, error: null };
      } catch (error) {
        return { data: null, error: error as { code: string; message: string } };
      }
    });
    await fixture.actor();
    const templateId = crypto.randomUUID();
    const templateContent = createAcademyTemplate('workshop');
    await mutateAcademyWorkspace(id(10), 'office', { action: 'save_template', requestId: crypto.randomUUID(),
      recordId: templateId, expectedRevision: null, data: { name: 'Eigene Schulungsstruktur', description: 'Anpassbare Vorlage', content: templateContent } });
    const templateWorkspace = await loadAcademyWorkspace(id(10), 'office');
    expect(templateWorkspace.templates![0]).toMatchObject({ id: templateId, status: 'active', revision: 1 });
    expect(templateWorkspace.templates![0].content.lessons[2].questions![0].correctOptionId).toBeTruthy();
    const copiedContent = cloneAcademyContent(templateWorkspace.templates![0].content);
    const copiedCourseId = crypto.randomUUID();
    await mutateAcademyWorkspace(id(10), 'office', { action: 'save_course', requestId: crypto.randomUUID(), recordId: copiedCourseId,
      expectedRevision: null, data: { content: { ...copiedContent, title: 'Eigenständige Kurskopie' } } });
    await mutateAcademyWorkspace(id(10), 'office', { action: 'archive_template', requestId: crypto.randomUUID(), recordId: templateId, expectedRevision: 1, data: {} });
    const copied = await loadAcademyWorkspace(id(10), 'office');
    expect(copied.templates![0].status).toBe('archived');
    expect(copied.courses.find(entry => entry.id === copiedCourseId)?.content.title).toBe('Eigenständige Kurskopie');
    const course = await fixture.publish();
    await fixture.assign(course, [{ kind: 'employee', id: id(41) }, { kind: 'client', id: id(50) }, { kind: 'family', id: id(52) }]);
    const office = await loadAcademyWorkspace(id(10), 'office');
    expect(office.courses.find(entry => entry.id === course.recordId)!.content.lessons).toHaveLength(2);
    expect(office.enrollments).toHaveLength(3);
    for (const kind of ['employee', 'client', 'family']) {
      await fixture.learner(kind);
      const learner = await loadAcademyWorkspace(id(10), 'learner');
      expect(learner.templates).toEqual([]);
      expect(learner.viewer.audience).toBe(kind);
      expect(learner.enrollments[0].content.lessons[1].questions![0].correctOptionId).toBeUndefined();
    }
    let learner = await loadAcademyWorkspace(id(10), 'learner');
    const send = async (action: AcademyCommand['action'], data: Record<string, unknown>) => {
      const enrollment = learner.enrollments[0];
      await mutateAcademyWorkspace(id(10), 'learner', { action, data, requestId: crypto.randomUUID(), recordId: enrollment.id, expectedRevision: enrollment.revision });
      learner = await loadAcademyWorkspace(id(10), 'learner');
    };
    await send('complete_lesson', { lessonId: 'reading' });
    await send('submit_quiz', { lessonId: 'check', answers: { 'question-1': 'b' } });
    expect(learner.enrollments[0].attempts[0]).toMatchObject({ score: 100, passed: true });
    await send('submit_enrollment', {});
    await fixture.actor();
    const enrollment = learner.enrollments[0];
    await mutateAcademyWorkspace(id(10), 'office', { action: 'review_enrollment', data: { decision: 'approve', note: 'Geprüft', validUntil: null },
      requestId: crypto.randomUUID(), recordId: enrollment.id, expectedRevision: enrollment.revision });
    await fixture.learner('family');
    learner = await loadAcademyWorkspace(id(10), 'learner');
    expect(learner.certificates[0]).toMatchObject({ audience: 'family', participantName: 'Family One', revokedAt: null, versionNumber: 1 });
    const originalProof = structuredClone(learner.certificates[0]);
    const completed = learner.enrollments[0];
    await fixture.actor();
    const latestOffice = await loadAcademyWorkspace(id(10), 'office');
    const renewed = await mutateAcademyWorkspace(id(10), 'office', { action: 'renew_enrollment',
      data: { dueDate: '2027-01-31', note: 'Erneute Schulung vereinbart', courseRevision: latestOffice.courses.find(entry => entry.id === completed.courseId)!.revision },
      requestId: crypto.randomUUID(), recordId: completed.id, expectedRevision: completed.revision });
    expect(renewed.createdEnrollmentId).toBeTruthy();
    const newEnrollment = (await loadAcademyWorkspace(id(10), 'office')).enrollments.find(entry => entry.id === renewed.createdEnrollmentId)!;
    await mutateAcademyWorkspace(id(10), 'office', { action: 'change_due_date',
      data: { dueDate: '2027-02-28', note: 'Neue Frist mit der Person abgestimmt' },
      requestId: crypto.randomUUID(), recordId: newEnrollment.id, expectedRevision: newEnrollment.revision });
    await fixture.learner('family');
    learner = await loadAcademyWorkspace(id(10), 'learner');
    expect(learner.enrollments).toHaveLength(2);
    expect(learner.certificates).toEqual([originalProof]);
    expect(learner.enrollments.find(entry => entry.id === completed.id)).toMatchObject({ state: 'completed', progress: 100, nextEnrollmentId: newEnrollment.id });
    expect(learner.enrollments.find(entry => entry.id === newEnrollment.id)).toMatchObject({ previousEnrollmentId: completed.id,
      progress: 0, attempts: [], completedLessonIds: [], dueDate: '2027-02-28',
      dateChanges: [{ previousDueDate: '2027-01-31', dueDate: '2027-02-28', note: 'Neue Frist mit der Person abgestimmt' }] });
  } finally { await fixture.db.close(); }
}, 30000);
