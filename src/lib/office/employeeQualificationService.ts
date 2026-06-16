import type {
  EmployeeQualificationRecord,
  EmployeeQualificationStatus,
} from '@/types/modules/employeePersonnelFile';
import { QUALIFICATION_EXPIRY_WARNING_DAYS } from './employeePersonnelFieldRules';

function daysUntil(dateIso: string | null, reference = new Date()): number | null {
  if (!dateIso) return null;
  const target = new Date(dateIso);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - reference.getTime()) / 86_400_000);
}

export function computeQualificationStatus(
  record: Pick<
    EmployeeQualificationRecord,
    'validUntil' | 'verifiedAt' | 'status'
  >,
  reference = new Date(),
): EmployeeQualificationStatus {
  if (record.status === 'pending_review' || record.status === 'rejected' || record.status === 'missing') {
    return record.status;
  }

  if (!record.validUntil) {
    return record.verifiedAt ? 'valid' : 'pending_review';
  }

  const remaining = daysUntil(record.validUntil, reference);
  if (remaining == null) return 'pending_review';
  if (remaining < 0) return 'expired';
  if (remaining <= QUALIFICATION_EXPIRY_WARNING_DAYS) return 'expires_soon';
  return record.verifiedAt ? 'valid' : 'pending_review';
}

export function resolveQualificationOverview(
  qualifications: EmployeeQualificationRecord[],
  reference = new Date(),
): EmployeeQualificationStatus | 'mixed' {
  if (qualifications.length === 0) return 'missing';

  const statuses = qualifications.map((q) =>
    computeQualificationStatus({ ...q, status: q.status }, reference),
  );

  if (statuses.some((s) => s === 'expired' || s === 'missing' || s === 'rejected')) return 'expired';
  if (statuses.some((s) => s === 'expires_soon')) return 'expires_soon';
  if (statuses.some((s) => s === 'pending_review')) return 'pending_review';
  if (new Set(statuses).size > 1) return 'mixed';
  return statuses[0] ?? 'missing';
}

export function hasRequiredQualifications(
  qualifications: EmployeeQualificationRecord[],
  requiredTypes: string[],
  reference = new Date(),
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const type of requiredTypes) {
    const match = qualifications.find((q) => q.qualificationType === type);
    if (!match) {
      missing.push(type);
      continue;
    }
    const status = computeQualificationStatus(match, reference);
    if (status === 'expired' || status === 'missing' || status === 'rejected') {
      missing.push(type);
    }
  }

  return { ok: missing.length === 0, missing };
}

export function findNextQualificationExpiry(
  qualifications: EmployeeQualificationRecord[],
  reference = new Date(),
): { label: string; date: string } | null {
  const candidates = qualifications
    .filter((q) => q.validUntil)
    .map((q) => ({
      label: q.title,
      date: q.validUntil!,
      days: daysUntil(q.validUntil, reference) ?? 9999,
    }))
    .filter((c) => c.days >= 0)
    .sort((a, b) => a.days - b.days);

  return candidates[0] ?? null;
}
