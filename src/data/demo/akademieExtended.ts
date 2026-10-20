import type { Certificate, EnrollmentListItem, CertificateListItem, EnrollmentDetail, CertificateDetail } from '@/types/modules/akademie';
import { getDemoEnrollments, getDemoCourseListItems } from './courses';
import { demoEmployees } from './employees';
import { DEMO_TENANT_ID } from './tenant';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

const CERTIFICATE_SEEDS: Certificate[] = [
  {
    id: 'cert-001',
    tenantId: DEMO_TENANT_ID,
    courseId: 'course-001',
    profileId: 'employee-001',
    issuedAt: daysAgo(5),
    expiresAt: daysFromNow(360),
    status: 'abgeschlossen',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  {
    id: 'cert-002',
    tenantId: DEMO_TENANT_ID,
    courseId: 'course-002',
    profileId: 'employee-002',
    issuedAt: daysAgo(30),
    expiresAt: daysFromNow(30),
    status: 'aktiv',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
  },
  {
    id: 'cert-003',
    tenantId: DEMO_TENANT_ID,
    courseId: 'course-003',
    profileId: 'employee-003',
    issuedAt: daysAgo(60),
    expiresAt: null,
    status: 'abgeschlossen',
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
];

function participantName(profileId: string): string {
  const employee = demoEmployees.find((e) => e.id === profileId);
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unbekannt';
}

function courseTitle(courseId: string): string {
  const course = getDemoCourseListItems().find((c) => c.id === courseId);
  return course?.title ?? 'Unbekannter Kurs';
}

export function getDemoEnrollmentListItems(): EnrollmentListItem[] {
  return getDemoEnrollments().map((enrollment) => ({
    ...enrollment,
    courseTitle: courseTitle(enrollment.courseId),
    participantName: participantName(enrollment.profileId),
  }));
}

export function getDemoCertificateListItems(): CertificateListItem[] {
  return CERTIFICATE_SEEDS.map((cert) => ({
    ...cert,
    courseTitle: courseTitle(cert.courseId),
    participantName: participantName(cert.profileId),
  }));
}

export function getDemoEnrollmentDetail(id: string): EnrollmentDetail | null {
  const item = getDemoEnrollmentListItems().find((e) => e.id === id);
  if (!item) return null;
  return {
    ...item,
    instructorName: 'Dr. Sabine Keller',
    lessonCount: 8,
    nextActionHint:
      item.progressPercent < 100
        ? `${100 - item.progressPercent} % bis Abschluss`
        : 'Kurs abgeschlossen — Zertifikat prüfen',
  };
}

export function getDemoCertificateDetail(id: string): CertificateDetail | null {
  const item = getDemoCertificateListItems().find((c) => c.id === id);
  if (!item) return null;
  return {
    ...item,
    certificateNumber: `CS-${item.id.replace('cert-', '').toUpperCase()}-2026`,
    issuerName: 'CareSuite+ Akademie',
    nextActionHint: item.expiresAt
      ? `Gültig bis ${new Date(item.expiresAt).toLocaleDateString('de-DE')}`
      : 'Unbefristet gültig',
  };
}

export function countCertificatesExpiringSoon(): number {
  const in60Days = Date.now() + 60 * 86_400_000;
  return CERTIFICATE_SEEDS.filter(
    (c) => c.expiresAt && new Date(c.expiresAt).getTime() <= in60Days,
  ).length;
}

export function countCompletionsThisMonth(): number {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return getDemoEnrollments().filter(
    (e) => e.completedAt && new Date(e.completedAt).getTime() >= monthStart.getTime(),
  ).length;
}
