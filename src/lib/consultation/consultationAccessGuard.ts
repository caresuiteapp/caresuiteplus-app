import type { RoleKey } from '@/types/core/auth';
import type { ConsultationAssessment, ConsultationCase, ConsultationDocument } from '@/types/modules/consultation';
import { hasPermission } from '@/lib/permissions/check';
import { buildWorkspaceAccessContext } from '@/lib/permissions/workspaceAccess';

export type ConsultationAccessDecision = { allowed: true } | { allowed: false; reason: string };

export const CONSULTATION_ADMIN_ROLES: RoleKey[] = [
  'business_admin',
  'business_manager',
  'counselor',
  'dispatch',
];

export const CONSULTATION_PORTAL_BLOCKED: RoleKey[] = ['client_portal', 'family_portal'];

export function canAccessConsultationModule(roleKey: RoleKey | null | undefined): ConsultationAccessDecision {
  if (!roleKey) return { allowed: false, reason: 'Rolle fehlt.' };
  if (CONSULTATION_PORTAL_BLOCKED.includes(roleKey)) {
    return { allowed: false, reason: 'Beratungsmodul für Portale nicht freigegeben.' };
  }
  if (hasPermission(roleKey, 'beratung.access') || hasPermission(roleKey, 'beratung.cases.view')) {
    return { allowed: true };
  }
  return { allowed: false, reason: 'Keine Berechtigung für CareSuite+ Beratung.' };
}

export function canViewConsultationCase(input: {
  actorRole: RoleKey | null | undefined;
  tenantId: string;
  consultationCase: ConsultationCase;
}): ConsultationAccessDecision {
  const moduleAccess = canAccessConsultationModule(input.actorRole);
  if (!moduleAccess.allowed) return moduleAccess;
  if (input.tenantId !== input.consultationCase.tenantId) {
    return { allowed: false, reason: 'Mandantentrennung — kein Zugriff.' };
  }
  return { allowed: true };
}

export function canViewConsultationHealthData(input: {
  actorRole: RoleKey | null | undefined;
  tenantId: string;
  resource: Pick<ConsultationCase | ConsultationAssessment | ConsultationDocument, 'tenantId' | 'containsHealthData'>;
}): ConsultationAccessDecision {
  if (!input.resource.containsHealthData) return { allowed: true };
  if (!input.actorRole) return { allowed: false, reason: 'Rolle fehlt.' };
  if (input.tenantId !== input.resource.tenantId) {
    return { allowed: false, reason: 'Mandant stimmt nicht überein.' };
  }
  if (CONSULTATION_PORTAL_BLOCKED.includes(input.actorRole)) {
    return { allowed: false, reason: 'Gesundheitsdaten für Portale gesperrt.' };
  }
  if (hasPermission(input.actorRole, 'office.clients.view_sensitive')) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'Gesundheitsdaten nur mit Berechtigung „Sensible Gesundheitsdaten einsehen“.',
  };
}

export function filterConsultationCasesForActor(
  cases: ConsultationCase[],
  input: { actorRole: RoleKey | null | undefined; tenantId: string },
): ConsultationCase[] {
  return cases.filter((c) => canViewConsultationCase({ ...input, consultationCase: c }).allowed);
}

export function assertProductionNoDemoFallback(usesDemoFallback: boolean): ConsultationAccessDecision {
  const ctx = buildWorkspaceAccessContext({ usesDemoFallback, environment: 'production' });
  if (ctx.environment === 'production' && usesDemoFallback) {
    return { allowed: false, reason: 'Demo-Fallback im Production Mode blockiert.' };
  }
  return { allowed: true };
}

export function maskHealthDataField<T>(
  value: T,
  input: {
    actorRole: RoleKey | null | undefined;
    tenantId: string;
    containsHealthData: boolean;
  },
): T | null {
  const decision = canViewConsultationHealthData({
    actorRole: input.actorRole,
    tenantId: input.tenantId,
    resource: { tenantId: input.tenantId, containsHealthData: input.containsHealthData },
  });
  return decision.allowed ? value : null;
}
