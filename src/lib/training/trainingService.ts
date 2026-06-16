import type { RoleKey } from '@/types/core/auth';
import type { ProductKey } from '@/types/core/tenant';
import type { ServiceResult } from '@/types';
import type {
  CompleteTrainingInput,
  EmployeeTrainingCertificate,
  EmployeeTrainingDeployability,
  EmployeeTrainingRecord,
  TrainingCourse,
  TrainingDashboardTile,
  TrainingDeployabilityIssue,
  TrainingReminder,
  TrainingViewKey,
} from '@/types/modules/training';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import {
  appendTrainingAuditEvent,
  getTrainingCertificatesForTenant,
  getTrainingCoursesForTenant,
  getTrainingRecordsForTenant,
  seedTrainingDemoStore,
  TRAINING_STORE,
} from './trainingStore';
import { resolveRequiredCoursesForEmployee } from './trainingRequirementsRegistry';
import {
  computeTrainingRecordStatus,
  daysUntil,
  isTrainingValidForDeployment,
  reminderLevelForDaysRemaining,
  syncExpiredTrainingStatuses,
} from './trainingStatusService';
import {
  canViewEmployeeTrainingRecords,
  filterCertificatesForActor,
  filterTrainingRecordsForActor,
} from './trainingAccessGuard';
import { isTrainingLiveReady } from './trainingModuleConfig';
import { buildTrainingDashboardTiles } from './trainingDashboardStats';

function ensureDemoStore(): void {
  if (TRAINING_STORE.courses.length === 0) seedTrainingDemoStore();
}

function assertTenantRecord<T extends { tenantId: string }>(
  entity: T | undefined,
  tenantId: string,
  label: string,
): ServiceResult<T> | null {
  if (!entity) return { ok: false, error: `${label} nicht gefunden.` };
  if (entity.tenantId !== tenantId) return { ok: false, error: 'Mandantentrennung verletzt.' };
  return null;
}

export function evaluateEmployeeTrainingDeployability(input: {
  tenantId: string;
  employeeId: string;
  roleKey?: RoleKey | null;
  moduleKeys?: ProductKey[];
  jobTitle?: string | null;
  reference?: Date;
}): EmployeeTrainingDeployability {
  ensureDemoStore();
  syncExpiredTrainingStatuses(TRAINING_STORE.records, TRAINING_STORE.courses, input.reference);

  const courses = getTrainingCoursesForTenant(input.tenantId);
  const requiredCourses = resolveRequiredCoursesForEmployee({
    courses,
    requirements: TRAINING_STORE.requirements.filter((r) => r.tenantId === input.tenantId),
    roleKey: input.roleKey,
    moduleKeys: input.moduleKeys,
    jobTitle: input.jobTitle,
  });

  const records = TRAINING_STORE.records.filter(
    (r) => r.tenantId === input.tenantId && r.employeeId === input.employeeId,
  );
  const certificates = TRAINING_STORE.certificates.filter(
    (c) => c.tenantId === input.tenantId && c.employeeId === input.employeeId,
  );

  const blockers: TrainingDeployabilityIssue[] = [];
  const warnings: TrainingDeployabilityIssue[] = [];

  for (const course of requiredCourses) {
    const record = records.find((r) => r.courseId === course.id);
    if (!record || ['required', 'assigned', 'in_progress', 'failed', 'rejected'].includes(record.status)) {
      blockers.push({
        code: 'mandatory_training_missing',
        message: `Pflichtschulung fehlt: ${course.title}`,
        severity: 'error',
        courseId: course.id,
        courseTitle: course.title,
      });
      continue;
    }

    const validity = isTrainingValidForDeployment({ record, course, reference: input.reference });
    if (!validity.valid) {
      const issueCode =
        validity.status === 'expired'
          ? 'training_expired'
          : validity.status === 'expires_soon'
            ? 'training_expires_soon'
            : 'proof_missing';
      const issue: TrainingDeployabilityIssue = {
        code: issueCode,
        message:
          validity.status === 'expired'
            ? `Schulung abgelaufen: ${course.title}`
            : validity.status === 'expires_soon'
              ? `Schulung läuft bald ab: ${course.title}`
              : `Nachweis fehlt: ${course.title}`,
        severity: course.expiryAction === 'block' || validity.action === 'block' ? 'error' : 'warning',
        courseId: course.id,
        courseTitle: course.title,
      };
      if (issue.severity === 'error') blockers.push(issue);
      else warnings.push(issue);
    } else if (validity.status === 'expires_soon') {
      const days = daysUntil(record.validUntil, input.reference);
      warnings.push({
        code: 'training_expires_soon',
        message: `Schulung läuft in ${days ?? '?'} Tagen ab: ${course.title}`,
        severity: 'warning',
        courseId: course.id,
        courseTitle: course.title,
      });
    }

    if (course.requiresProof) {
      const cert = certificates.find((c) => c.courseId === course.id);
      if (!cert) {
        blockers.push({
          code: 'certificate_missing',
          message: `Zertifikat fehlt: ${course.title}`,
          severity: 'error',
          courseId: course.id,
          courseTitle: course.title,
        });
      } else if (cert.verificationStatus === 'expired') {
        blockers.push({
          code: 'certificate_expired',
          message: `Zertifikat abgelaufen: ${course.title}`,
          severity: 'error',
          courseId: course.id,
          courseTitle: course.title,
        });
      } else if (cert.verificationStatus !== 'verified') {
        blockers.push({
          code: 'certificate_unverified',
          message: `Zertifikat nicht verifiziert: ${course.title}`,
          severity: 'error',
          courseId: course.id,
          courseTitle: course.title,
        });
      }
    }
  }

  const result =
    blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'assignable';

  return {
    deployable: blockers.length === 0,
    result,
    blockers,
    warnings,
  };
}

