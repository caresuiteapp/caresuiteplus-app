import type { WorkflowStatus } from '@/types';
import { demoEmployees } from '../employees';
import { getDemoCourseListItems, getDemoEnrollments } from '../courses';
import { DEMO_TENANT_ID } from '../tenant';

export type EnrollmentListItem = {
  id: string;
  tenantId: string;
  courseId: string;
  courseTitle: string;
  participantName: string;
  enrolledAt: string;
  progressPercent: number;
  status: WorkflowStatus;
};

export type CertificateListItem = {
  id: string;
  tenantId: string;
  courseTitle: string;
  participantName: string;
  issuedAt: string;
  expiresAt: string | null;
  status: WorkflowStatus;
};

export type AkademieModuleSettings = {
  mandatoryRemindersEnabled: boolean;
  certificateExpiryAlertsEnabled: boolean;
  selfEnrollmentEnabled: boolean;
  portalCertificatesEnabled: boolean;
};

export type AkademieReportKpi = {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  accentColor: string;
};

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function employeeName(profileId: string): string {
  const employee = demoEmployees.find((e) => e.id === profileId);
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unbekannt';
}

const courses = getDemoCourseListItems();

export function getDemoEnrollmentListItems(): EnrollmentListItem[] {
  return getDemoEnrollments().map((enrollment) => {
    const course = courses.find((c) => c.id === enrollment.courseId);
    return {
      id: enrollment.id,
      tenantId: enrollment.tenantId,
      courseId: enrollment.courseId,
      courseTitle: course?.title ?? 'Unbekannter Kurs',
      participantName: employeeName(enrollment.profileId),
      enrolledAt: enrollment.enrolledAt,
      progressPercent: enrollment.progressPercent,
      status: enrollment.status,
    };
  });
}

const CERTIFICATES: CertificateListItem[] = [
  {
    id: 'cert-001',
    tenantId: DEMO_TENANT_ID,
    courseTitle: 'Hygiene und Infektionsschutz',
    participantName: employeeName('employee-001'),
    issuedAt: daysAgo(5),
    expiresAt: daysFromNow(360),
    status: 'aktiv',
  },
  {
    id: 'cert-002',
    tenantId: DEMO_TENANT_ID,
    courseTitle: 'Basisschulung Alltagsbegleitung',
    participantName: employeeName('employee-002'),
    issuedAt: daysAgo(88),
    expiresAt: null,
    status: 'abgeschlossen',
  },
  {
    id: 'cert-003',
    tenantId: DEMO_TENANT_ID,
    courseTitle: 'Erste Hilfe Auffrischung',
    participantName: employeeName('employee-003'),
    issuedAt: daysAgo(400),
    expiresAt: daysAgo(30),
    status: 'fehlerhaft',
  },
];

const DEFAULT_SETTINGS: AkademieModuleSettings = {
  mandatoryRemindersEnabled: true,
  certificateExpiryAlertsEnabled: true,
  selfEnrollmentEnabled: false,
  portalCertificatesEnabled: true,
};

const REPORT_KPIS: AkademieReportKpi[] = [
  { id: 'akpi-1', label: 'Teilnahmen', value: 3, subValue: 'Aktive Einschreibungen', accentColor: '#62F3FF' },
  { id: 'akpi-2', label: 'Pflichtschulungen', value: 3, subValue: 'Offen / geplant', accentColor: '#FF9500' },
  { id: 'akpi-3', label: 'Zertifikate', value: 3, subValue: '1 ablaufend', accentColor: '#FFD166' },
  { id: 'akpi-4', label: 'Abschlussquote', value: '67 %', subValue: 'Letzte 90 Tage', accentColor: '#34C759' },
];

export function getDemoCertificates(): CertificateListItem[] {
  return CERTIFICATES.map((item) => ({ ...item }));
}

export function getDemoAkademieSettings(): AkademieModuleSettings {
  return { ...DEFAULT_SETTINGS };
}

export function getDemoAkademieReportKpis(): AkademieReportKpi[] {
  return REPORT_KPIS.map((item) => ({ ...item }));
}
