import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activateAcademyDraftScope, getPendingAcademyCommand, rememberPendingAcademyCommand } from '@/lib/akademie/workspaceDrafts';
import type { AcademyCommand, AcademyEnrollment, AcademyReusableTemplate, AcademyWorkspace } from '@/lib/akademie/workspaceModel';
import { createAcademyTemplate } from '@/lib/akademie/workspaceTemplates';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), authListener: undefined as undefined | ((event: string) => void), available: true }));
vi.mock('@/lib/supabase/client', () => {
  const client = { rpc: mock.rpc, auth: { onAuthStateChange: (listener: (event: string) => void) => {
    mock.authListener = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  } } };
  return { getSupabaseClient: () => mock.available ? client : null };
});
import { applyAcademyMutationReceipt, loadAcademyWorkspace, mutateAcademyWorkspace } from '@/lib/akademie/workspaceService';

const command: AcademyCommand = { action: 'start_enrollment', requestId: 'request-one', recordId: 'enrollment-one', expectedRevision: 1, data: {} };
const workspace: AcademyWorkspace = { schemaVersion: 1, viewer: { mode: 'learner', name: 'Persönlicher Zugang', audience: 'family' },
  capabilities: { learn: true, manageCourses: false, assign: false, review: false }, courses: [], participants: [], enrollments: [], certificates: [] };
const enrollment: AcademyEnrollment = { id: command.recordId!, courseId: 'course-one', versionId: 'version-one', versionNumber: 1, revision: 1,
  participant: { id: 'person-one', kind: 'family', name: 'Ada Beispiel', contextLabel: '', portalReady: true },
  dueDate: '2026-10-25', state: 'assigned', progress: 0, completedLessonIds: [], attempts: [], content: createAcademyTemplate('blank'),
  assignedAt: '2026-10-21T09:00:00Z', startedAt: null, submittedAt: null, completedAt: null, reviewNote: null, certificateId: null };