export async function fetchEmployeeTrainingRecords(
  tenantId: string,
  actorRole: RoleKey | null | undefined,
  actorEmployeeId?: string | null,
  targetEmployeeId?: string,
): Promise<ServiceResult<EmployeeTrainingRecord[]>> {
  const blocked = guardLiveDemoFeature<EmployeeTrainingRecord[]>(tenantId, 'Schulungsnachweise');
  if (blocked && getServiceMode() === 'supabase' && isTrainingLiveReady()) return blocked;
  if (blocked && getServiceMode() === 'supabase') return blocked;

  ensureDemoStore();
  syncExpiredTrainingStatuses(TRAINING_STORE.records, TRAINING_STORE.courses);

  const employeeId = targetEmployeeId ?? actorEmployeeId;
  if (!employeeId) return { ok: false, error: 'Mitarbeiterkontext fehlt.' };

  const access = canViewEmployeeTrainingRecords({
    actorRole,
    actorEmployeeId,
    targetEmployeeId: employeeId,
    tenantId,
    recordTenantId: tenantId,
  });
  if (!access.allowed) return { ok: false, error: access.reason };

  const records = getTrainingRecordsForTenant(tenantId).filter((r) => r.employeeId === employeeId);
  return { ok: true, data: filterTrainingRecordsForActor(records, { actorRole, actorEmployeeId, tenantId }) };
}

export async function fetchTrainingCourses(
  tenantId: string,
  actorRole: RoleKey | null | undefined,
): Promise<ServiceResult<TrainingCourse[]>> {
  const blocked = guardLiveDemoFeature<TrainingCourse[]>(tenantId, 'Schulungskatalog');
  if (blocked && getServiceMode() === 'supabase') return blocked;

  ensureDemoStore();
  if (actorRole === 'client_portal' || actorRole === 'family_portal') {
    return { ok: false, error: 'Schulungskatalog für Klient:innen nicht verfügbar.' };
  }

  return { ok: true, data: getTrainingCoursesForTenant(tenantId) };
}

export async function fetchEmployeeCertificates(
  tenantId: string,
  actorRole: RoleKey | null | undefined,
  actorEmployeeId?: string | null,
  targetEmployeeId?: string,
): Promise<ServiceResult<EmployeeTrainingCertificate[]>> {
  const blocked = guardLiveDemoFeature<EmployeeTrainingCertificate[]>(tenantId, 'Schulungszertifikate');
  if (blocked && getServiceMode() === 'supabase') return blocked;

  ensureDemoStore();
  const employeeId = targetEmployeeId ?? actorEmployeeId;
  if (!employeeId) return { ok: false, error: 'Mitarbeiterkontext fehlt.' };

  const certs = getTrainingCertificatesForTenant(tenantId).filter((c) => c.employeeId === employeeId);
  return {
    ok: true,
    data: filterCertificatesForActor(certs, { actorRole, actorEmployeeId, tenantId }),
  };
}

export async function completeTrainingRecord(
  input: CompleteTrainingInput,
  actorRole: RoleKey | null | undefined,
): Promise<ServiceResult<EmployeeTrainingRecord>> {
  const blocked = guardLiveDemoFeature<EmployeeTrainingRecord>(input.tenantId, 'Schulungsabschluss');
  if (blocked && getServiceMode() === 'supabase') return blocked;

  ensureDemoStore();
  const record = TRAINING_STORE.records.find((r) => r.id === input.trainingRecordId);
  const tenantErr = assertTenantRecord(record, input.tenantId, 'Schulungsnachweis');
  if (tenantErr) return tenantErr;
  if (!record || record.employeeId !== input.employeeId) {
    return { ok: false, error: 'Schulungsnachweis nicht gefunden.' };
  }

  const course = TRAINING_STORE.courses.find((c) => c.id === record.courseId);
  if (!course) return { ok: false, error: 'Schulungskurs nicht gefunden.' };

  if (course.requiresProof && !input.proofDocumentId) {
    return { ok: false, error: 'Abschluss ohne Nachweis nicht zulässig.' };
  }

  const now = new Date().toISOString();
  const validUntil =
    course.validityMonths != null
      ? new Date(Date.now() + course.validityMonths * 30 * 86_400_000).toISOString()
      : null;

  const updated: EmployeeTrainingRecord = {
    ...record,
    status: course.requiresQuiz && (input.scorePercent ?? 0) < 80 ? 'failed' : 'pending_review',
    completedAt: now,
    passedAt: course.requiresQuiz && (input.scorePercent ?? 0) < 80 ? null : now,
    proofDocumentId: input.proofDocumentId ?? record.proofDocumentId,
    scorePercent: input.scorePercent ?? record.scorePercent,
    validUntil,
    updatedAt: now,
  };

  if (!course.requiresProof && !course.requiresQuiz) {
    updated.status = computeTrainingRecordStatus({ record: { ...updated, status: 'passed' }, course });
    updated.passedAt = now;
  }

  const idx = TRAINING_STORE.records.findIndex((r) => r.id === record.id);
  TRAINING_STORE.records[idx] = updated;

  appendTrainingAuditEvent({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    courseId: course.id,
    trainingRecordId: record.id,
    certificateId: null,
    action: 'training_completed',
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? actorRole ?? null,
    summary: `Schulung abgeschlossen: ${course.title}`,
  });

  return { ok: true, data: updated };
}

