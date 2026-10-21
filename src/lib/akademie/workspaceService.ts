import { getSupabaseClient } from '@/lib/supabase/client';
import { clearAcademyDrafts } from './workspaceDrafts';
import type { AcademyCommand, AcademyMutationResult, AcademyView, AcademyWorkspace } from './workspaceModel';

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
type WorkspaceRpc = { rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult> };
export class AcademyWorkspaceError extends Error {
  constructor(message: string, public readonly code = 'unknown', public readonly uncertain = false) {
    super(message);
    this.name = 'AcademyWorkspaceError';
  }
}

function explain(code: string | undefined, message: string): string {
  if (code === '40001') return 'Dieser Eintrag wurde inzwischen geändert. Bitte den aktuellen Stand laden und Ihre Eingaben abgleichen.';
  if (code === '42501') return 'Für diesen Vorgang fehlt die Berechtigung oder der persönliche Zugang ist nicht mehr gültig.';
  if (['PGRST202', '42883', '42P01'].includes(code ?? '')) return 'Die Akademie ist auf diesem Server noch nicht eingerichtet. Bitte wenden Sie sich an die Verwaltung.';
  if (['23514', 'P0001', '22023', '23505', '55000'].includes(code ?? '')) return message;
  return 'Der Vorgang wurde vom Server abgelehnt. Bitte den aktuellen Stand laden und erneut versuchen.';
}

