import type {
  ApplicantDocument,
  ApplicantPrivacyRecord,
  ApplicantPrivacyStatus,
  ApplicantRecord,
} from '@/types/modules/recruiting';
import {
  APPLICANT_DEFAULT_RETENTION_DAYS,
  APPLICANT_EXTENDED_RETENTION_DAYS,
} from './recruitingModuleConfig';

export function computeDeletionDueAt(
  baseDateIso: string,
  retentionDays: number,
): string {
  const date = new Date(baseDateIso);
  date.setDate(date.getDate() + retentionDays);
  return date.toISOString();
}

export function resolveApplicantPrivacyStatus(applicant: ApplicantRecord): ApplicantPrivacyStatus {
  if (applicant.deletionScheduled) return 'deletion_due';
  if (applicant.archivedAt) return 'archived';
  if (applicant.deletionDueAt && new Date(applicant.deletionDueAt).getTime() <= Date.now()) {
    return 'deletion_due';
  }
  return 'active';
}

export function buildApplicantPrivacyRecord(applicant: ApplicantRecord): ApplicantPrivacyRecord {
  const retentionDays = applicant.extendedStorageConsent
    ? APPLICANT_EXTENDED_RETENTION_DAYS
    : APPLICANT_DEFAULT_RETENTION_DAYS;

  return {
    applicantId: applicant.id,
    tenantId: applicant.tenantId,
    status: resolveApplicantPrivacyStatus(applicant),
    deletionDeadlineDays: retentionDays,
    deletionDueAt: applicant.deletionDueAt,
    archivedAt: applicant.archivedAt,
    extendedStorageConsent: applicant.extendedStorageConsent,
    exportPrepared: true,
    subjectAccessPrepared: true,
  };
}

export function markApplicantArchived(applicant: ApplicantRecord): void {
  applicant.archivedAt = new Date().toISOString();
  applicant.updatedAt = applicant.archivedAt;
}

export function scheduleApplicantDeletion(applicant: ApplicantRecord): void {
  applicant.deletionScheduled = true;
  if (!applicant.deletionDueAt) {
    applicant.deletionDueAt = computeDeletionDueAt(
      applicant.appliedAt,
      applicant.extendedStorageConsent
        ? APPLICANT_EXTENDED_RETENTION_DAYS
        : APPLICANT_DEFAULT_RETENTION_DAYS,
    );
  }
  applicant.updatedAt = new Date().toISOString();
}

export function grantExtendedStorageConsent(applicant: ApplicantRecord): void {
  applicant.extendedStorageConsent = true;
  applicant.extendedStorageConsentAt = new Date().toISOString();
  applicant.deletionDueAt = computeDeletionDueAt(
    applicant.appliedAt,
    APPLICANT_EXTENDED_RETENTION_DAYS,
  );
  applicant.updatedAt = applicant.extendedStorageConsentAt;
}

export function prepareApplicantDataExport(
  applicant: ApplicantRecord,
  documents: ApplicantDocument[],
): { exportPrepared: true; payload: Record<string, unknown> } {
  return {
    exportPrepared: true,
    payload: {
      applicant: {
        id: applicant.id,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        email: applicant.email,
        appliedRole: applicant.appliedRole,
        status: applicant.status,
        appliedAt: applicant.appliedAt,
      },
      documents: documents.map((d) => ({
        type: d.documentType,
        status: d.status,
        title: d.title,
      })),
      privacy: buildApplicantPrivacyRecord(applicant),
      preparedOnly: true,
    },
  };
}

export function prepareApplicantSubjectAccess(
  applicant: ApplicantRecord,
): { subjectAccessPrepared: true; sections: string[] } {
  return {
    subjectAccessPrepared: true,
    sections: [
      'stammdaten',
      'bewerbungsstatus',
      'unterlagen_metadaten',
      'kommunikationsentwuerfe',
      'loeschfristen',
    ],
  };
}

export function listApplicantsDueForDeletion(
  applicants: ApplicantRecord[],
  referenceDate = new Date(),
): ApplicantRecord[] {
  return applicants.filter((a) => {
    if (a.archivedAt || a.status === 'converted') return false;
    if (!a.deletionDueAt) return false;
    return new Date(a.deletionDueAt).getTime() <= referenceDate.getTime();
  });
}
