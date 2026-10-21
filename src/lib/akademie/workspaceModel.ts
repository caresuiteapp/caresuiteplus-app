/** Contract shared by the academy Web workspace and its authorised RPCs. */
export type AcademyAudience = 'employee' | 'client' | 'family';
export type AcademyView = 'office' | 'learner';
export type AcademySection = 'overview' | 'courses' | 'templates' | 'assignments' | 'planning' | 'reports' | 'reviews' | 'certificates' | 'library';
export type AcademyLessonKind = 'text' | 'video' | 'document' | 'quiz';
export type AcademyQuestion = {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  /** Authoring only. The server never returns the answer key to learners. */
  correctOptionId?: string;
};
export type AcademyLesson = {
  id: string;
  title: string;
  kind: AcademyLessonKind;
  body: string;
  url?: string;
  questions?: AcademyQuestion[];
};
export type AcademyContent = {
  title: string;
  summary: string;
  category: string;
  audiences: AcademyAudience[];
  estimatedMinutes: number;
  mandatory: boolean;
  passPercent: number;
  maxAttempts: number;
  lessons: AcademyLesson[];
};
export type AcademyCourse = {
  id: string;
  revision: number;
  status: 'draft' | 'published' | 'archived';
  publishedVersionId: string | null;
  versionNumber: number;
  content: AcademyContent;
  updatedAt: string;
};
export type AcademyReusableTemplate = {
  id: string;
  revision: number;
  name: string;
  description: string;
  status: 'active' | 'archived';
  content: AcademyContent;
  updatedAt: string;
};
export type AcademyParticipant = {
  id: string;
  kind: AcademyAudience;
  name: string;
  contextLabel: string;
  clientId?: string | null;
  portalReady: boolean;
};
export type AcademyAttempt = {
  lessonId: string;
  attempt: number;
  score: number;
  passed: boolean;
  submittedAt: string;
};
export type AcademyEnrollmentState = 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'returned' | 'cancelled';
export type AcademyDateChange = {
  previousDueDate: string | null;
  dueDate: string | null;
  note: string;
  changedAt: string;
};
export type AcademyEnrollment = {
  id: string;
  courseId: string;
  versionId: string;
  versionNumber: number;
  revision: number;
  participant: AcademyParticipant;
  dueDate: string | null;
  state: AcademyEnrollmentState;
  progress: number;
  completedLessonIds: string[];
  attempts: AcademyAttempt[];
  content: AcademyContent;
  assignedAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  reviewNote: string | null;
  certificateId: string | null;
  /** Additive fields: older responses remain readable during the coordinated rollout. */
  previousEnrollmentId?: string | null;
  nextEnrollmentId?: string | null;
  dateChanges?: AcademyDateChange[];
};
export type AcademyCertificate = {
  id: string;
  enrollmentId: string;
  number: string;
  courseTitle: string;
  participantName: string;
  audience: AcademyAudience;
  issuedAt: string;
  validUntil: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  issuerName: string;
  organizationName: string;
  versionNumber: number;
  estimatedMinutes: number;
};
export type AcademyWorkspace = {
  schemaVersion: 1;
  viewer: { mode: AcademyView; name: string; audience: AcademyAudience | null };
  capabilities: { manageCourses: boolean; assign: boolean; review: boolean; learn: boolean };
  courses: AcademyCourse[];
  participants: AcademyParticipant[];
  enrollments: AcademyEnrollment[];
  certificates: AcademyCertificate[];
  /** Authoring-only content, including answer keys. Never returned to learners. */
  templates?: AcademyReusableTemplate[];
};
export type AcademyAction = 'save_course' | 'publish_course' | 'archive_course' | 'assign'
  | 'start_enrollment' | 'complete_lesson' | 'submit_quiz' | 'submit_enrollment'
  | 'review_enrollment' | 'cancel_enrollment' | 'revoke_certificate'
  | 'change_due_date' | 'renew_enrollment' | 'save_template' | 'archive_template' | 'restore_template';
export type AcademyCommand = {
  action: AcademyAction;
  requestId: string;
  recordId: string | null;
  expectedRevision: number | null;
  data: Record<string, unknown>;
};
export type AcademyMutationResult = {
  recordId: string;
  revision: number;
  replayed?: boolean;
  createdCount?: number;
  score?: number;
  passed?: boolean;
  certificateId?: string;
  createdEnrollmentId?: string;
};
export type AcademyCommandHandler = (
  action: AcademyAction,
  data: Record<string, unknown>,
  record?: { id: string; revision: number | null } | null,
) => Promise<AcademyMutationResult | null>;

export const ACADEMY_AUDIENCE_LABELS: Record<AcademyAudience, string> = {
  employee: 'Mitarbeitende', client: 'Klient:innen', family: 'Angehörige',
};
export const ACADEMY_STATE_LABELS: Record<AcademyEnrollmentState, string> = {
  assigned: 'Zugewiesen', in_progress: 'In Bearbeitung', submitted: 'Zur Prüfung',
  completed: 'Abgeschlossen', returned: 'Zur Überarbeitung', cancelled: 'Beendet',
};
export function isAcademyOverdue(enrollment: AcademyEnrollment, today = new Date().toLocaleDateString('sv-SE')): boolean {
  return Boolean(enrollment.dueDate && enrollment.dueDate.slice(0, 10) < today
    && !['completed', 'cancelled', 'submitted'].includes(enrollment.state));
}
export function academySafeResourceUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
