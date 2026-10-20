import type {
  EmployeeBackgroundCheckRecord,
  EmployeeBackgroundCheckStatus,
} from '@/types/modules/employeePersonnelFile';
import { BACKGROUND_CHECK_VALIDITY_MONTHS } from './employeePersonnelFieldRules';

function addMonths(dateIso: string, months: number): Date {
  const d = new Date(dateIso);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function computeBackgroundCheckStatus(
  record: Pick<
    EmployeeBackgroundCheckRecord,
    'present' | 'issueDate' | 'verifiedAt' | 'status' | 'followUpDueAt'
  >,
  reference = new Date(),
  required = true,
): EmployeeBackgroundCheckStatus {
  if (!required) return 'not_required';
  if (record.status === 'rejected') return 'rejected';
  if (record.status === 'requested' || record.status === 'submitted') return record.status;
  if (!record.present && !record.issueDate) return 'missing';

  if (record.verifiedAt && record.issueDate) {
    const expiresAt = addMonths(record.issueDate, BACKGROUND_CHECK_VALIDITY_MONTHS);
    if (reference > expiresAt) return 'expired';
    if (record.followUpDueAt && reference >= new Date(record.followUpDueAt)) return 'expired';
    return 'verified';
  }

  if (record.present || record.issueDate) return 'submitted';
  return 'missing';
}

export function isBackgroundCheckAssignable(
  record: Pick<
    EmployeeBackgroundCheckRecord,
    'present' | 'issueDate' | 'verifiedAt' | 'status' | 'followUpDueAt'
  >,
  required = true,
  reference = new Date(),
): boolean {
  const status = computeBackgroundCheckStatus(record, reference, required);
  return status === 'verified' || status === 'not_required';
}

export function canViewBackgroundCheckDocument(roleKey: string | null): boolean {
  return roleKey === 'business_admin' || roleKey === 'business_manager';
}

export function findBackgroundCheckFollowUp(
  record: Pick<EmployeeBackgroundCheckRecord, 'issueDate' | 'followUpDueAt'>,
): { label: string; date: string } | null {
  if (record.followUpDueAt) {
    return { label: 'Führungszeugnis Nachweis', date: record.followUpDueAt };
  }
  if (record.issueDate) {
    const followUp = addMonths(record.issueDate, BACKGROUND_CHECK_VALIDITY_MONTHS);
    return { label: 'Führungszeugnis Ablauf', date: followUp.toISOString().slice(0, 10) };
  }
  return null;
}
