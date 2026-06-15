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
  mandatoryCount: number;
  totalEnrollments: number;
  upcomingStartsCount: number;
};

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