let observedClient: ReturnType<typeof getSupabaseClient> = null;
let unsubscribe: (() => void) | undefined;
async function call(name: string, args: Record<string, unknown>, mutation: boolean): Promise<unknown> {
  const client = getSupabaseClient();
  if (!client) throw new AcademyWorkspaceError('Die Verbindung zur Akademie ist nicht eingerichtet.', 'unavailable');
  if (observedClient !== client) {
    unsubscribe?.();
    observedClient = client;
    const subscription = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') clearAcademyDrafts();
    });
    unsubscribe = () => subscription.data.subscription.unsubscribe();
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let result: RpcResult;
  try {
    result = await Promise.race([
      (client as unknown as WorkspaceRpc).rpc(name, args),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AcademyWorkspaceError(
          mutation
            ? 'Die Übertragung ist noch nicht bestätigt. Wiederholen Sie denselben Vorgang, um seinen Status sicher zu prüfen.'
            : 'Die Akademie antwortet noch nicht. Bitte erneut laden.',
          'timeout', mutation,
        )), 20000);
      }),
    ]);
  } catch (error) {
    if (error instanceof AcademyWorkspaceError) throw error;
    throw new AcademyWorkspaceError(
      mutation ? 'Die Übertragung konnte nicht bestätigt werden. Bitte denselben Vorgang erneut versuchen.'
        : 'Die Akademie konnte nicht geladen werden. Bitte die Verbindung prüfen und erneut laden.',
      'transport', mutation,
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (result.error) {
    // An SQL/PostgREST error is a definitive rejection. A transport response without
    // an error code may follow a committed write and must retain the exact request.
    const uncertain = mutation && (!result.error.code || result.error.code.startsWith('08') || result.error.code === '40003');
    throw new AcademyWorkspaceError(uncertain
      ? 'Die Übertragung konnte nicht bestätigt werden. Bitte denselben Vorgang erneut versuchen.'
      : explain(result.error.code, result.error.message), result.error.code ?? 'transport', uncertain);
  }
  if (result.data == null) throw new AcademyWorkspaceError(
    'Der Server hat keinen gültigen Stand bestätigt. Bitte erneut versuchen.', 'invalid_response', mutation,
  );
  return result.data;
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const string = (value: unknown): value is string => typeof value === 'string';
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nullableString = (value: unknown) => value === null || string(value);
const audience = (value: unknown) => ['employee', 'client', 'family'].includes(value as string);
function content(value: unknown): boolean {
  return object(value) && string(value.title) && string(value.summary) && string(value.category)
    && Array.isArray(value.audiences) && value.audiences.every(audience)
    && finite(value.estimatedMinutes) && typeof value.mandatory === 'boolean'
    && finite(value.passPercent) && finite(value.maxAttempts) && Array.isArray(value.lessons)
    && value.lessons.every(lesson => object(lesson) && string(lesson.id) && string(lesson.title)
      && string(lesson.body) && ['text', 'video', 'document', 'quiz'].includes(lesson.kind as string)
      && (lesson.url === undefined || string(lesson.url))
      && (lesson.questions === undefined || (Array.isArray(lesson.questions) && lesson.questions.every(question =>
        object(question) && string(question.id) && string(question.prompt)
        && (question.correctOptionId === undefined || string(question.correctOptionId))
        && Array.isArray(question.options) && question.options.every(option =>
          object(option) && string(option.id) && string(option.text))))));
}
function participant(value: unknown): boolean {
  return object(value) && string(value.id) && audience(value.kind) && string(value.name)
    && string(value.contextLabel) && typeof value.portalReady === 'boolean';
}
function validWorkspace(value: unknown, view: AcademyView): value is AcademyWorkspace {
  if (!object(value) || value.schemaVersion !== 1 || !object(value.viewer)
    || value.viewer.mode !== view || !string(value.viewer.name)
    || !(value.viewer.audience === null || audience(value.viewer.audience))
    || !object(value.capabilities) || !['manageCourses', 'assign', 'review', 'learn']
      .every(key => typeof (value.capabilities as Record<string, unknown>)[key] === 'boolean')) return false;
  return (value.templates === undefined || (Array.isArray(value.templates)
    && ((view === 'office' && value.capabilities.manageCourses === true) || value.templates.length === 0)
    && value.templates.every(template => object(template) && string(template.id)
      && Number.isInteger(template.revision) && (template.revision as number) > 0
      && string(template.name) && string(template.description) && string(template.updatedAt)
      && ['active', 'archived'].includes(template.status as string) && content(template.content))))
    && Array.isArray(value.courses) && value.courses.every(course => object(course)
    && string(course.id) && finite(course.revision) && finite(course.versionNumber)
    && ['draft', 'published', 'archived'].includes(course.status as string)
    && nullableString(course.publishedVersionId) && string(course.updatedAt) && content(course.content))
    && Array.isArray(value.participants) && value.participants.every(participant)
    && Array.isArray(value.enrollments) && value.enrollments.every(enrollment => object(enrollment)
      && ['id', 'courseId', 'versionId', 'assignedAt'].every(key => string(enrollment[key]))
      && ['versionNumber', 'revision', 'progress'].every(key => finite(enrollment[key]))
      && ['dueDate', 'startedAt', 'submittedAt', 'completedAt', 'reviewNote', 'certificateId'].every(key => nullableString(enrollment[key]))
      && ['previousEnrollmentId', 'nextEnrollmentId'].every(key => enrollment[key] === undefined || nullableString(enrollment[key]))
      && (enrollment.dateChanges === undefined || (Array.isArray(enrollment.dateChanges) && enrollment.dateChanges.every(change =>
        object(change) && nullableString(change.previousDueDate) && nullableString(change.dueDate)
        && string(change.note) && string(change.changedAt))))
      && ['assigned', 'in_progress', 'submitted', 'completed', 'returned', 'cancelled'].includes(enrollment.state as string)
      && participant(enrollment.participant) && content(enrollment.content)
      && Array.isArray(enrollment.completedLessonIds) && enrollment.completedLessonIds.every(string)
      && Array.isArray(enrollment.attempts) && enrollment.attempts.every(attempt => object(attempt)
        && string(attempt.lessonId) && finite(attempt.attempt) && finite(attempt.score)
        && typeof attempt.passed === 'boolean' && string(attempt.submittedAt)))
    && Array.isArray(value.certificates) && value.certificates.every(certificate => object(certificate)
      && ['id', 'enrollmentId', 'number', 'courseTitle', 'participantName', 'issuedAt', 'issuerName', 'organizationName'].every(key => string(certificate[key]))
      && ['validUntil', 'revokedAt', 'revokedReason'].every(key => nullableString(certificate[key]))
      && audience(certificate.audience) && finite(certificate.versionNumber) && finite(certificate.estimatedMinutes));
}

export async function loadAcademyWorkspace(tenantId: string, view: AcademyView): Promise<AcademyWorkspace> {
  const result = await call('academy_workspace_load', { p_tenant: tenantId, p_view: view }, false);
  if (!validWorkspace(result, view)) throw new AcademyWorkspaceError(
    'Der Server hat eine unvollständige Akademie-Ansicht geliefert. Bitte erneut laden.', 'invalid_response',
  );
  return result;
}
export async function mutateAcademyWorkspace(tenantId: string, view: AcademyView, command: AcademyCommand): Promise<AcademyMutationResult> {
  const result = await call('academy_workspace_mutate', {
    p_tenant: tenantId, p_view: view, p_action: command.action, p_request: command.requestId,
    p_record: command.recordId, p_revision: command.expectedRevision, p_data: command.data,
  }, true);
  if (!object(result) || !string(result.recordId) || result.recordId !== command.recordId || !Number.isInteger(result.revision)
    || (result.revision as number) < 0
    || (result.score !== undefined && (!finite(result.score) || result.score < 0 || result.score > 100))
    || (result.passed !== undefined && typeof result.passed !== 'boolean')
    || (result.replayed !== undefined && typeof result.replayed !== 'boolean')
    || (result.createdEnrollmentId !== undefined && (!string(result.createdEnrollmentId)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.createdEnrollmentId)
      || result.createdEnrollmentId === command.recordId))
    || (command.action === 'renew_enrollment' && (result.createdEnrollmentId === undefined || result.createdCount !== 1))
    || (result.createdCount !== undefined && (!Number.isInteger(result.createdCount) || (result.createdCount as number) < 0))) {
    throw new AcademyWorkspaceError('Die Speicherung wurde nicht eindeutig bestätigt. Bitte denselben Vorgang erneut versuchen.', 'invalid_response', true);
  }
  return result as AcademyMutationResult;
}

/** Advance only acknowledged fields. A failed reload still blocks further editing. */
export function applyAcademyMutationReceipt(workspace: AcademyWorkspace, command: AcademyCommand, result: AcademyMutationResult): AcademyWorkspace {
  if (command.recordId !== result.recordId) return workspace;
  if (['save_template', 'archive_template', 'restore_template'].includes(command.action)) {
    return { ...workspace, templates: (workspace.templates ?? []).map(template => template.id !== result.recordId ? template : {
      ...template, revision: result.revision,
      ...(command.action === 'archive_template' ? { status: 'archived' as const } : {}),
      ...(command.action === 'restore_template' ? { status: 'active' as const } : {}),
    }) };
  }
  if (['save_course', 'publish_course', 'archive_course'].includes(command.action)) {
    return { ...workspace, courses: workspace.courses.map(course => course.id !== result.recordId ? course : {
      ...course, revision: result.revision,
      ...(command.action === 'archive_course' ? { status: 'archived' as const } : {}),
    }) };
  }
  return { ...workspace, enrollments: workspace.enrollments.map(enrollment => enrollment.id !== result.recordId ? enrollment : {
    ...enrollment, revision: result.revision,
    ...(command.action === 'change_due_date' && (command.data.dueDate === null || string(command.data.dueDate))
      ? { dueDate: command.data.dueDate } : {}),
    ...(command.action === 'renew_enrollment' && result.createdEnrollmentId
      ? { nextEnrollmentId: result.createdEnrollmentId } : {}),
  }) };
}
