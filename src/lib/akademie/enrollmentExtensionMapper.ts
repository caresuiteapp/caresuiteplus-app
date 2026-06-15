import type { EnrollmentListItem, EnrollmentDetail, CertificateListItem, CertificateDetail } from '@/types/modules/akademie';
import type { WorkflowStatus } from '@/types/core/base';

export type EnrollmentLiveRow = {
  id: string;
  tenant_id: string;
  course_id: string | null;
  profile_id: string | null;
  progress_percent: number;
  enrolled_at: string;
  completed_at: string | null;
  status: string;
  updated_at: string;
};

export type CertificateLiveRow = {
  id: string;
  tenant_id: string;
  course_id: string | null;
  profile_id: string | null;
  issued_at: string;
  expires_at: string | null;
  status: string;
  updated_at: string;
};

export const ENROLLMENT_LIVE_SELECT_COLUMNS =
  'id, tenant_id, course_id, profile_id, progress_percent, enrolled_at, completed_at, status, updated_at';

export const CERTIFICATE_LIVE_SELECT_COLUMNS =
  'id, tenant_id, course_id, profile_id, issued_at, expires_at, status, updated_at';

function mapWorkflowStatus(raw: string): WorkflowStatus {
  if (raw === 'aktiv' || raw === 'abgeschlossen' || raw === 'in_bearbeitung') {
    return raw;
  }
  return 'in_bearbeitung';
}

export function mapEnrollmentRowToListItem(row: EnrollmentLiveRow): EnrollmentListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    courseId: row.course_id ?? 'unknown',
    profileId: row.profile_id ?? 'unknown',
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at,
    progressPercent: row.progress_percent,
    status: mapWorkflowStatus(row.status),
    createdAt: row.enrolled_at,
    updatedAt: row.updated_at,
    courseTitle: row.course_id ? 'Kurs' : 'Unbekannter Kurs',
    participantName: row.profile_id ? 'Teilnehmer' : 'Unbekannt',
  };
}

export function mapEnrollmentRowToDetail(row: EnrollmentLiveRow): EnrollmentDetail {
  const listItem = mapEnrollmentRowToListItem(row);
  return {
    ...listItem,
    instructorName: 'Noch nicht synchronisiert',
    lessonCount: 0,
    nextActionHint: 'Live-Einschreibung — Backfill nach Migration 0036',
  };
}

export function mapCertificateRowToListItem(row: CertificateLiveRow): CertificateListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    courseId: row.course_id ?? 'unknown',
    profileId: row.profile_id ?? 'unknown',
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    status: mapWorkflowStatus(row.status),
    createdAt: row.issued_at,
    updatedAt: row.updated_at,
    courseTitle: row.course_id ? 'Kurs' : 'Unbekannter Kurs',
    participantName: row.profile_id ? 'Teilnehmer' : 'Unbekannt',
  };
}

export function mapCertificateRowToDetail(row: CertificateLiveRow): CertificateDetail {
  const listItem = mapCertificateRowToListItem(row);
  return {
    ...listItem,
    certificateNumber: `CERT-${row.id.slice(0, 8).toUpperCase()}`,
    issuerName: 'CareSuite Akademie',
    nextActionHint: 'Live-Zertifikat — Backfill nach Migration 0036',
  };
}
