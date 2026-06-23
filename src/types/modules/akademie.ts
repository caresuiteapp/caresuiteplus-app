import type { TenantScopedEntity, WorkflowStatus } from '../core/base';

export type Course = TenantScopedEntity & {
  title: string;
  description: string | null;
  category: string;
  durationMinutes: number;
  isMandatory: boolean;
  status: WorkflowStatus;
  startsAt: string | null;
  endsAt: string | null;
};

export type CourseDetail = Course & {
  enrollmentCount: number;
  completionRatePercent: number;
  instructorName: string;
  nextActionHint: string;
};

export type CourseListItem = Pick<
  Course,
  | 'id'
  | 'tenantId'
  | 'title'
  | 'category'
  | 'durationMinutes'
  | 'isMandatory'
  | 'status'
  | 'startsAt'
  | 'updatedAt'
> & {
  enrollmentCount: number;
};

export type Enrollment = TenantScopedEntity & {
  courseId: string;
  profileId: string;
  enrolledAt: string;
  completedAt: string | null;
  progressPercent: number;
  status: WorkflowStatus;
};

export type AkademieDashboardStats = {
  totalCourses: number;
  activeCoursesCount: number;
  upcomingCoursesCount: number;
  runningCoursesCount: number;
  mandatoryCount: number;
  mandatoryOpenCount: number;
  mandatoryOverdueCount: number;
  totalEnrollments: number;
  activeParticipantsCount: number;
  openEnrollmentsCount: number;
  openProgressCount: number;
  upcomingStartsCount: number;
  upcomingExamsCount: number;
  examsToGradeCount: number;
  certificatesToIssueCount: number;
  certificatesExpiringCount: number;
  mediathekOpenCount: number;
  trainingPlanOpenCount: number;
};

export function emptyAkademieDashboardStats(): AkademieDashboardStats {
  return {
    totalCourses: 0,
    activeCoursesCount: 0,
    upcomingCoursesCount: 0,
    runningCoursesCount: 0,
    mandatoryCount: 0,
    mandatoryOpenCount: 0,
    mandatoryOverdueCount: 0,
    totalEnrollments: 0,
    activeParticipantsCount: 0,
    openEnrollmentsCount: 0,
    openProgressCount: 0,
    upcomingStartsCount: 0,
    upcomingExamsCount: 0,
    examsToGradeCount: 0,
    certificatesToIssueCount: 0,
    certificatesExpiringCount: 0,
    mediathekOpenCount: 0,
    trainingPlanOpenCount: 0,
  };
}

export type EnrollmentListItem = Enrollment & {
  courseTitle: string;
  participantName: string;
};

export type EnrollmentDetail = EnrollmentListItem & {
  instructorName: string;
  lessonCount: number;
  nextActionHint: string;
};

export type CertificateListItem = Certificate & {
  courseTitle: string;
  participantName: string;
};

export type CertificateDetail = CertificateListItem & {
  certificateNumber: string;
  issuerName: string;
  nextActionHint: string;
};

export type AkademieModuleSettings = {
  mandatoryReminders: boolean;
  certificateAutoIssue: boolean;
  examRequired: boolean;
  externalInstructors: boolean;
  progressTracking: boolean;
};

export type AkademieReportStats = {
  activeCourses: number;
  enrollmentsOpen: number;
  completionsThisMonth: number;
  certificatesExpiring: number;
  mandatoryCompliancePercent: number;
};

export type Lesson = TenantScopedEntity & {
  courseId: string;
  title: string;
  sortOrder: number;
  durationMinutes: number;
  status: WorkflowStatus;
};

export type Certificate = TenantScopedEntity & {
  courseId: string;
  profileId: string;
  issuedAt: string;
  expiresAt: string | null;
  status: WorkflowStatus;
};
