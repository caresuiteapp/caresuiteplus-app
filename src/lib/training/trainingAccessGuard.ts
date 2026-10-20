import type { RoleKey } from '@/types/core/auth';
import type { EmployeeTrainingCertificate, EmployeeTrainingRecord } from '@/types/modules/training';
import { ADMIN_ROLES_FOR_SENSITIVE_PERSONNEL } from '@/lib/office/employeePersonnelFieldRules';

export type TrainingAccessDecision = { allowed: true } | { allowed: false; reason: string };

export const TRAINING_ADMIN_ROLES: RoleKey[] = [
  'business_admin',
  'business_manager',
  'dispatch',
  'akademie_admin',
];

export const TRAINING_CERTIFICATE_REVIEW_ROLES: RoleKey[] = [
  'business_admin',
  'business_manager',
  'akademie_admin',
];

export const TRAINING_CLIENT_BLOCKED_ROLES: RoleKey[] = ['client_portal', 'family_portal'];

export function canViewTrainingAdminDashboard(roleKey: RoleKey | null | undefined): TrainingAccessDecision {
  if (!roleKey) return { allowed: false, reason: 'Rolle fehlt.' };
  if (TRAINING_CLIENT_BLOCKED_ROLES.includes(roleKey)) {
    return { allowed: false, reason: 'Schulungsdaten sind für Klient:innen nicht sichtbar.' };
  }
  if (TRAINING_ADMIN_ROLES.includes(roleKey)) return { allowed: true };
  if (roleKey === 'employee_portal') return { allowed: true };
  if (roleKey === 'nurse' || roleKey === 'caregiver') return { allowed: true };
  return { allowed: false, reason: 'Keine Berechtigung für Schulungsübersicht.' };
}

export function canViewEmployeeTrainingRecords(input: {
  actorRole: RoleKey | null | undefined;
  actorEmployeeId?: string | null;
  targetEmployeeId: string;
  tenantId: string;
  recordTenantId: string;
}): TrainingAccessDecision {
  if (input.tenantId !== input.recordTenantId) {
    return { allowed: false, reason: 'Mandantentrennung — kein Zugriff.' };
  }
  if (input.actorRole && TRAINING_CLIENT_BLOCKED_ROLES.includes(input.actorRole)) {
    return { allowed: false, reason: 'Interne Schulungsdaten für Klient:innen gesperrt.' };
  }
  if (input.actorRole && TRAINING_ADMIN_ROLES.includes(input.actorRole)) {
    return { allowed: true };
  }
  if (input.actorRole === 'employee_portal' || input.actorRole === 'caregiver' || input.actorRole === 'nurse') {
    if (!input.actorEmployeeId) return { allowed: false, reason: 'Mitarbeiterkontext fehlt.' };
    return input.actorEmployeeId === input.targetEmployeeId
      ? { allowed: true }
      : { allowed: false, reason: 'Mitarbeitende sehen nur eigene Schulungen.' };
  }
  return { allowed: false, reason: 'Keine Berechtigung für Schulungsnachweise.' };
}

export function canViewCertificate(input: {
  actorRole: RoleKey | null | undefined;
  actorEmployeeId?: string | null;
  certificate: EmployeeTrainingCertificate;
  tenantId: string;
}): TrainingAccessDecision {
  const recordAccess = canViewEmployeeTrainingRecords({
    actorRole: input.actorRole,
    actorEmployeeId: input.actorEmployeeId,
    targetEmployeeId: input.certificate.employeeId,
    tenantId: input.tenantId,
    recordTenantId: input.certificate.tenantId,
  });
  if (!recordAccess.allowed) return recordAccess;

  if (input.actorRole && TRAINING_CERTIFICATE_REVIEW_ROLES.includes(input.actorRole)) {
    return { allowed: true };
  }

  if (input.actorRole === 'employee_portal' || input.actorRole === 'caregiver' || input.actorRole === 'nurse') {
    return input.certificate.verificationStatus === 'verified'
      ? { allowed: true }
      : { allowed: false, reason: 'Zertifikat erst nach Verifikation sichtbar.' };
  }

  return { allowed: false, reason: 'Keine Berechtigung für Zertifikatsansicht.' };
}

export function canVerifyCertificate(roleKey: RoleKey | null | undefined): TrainingAccessDecision {
  if (!roleKey) return { allowed: false, reason: 'Rolle fehlt.' };
  if (TRAINING_CERTIFICATE_REVIEW_ROLES.includes(roleKey)) return { allowed: true };
  if (ADMIN_ROLES_FOR_SENSITIVE_PERSONNEL.includes(roleKey)) return { allowed: true };
  return { allowed: false, reason: 'Zertifikatsprüfung nur für autorisierte Rollen.' };
}

export function filterTrainingRecordsForActor(
  records: EmployeeTrainingRecord[],
  input: {
    actorRole: RoleKey | null | undefined;
    actorEmployeeId?: string | null;
    tenantId: string;
  },
): EmployeeTrainingRecord[] {
  return records.filter((record) => {
    const decision = canViewEmployeeTrainingRecords({
      actorRole: input.actorRole,
      actorEmployeeId: input.actorEmployeeId,
      targetEmployeeId: record.employeeId,
      tenantId: input.tenantId,
      recordTenantId: record.tenantId,
    });
    return decision.allowed;
  });
}

export function filterCertificatesForActor(
  certificates: EmployeeTrainingCertificate[],
  input: {
    actorRole: RoleKey | null | undefined;
    actorEmployeeId?: string | null;
    tenantId: string;
  },
): EmployeeTrainingCertificate[] {
  return certificates.filter((cert) => canViewCertificate({ ...input, certificate: cert }).allowed);
}
