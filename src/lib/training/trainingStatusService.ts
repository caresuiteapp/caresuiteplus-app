import type {
  EmployeeTrainingRecord,
  TrainingCourse,
  TrainingExpiryAction,
  TrainingRecordStatus,
} from '@/types/modules/training';
import {
  TRAINING_EXPIRY_URGENT_DAYS as URGENT_DAYS,
  TRAINING_EXPIRY_WARNING_DAYS as WARNING_DAYS,
} from '@/types/modules/training';

const COMPLETED_STATUSES: ReadonlySet<TrainingRecordStatus> = new Set([
  'completed',
  'passed',
  'expires_soon',
]);

export function daysUntil(isoDate: string | null, reference = new Date()): number | null {
  if (!isoDate) return null;
  const diff = new Date(isoDate).getTime() - reference.getTime();
  return Math.ceil(diff / 86_400_000);
}

export function computeTrainingRecordStatus(input: {
  record: EmployeeTrainingRecord;
  course: TrainingCourse;
  reference?: Date;
}): TrainingRecordStatus {
  const { record, course } = input;
  const reference = input.reference ?? new Date();

  if (record.status === 'waived' || record.status === 'rejected' || record.status === 'archived') {
    return record.status;
  }
  if (record.status === 'pending_review') return 'pending_review';
  if (!COMPLETED_STATUSES.has(record.status) && record.status !== 'expired') {
    return record.status;
  }

  const remaining = daysUntil(record.validUntil, reference);
  if (remaining === null) {
    return record.passedAt || record.completedAt ? 'passed' : record.status;
  }
  if (remaining < 0) return 'expired';
  if (remaining <= URGENT_DAYS) return 'expires_soon';
  if (remaining <= WARNING_DAYS) return 'expires_soon';
  return record.passedAt ? 'passed' : 'completed';
}

export function isTrainingValidForDeployment(input: {
  record: EmployeeTrainingRecord;
  course: TrainingCourse;
  reference?: Date;
}): { valid: boolean; status: TrainingRecordStatus; action: TrainingExpiryAction | null } {
  const status = computeTrainingRecordStatus(input);
  const validStatuses: TrainingRecordStatus[] = ['passed', 'completed', 'expires_soon'];

  if (!validStatuses.includes(status)) {
    return { valid: false, status, action: status === 'expired' ? input.course.expiryAction : null };
  }

  if (status === 'expires_soon' && input.course.expiryAction === 'block') {
    const remaining = daysUntil(input.record.validUntil, input.reference);
    if (remaining !== null && remaining <= URGENT_DAYS) {
      return { valid: false, status, action: 'block' };
    }
  }

  if (input.course.requiresProof && !input.record.proofDocumentId && status !== 'expires_soon') {
    return { valid: false, status, action: 'block' };
  }

  return { valid: true, status, action: null };
}

export function reminderLevelForDaysRemaining(days: number | null): 'info_90d' | 'urgent_30d' | 'expired' | null {
  if (days === null) return null;
  if (days < 0) return 'expired';
  if (days <= URGENT_DAYS) return 'urgent_30d';
  if (days <= WARNING_DAYS) return 'info_90d';
  return null;
}

export function syncExpiredTrainingStatuses(
  records: EmployeeTrainingRecord[],
  courses: TrainingCourse[],
  reference = new Date(),
): EmployeeTrainingRecord[] {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  return records.map((record) => {
    const course = courseById.get(record.courseId);
    if (!course) return record;
    const nextStatus = computeTrainingRecordStatus({ record, course, reference });
    if (nextStatus === record.status) return record;
    return { ...record, status: nextStatus, updatedAt: reference.toISOString() };
  });
}