export async function fetchTrainingReminders(
  tenantId: string,
  actorRole: RoleKey | null | undefined,
): Promise<ServiceResult<TrainingReminder[]>> {
  const blocked = guardLiveDemoFeature<TrainingReminder[]>(tenantId, 'Schulungserinnerungen');
  if (blocked && getServiceMode() === 'supabase') return blocked;

  ensureDemoStore();
  if (actorRole === 'client_portal' || actorRole === 'family_portal') {
    return { ok: false, error: 'Erinnerungen für Klient:innen nicht verfügbar.' };
  }

  return { ok: true, data: TRAINING_STORE.reminders.filter((r) => r.tenantId === tenantId) };
}

export async function fetchTrainingDashboard(
  tenantId: string,
  actorRole: RoleKey | null | undefined,
): Promise<ServiceResult<{ tiles: TrainingDashboardTile[]; views: TrainingViewKey[] }>> {
  const blocked = guardLiveDemoFeature<{ tiles: TrainingDashboardTile[]; views: TrainingViewKey[] }>(
    tenantId,
    'Schulungs-Dashboard',
  );
  if (blocked && getServiceMode() === 'supabase') return blocked;

  ensureDemoStore();
  syncExpiredTrainingStatuses(TRAINING_STORE.records, TRAINING_STORE.courses);

  const records = getTrainingRecordsForTenant(tenantId);
  const courses = getTrainingCoursesForTenant(tenantId);
  const reminders = TRAINING_STORE.reminders.filter((r) => r.tenantId === tenantId);

  const tiles = buildTrainingDashboardTiles({ records, courses, reminders, actorRole });
  const views: TrainingViewKey[] =
    actorRole === 'employee_portal'
      ? ['my_trainings', 'certificates']
      : [
          'dashboard',
          'mandatory_briefings',
          'all_courses',
          'employee_status',
          'certificates',
          'certificate_review',
          'expiry_monitoring',
          'settings',
        ];

  return { ok: true, data: { tiles, views } };
}

export function refreshTrainingReminders(tenantId: string, reference = new Date()): TrainingReminder[] {
  ensureDemoStore();
  syncExpiredTrainingStatuses(TRAINING_STORE.records, TRAINING_STORE.courses, reference);

  const existing = TRAINING_STORE.reminders.filter((r) => r.tenantId === tenantId);
  const generated: TrainingReminder[] = [];

  for (const record of getTrainingRecordsForTenant(tenantId)) {
    if (!record.validUntil) continue;
    const days = daysUntil(record.validUntil, reference);
    const level = reminderLevelForDaysRemaining(days);
    if (!level) continue;

    const course = TRAINING_STORE.courses.find((c) => c.id === record.courseId);
    if (!course) continue;

    const prior = existing.find(
      (r) => r.employeeId === record.employeeId && r.courseId === record.courseId && r.reminderLevel === level,
    );
    if (prior) {
      generated.push(prior);
      continue;
    }

    generated.push({
      id: `tr-rem-gen-${record.id}-${level}`,
      tenantId,
      employeeId: record.employeeId,
      courseId: record.courseId,
      trainingRecordId: record.id,
      reminderLevel: level,
      dueAt: record.validUntil,
      acknowledgedAt: null,
      adminTaskCreated: level === 'expired' || level === 'urgent_30d',
      createdAt: reference.toISOString(),
      updatedAt: reference.toISOString(),
    });
  }

  TRAINING_STORE.reminders = [
    ...TRAINING_STORE.reminders.filter((r) => r.tenantId !== tenantId),
    ...generated,
  ];
  return generated;
}

export function __resetTrainingServiceForTests(): void {
  TRAINING_STORE.courses = [];
  TRAINING_STORE.requirements = [];
  TRAINING_STORE.records = [];
  TRAINING_STORE.certificates = [];
  TRAINING_STORE.reminders = [];
  TRAINING_STORE.auditEvents = [];
}

export function __seedTrainingServiceForTests(): void {
  seedTrainingDemoStore();
}
