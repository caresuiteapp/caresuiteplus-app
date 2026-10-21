import { academyLatestCertificates } from './workspacePlanning';
import { isAcademyOverdue, type AcademyCertificate, type AcademyCourse, type AcademyEnrollment, type AcademyWorkspace } from './workspaceModel';

export type AcademyReportCounts = {
  total: number;
  open: number;
  submitted: number;
  completed: number;
  cancelled: number;
  completionBase: number;
  completionRate: number | null;
  overdue: number;
  mandatoryOverdue: number;
};
export type AcademyReportCertificates = {
  historical: number;
  current: number;
  expiring: number;
  expired: number;
  revoked: number;
  withoutExpiry: number;
};
export type AcademyCourseReport = AcademyReportCounts & {
  courseId: string;
  title: string;
  versions: number[];
  certificates: AcademyReportCertificates;
};
export type AcademyReport = AcademyReportCounts & {
  today: string;
  expiringThrough: string;
  certificates: AcademyReportCertificates;
  courses: AcademyCourseReport[];
};

export function academyReportToday() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
}

function dateAfterDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function countEnrollments(enrollments: AcademyEnrollment[], today: string): AcademyReportCounts {
  const counts: AcademyReportCounts = {
    total: enrollments.length, open: 0, submitted: 0, completed: 0, cancelled: 0,
    completionBase: 0, completionRate: null, overdue: 0, mandatoryOverdue: 0,
  };
  for (const enrollment of enrollments) {
    if (enrollment.state === 'completed') counts.completed++;
    else if (enrollment.state === 'cancelled') counts.cancelled++;
    else if (enrollment.state === 'submitted') counts.submitted++;
    else counts.open++;
    if (isAcademyOverdue(enrollment, today)) {
      counts.overdue++;
      if (enrollment.content.mandatory) counts.mandatoryOverdue++;
    }
  }
  counts.completionBase = counts.total - counts.cancelled;
  counts.completionRate = counts.completionBase ? Math.round(counts.completed * 100 / counts.completionBase) : null;
  return counts;
}

function countCertificates(enrollments: AcademyEnrollment[], certificates: AcademyCertificate[], currentIds: Set<string>, today: string, through: string): AcademyReportCertificates {
  const completedIds = new Set(enrollments.filter(enrollment => enrollment.state === 'completed').map(enrollment => enrollment.id));
  const selected = certificates.filter(certificate => completedIds.has(certificate.enrollmentId));
  const current = selected.filter(certificate => currentIds.has(certificate.id));
  const result: AcademyReportCertificates = { historical: selected.length, current: current.length, expiring: 0, expired: 0, revoked: 0, withoutExpiry: 0 };
  for (const certificate of current) {
    if (certificate.revokedAt) result.revoked++;
    else if (!certificate.validUntil) result.withoutExpiry++;
    else if (certificate.validUntil.slice(0, 10) < today) result.expired++;
    else if (certificate.validUntil.slice(0, 10) <= through) result.expiring++;
  }
  return result;
}

/** All inputs are already scoped by the server and the visible workspace filters. */
export function deriveAcademyReport(
  enrollments: AcademyEnrollment[],
  certificates: AcademyCertificate[],
  courses: AcademyCourse[] = [],
  today = academyReportToday(),
  history?: Pick<AcademyWorkspace, 'enrollments' | 'certificates'>,
): AcademyReport {
  const expiringThrough = dateAfterDays(today, 30);
  // Filtering an old course title must not make an obsolete proof current again.
  const currentIds = new Set(academyLatestCertificates(history ?? { enrollments, certificates }).map(certificate => certificate.id));
  const groups = new Map<string, AcademyEnrollment[]>();
  const courseById = new Map(courses.map(course => [course.id, course]));
  for (const enrollment of enrollments) {
    const group = groups.get(enrollment.courseId);
    if (group) group.push(enrollment);
    else groups.set(enrollment.courseId, [enrollment]);
  }
  const courseReports = [...groups].map(([courseId, entries]): AcademyCourseReport => {
    const newest = [...entries].sort((a, b) => b.versionNumber - a.versionNumber || b.assignedAt.localeCompare(a.assignedAt))[0]!;
    return {
      courseId, title: newest.content.title || courseById.get(courseId)?.content.title || 'Schulung',
      versions: [...new Set(entries.map(entry => entry.versionNumber))].sort((a, b) => a - b),
      ...countEnrollments(entries, today),
      certificates: countCertificates(entries, certificates, currentIds, today, expiringThrough),
    };
  }).sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.title.localeCompare(b.title, 'de-DE'));
  return {
    today, expiringThrough, ...countEnrollments(enrollments, today),
    certificates: countCertificates(enrollments, certificates, currentIds, today, expiringThrough),
    courses: courseReports,
  };
}