beforeEach(() => { mock.available = true; mock.rpc.mockReset(); });
afterEach(() => { vi.useRealTimers(); });
describe('Academy RPC boundary', () => {
  it('loads only the requested tenant and viewer context without a caller-selected person', async () => {
    mock.rpc.mockResolvedValue({ data: workspace, error: null });
    expect(await loadAcademyWorkspace('tenant-one', 'learner')).toEqual(workspace);
    expect(mock.rpc).toHaveBeenCalledWith('academy_workspace_load', { p_tenant: 'tenant-one', p_view: 'learner' });
  });
  it('rejects incomplete responses instead of showing an empty successful workspace', async () => {
    mock.rpc.mockResolvedValue({ data: { ...workspace, enrollments: [{ id: 'missing-required-content' }] }, error: null });
    await expect(loadAcademyWorkspace('tenant-one', 'learner')).rejects.toMatchObject({ code: 'invalid_response', uncertain: false });
  });
  it('rejects a response intended for a different viewer mode', async () => {
    mock.rpc.mockResolvedValue({ data: workspace, error: null });
    await expect(loadAcademyWorkspace('tenant-one', 'office')).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('sends the immutable request and revision, and accepts a confirmed receipt', async () => {
    mock.rpc.mockResolvedValue({ data: { recordId: command.recordId, revision: 2, replayed: true }, error: null });
    expect(await mutateAcademyWorkspace('tenant-one', 'learner', command)).toEqual({ recordId: command.recordId, revision: 2, replayed: true });
    expect(mock.rpc).toHaveBeenCalledWith('academy_workspace_mutate', {
      p_tenant: 'tenant-one', p_view: 'learner', p_action: command.action, p_request: command.requestId,
      p_record: command.recordId, p_revision: 1, p_data: {},
    });
  });
  it('classifies a stale revision as a definitive rejection', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'stale revision' } });
    await expect(mutateAcademyWorkspace('tenant-one', 'learner', command)).rejects.toMatchObject({ code: '40001', uncertain: false });
  });
  it('accepts validated planning history but rejects malformed links and events', async () => {
    const planned = { ...enrollment, previousEnrollmentId: null, nextEnrollmentId: null,
      dateChanges: [{ previousDueDate: null, dueDate: '2026-10-25', note: 'Termin abgestimmt', changedAt: '2026-10-21T09:00:00Z' }] };
    mock.rpc.mockResolvedValue({ data: { ...workspace, enrollments: [planned] }, error: null });
    expect((await loadAcademyWorkspace('tenant-one', 'learner')).enrollments[0].dateChanges).toHaveLength(1);
    for (const malformed of [{ ...planned, nextEnrollmentId: {} }, { ...planned, dateChanges: [{ ...planned.dateChanges[0], note: 42 }] }]) {
      mock.rpc.mockResolvedValue({ data: { ...workspace, enrollments: [malformed] }, error: null });
      await expect(loadAcademyWorkspace('tenant-one', 'learner')).rejects.toMatchObject({ code: 'invalid_response' });
    }
  });
  it('requires an unambiguous new enrollment identity for a renewal receipt', async () => {
    const renewal: AcademyCommand = { ...command, action: 'renew_enrollment', data: { dueDate: '2026-11-30', note: 'Jährliche Wiederholung', courseRevision: 4 } };
    const result = { recordId: command.recordId!, revision: 2, createdCount: 1, createdEnrollmentId: '9b72b214-71a1-4d9c-b778-70d4fb78d311' };
    mock.rpc.mockResolvedValue({ data: result, error: null });
    expect(await mutateAcademyWorkspace('tenant-one', 'office', renewal)).toEqual(result);
    const updated = applyAcademyMutationReceipt({ ...workspace, enrollments: [enrollment] }, renewal, result);
    expect(updated.enrollments[0]).toMatchObject({ revision: 2, nextEnrollmentId: result.createdEnrollmentId });
    expect(updated.enrollments).toHaveLength(1); // The new participation is loaded from the server, never fabricated.
    for (const malformed of [{ ...result, createdEnrollmentId: undefined }, { ...result, createdEnrollmentId: 'unknown' }, { ...result, createdCount: 0 }]) {
      mock.rpc.mockResolvedValue({ data: malformed, error: null });
      await expect(mutateAcademyWorkspace('tenant-one', 'office', renewal)).rejects.toMatchObject({ code: 'invalid_response', uncertain: true });
    }
  });
  it('advances a confirmed deadline without fabricating the server audit timestamp', () => {
    const deadline: AcademyCommand = { ...command, action: 'change_due_date', data: { dueDate: null, note: 'Frist aufgehoben' } };
    const updated = applyAcademyMutationReceipt({ ...workspace, enrollments: [enrollment] }, deadline, { recordId: enrollment.id, revision: 2 });
    expect(updated.enrollments[0]).toMatchObject({ dueDate: null, revision: 2 });
    expect(updated.enrollments[0].dateChanges).toBeUndefined();
    expect(enrollment.dueDate).toBe('2026-10-25');
  });
  it('accepts author templates only in an authorised office workspace and validates their structure', async () => {
    const template: AcademyReusableTemplate = { id: 'template-one', revision: 1, name: 'Einarbeitung', description: 'Eigene Vorlage',
      status: 'active', content: createAcademyTemplate('team'), updatedAt: '2026-10-21T12:00:00Z' };
    const authorWorkspace: AcademyWorkspace = { ...workspace, viewer: { mode: 'office', name: 'Kursredaktion', audience: null },
      capabilities: { manageCourses: true, assign: false, review: false, learn: false }, templates: [template] };
    mock.rpc.mockResolvedValue({ data: authorWorkspace, error: null });
    expect((await loadAcademyWorkspace('tenant-one', 'office')).templates).toEqual([template]);
    for (const forbidden of [{ ...workspace, templates: [template] },
      { ...authorWorkspace, capabilities: { ...authorWorkspace.capabilities, manageCourses: false } }]) {
      mock.rpc.mockResolvedValue({ data: forbidden, error: null });
      await expect(loadAcademyWorkspace('tenant-one', forbidden.viewer.mode)).rejects.toMatchObject({ code: 'invalid_response' });
    }
    mock.rpc.mockResolvedValue({ data: { ...authorWorkspace, templates: [{ ...template, status: 'published' }] }, error: null });
    await expect(loadAcademyWorkspace('tenant-one', 'office')).rejects.toMatchObject({ code: 'invalid_response' });
    const archived = applyAcademyMutationReceipt(authorWorkspace, { action: 'archive_template', requestId: 'request', recordId: template.id, expectedRevision: 1, data: {} }, { recordId: template.id, revision: 2 });
    expect(archived.templates![0]).toMatchObject({ status: 'archived', revision: 2 });
    expect(archived.courses).toEqual(authorWorkspace.courses);
  });
  it('keeps connection failures and empty acknowledgements uncertain', async () => {
    mock.rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(mutateAcademyWorkspace('tenant-one', 'learner', command)).rejects.toMatchObject({ code: 'transport', uncertain: true });
    mock.rpc.mockResolvedValue({ data: null, error: null });
    await expect(mutateAcademyWorkspace('tenant-one', 'learner', command)).rejects.toMatchObject({ code: 'invalid_response', uncertain: true });
    mock.rpc.mockResolvedValue({ data: { recordId: command.recordId, revision: '2' }, error: null });
    await expect(mutateAcademyWorkspace('tenant-one', 'learner', command)).rejects.toMatchObject({ code: 'invalid_response', uncertain: true });
    mock.rpc.mockResolvedValue({ data: { recordId: 'different-enrollment', revision: 2 }, error: null });
    await expect(mutateAcademyWorkspace('tenant-one', 'learner', command)).rejects.toMatchObject({ code: 'invalid_response', uncertain: true });
    mock.rpc.mockResolvedValue({ data: null, error: { code: '08007', message: 'transaction resolution unknown' } });
    await expect(mutateAcademyWorkspace('tenant-one', 'learner', command)).rejects.toMatchObject({ code: '08007', uncertain: true });
  });
  it('times out without treating an in-flight save as a definite failure', async () => {
    vi.useFakeTimers();
    mock.rpc.mockReturnValue(new Promise(() => undefined));
    const result = expect(mutateAcademyWorkspace('tenant-one', 'learner', command)).rejects.toMatchObject({ code: 'timeout', uncertain: true });
    await vi.advanceTimersByTimeAsync(20001);
    await result;
  });
  it('does not invent demo data or a write attempt without a connection', async () => {
    mock.available = false;
    await expect(mutateAcademyWorkspace('tenant-one', 'learner', command)).rejects.toMatchObject({ code: 'unavailable', uncertain: false });
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('clears pending payloads on sign-out', async () => {
    mock.rpc.mockResolvedValue({ data: workspace, error: null });
    await loadAcademyWorkspace('tenant-one', 'learner');
    activateAcademyDraftScope('tenant-one:user-one:family-one:learner');
    rememberPendingAcademyCommand('tenant-one:user-one:family-one:learner', command);
    mock.authListener?.('SIGNED_OUT');
    expect(getPendingAcademyCommand('tenant-one:user-one:family-one:learner')).toBeNull();
  });
});
