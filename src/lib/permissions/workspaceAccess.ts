import type { RoleKey } from '@/types/core/auth';
import type {
  WorkspaceAccessContext,
  WorkspaceAccessCode,
  WorkspaceAccessDecision,
  WorkspaceAuditEvent,
} from '@/types/permissions/workspace';
import { getMode, mapWorkspaceEnvironment } from '@/lib/environment';
import { isDemoMode } from '@/lib/supabase/config';
import { hasPermission } from './check';
import {
  CLIENT_PORTAL_ROLES,
  EMPLOYEE_PORTAL_ROLES,
  isAdministrationRole,
  isClientPortalRole,
  isEmployeePortalRole,
  isPortalOnlyRole,
  hasFullTenantDataAccess,
  PORTAL_ONLY_ROLES,
} from './workspaceRoles';

let auditCounter = 0;
const AUDIT_EVENTS: WorkspaceAuditEvent[] = [];

function deny(code: WorkspaceAccessCode, message: string): WorkspaceAccessDecision {
  return { allowed: false, code, message };
}

function allow(): WorkspaceAccessDecision {
  return { allowed: true };
}

function assertAuth(ctx: WorkspaceAccessContext): WorkspaceAccessDecision | null {
  if (!ctx.userId?.trim()) {
    return deny('missing_user', 'Anmeldung erforderlich.');
  }
  if (!ctx.tenantId?.trim()) {
    return deny('missing_tenant', 'Mandant fehlt.');
  }
  if (!ctx.roleKey) {
    return deny('missing_role', 'Rolle fehlt.');
  }
  return null;
}

function assertTenantScope(ctx: WorkspaceAccessContext, resourceTenantId?: string | null): WorkspaceAccessDecision | null {
  if (resourceTenantId && resourceTenantId !== ctx.tenantId) {
    return deny('tenant_mismatch', 'Datensatz gehört zu einem anderen Mandanten.');
  }
  return null;
}

function assertProductionSafety(ctx: WorkspaceAccessContext): WorkspaceAccessDecision | null {
  const environment =
    ctx.environment ?? mapWorkspaceEnvironment(ctx.tenantId);
  const demoMode = ctx.isDemoMode ?? (isDemoMode() || getMode(ctx.tenantId) === 'demo');
  if (environment === 'production' && demoMode) {
    return deny('production_demo_blocked', 'Demo-Modus im Production Mode blockiert.');
  }
  if (environment === 'production' && ctx.usesDemoFallback) {
    return deny('production_demo_blocked', 'Demo-Fallback im Production Mode blockiert.');
  }
  return null;
}

export function buildWorkspaceAccessContext(
  input: Partial<WorkspaceAccessContext> & { tenantId?: string | null } = {},
): WorkspaceAccessContext {
  return {
    userId: input.userId !== undefined ? input.userId : 'demo-user',
    tenantId: input.tenantId !== undefined ? input.tenantId : null,
    roleKey: input.roleKey !== undefined ? input.roleKey : null,
    resourceTenantId: input.resourceTenantId ?? input.tenantId ?? null,
    employeeId: input.employeeId ?? null,
    clientId: input.clientId ?? null,
    profileId: input.profileId ?? null,
    sharedClientIds: input.sharedClientIds ?? [],
    environment: input.environment ?? mapWorkspaceEnvironment(input.tenantId),
    isDemoMode: input.isDemoMode ?? (isDemoMode() || getMode(input.tenantId) === 'demo'),
    usesDemoFallback: input.usesDemoFallback ?? false,
  };
}

export function logWorkspaceAccessEvent(input: Omit<WorkspaceAuditEvent, 'id' | 'createdAt'>): WorkspaceAuditEvent {
  auditCounter += 1;
  const event: WorkspaceAuditEvent = {
    id: `ws-audit-${auditCounter}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  AUDIT_EVENTS.push(event);
  return event;
}

export function getWorkspaceAuditTrail(tenantId?: string): WorkspaceAuditEvent[] {
  return tenantId ? AUDIT_EVENTS.filter((e) => e.tenantId === tenantId) : [...AUDIT_EVENTS];
}

export function resetWorkspaceAuditStore(): void {
  AUDIT_EVENTS.length = 0;
  auditCounter = 0;
}

export function canAccessAdminArea(ctx: WorkspaceAccessContext): WorkspaceAccessDecision {
  const auth = assertAuth(ctx);
  if (auth) return auth;
  const production = assertProductionSafety(ctx);
  if (production) return production;
  if (isPortalOnlyRole(ctx.roleKey)) {
    return deny('area_forbidden', 'Portal-Rollen haben keinen Zugriff auf die Verwaltung.');
  }
  if (!hasPermission(ctx.roleKey, 'office.access')) {
    return deny('permission_denied', 'Office-/Verwaltungsbereich nicht freigegeben.');
  }
  return allow();
}

export function canAccessEmployeePortal(ctx: WorkspaceAccessContext): WorkspaceAccessDecision {
  const auth = assertAuth(ctx);
  if (auth) return auth;
  const production = assertProductionSafety(ctx);
  if (production) return production;

  if (ctx.roleKey === 'employee_portal') {
    if (!hasPermission(ctx.roleKey, 'portal.employee.appointments.view')) {
      return deny('permission_denied', 'Mitarbeiterportal nicht freigegeben.');
    }
    return allow();
  }

  if (isEmployeePortalRole(ctx.roleKey) && hasPermission(ctx.roleKey, 'assist.execution.manage')) {
    return allow();
  }

  if (isClientPortalRole(ctx.roleKey)) {
    return deny('area_forbidden', 'Klient:innenportal-Rolle hat keinen Mitarbeiterportal-Zugriff.');
  }

  return deny('area_forbidden', 'Kein Mitarbeiterportal-Zugriff für diese Rolle.');
}

export function canAccessClientPortal(ctx: WorkspaceAccessContext): WorkspaceAccessDecision {
  const auth = assertAuth(ctx);
  if (auth) return auth;
  const production = assertProductionSafety(ctx);
  if (production) return production;
  if (!isClientPortalRole(ctx.roleKey)) {
    return deny('area_forbidden', 'Kein Klient:innenportal-Zugriff für diese Rolle.');
  }
  if (!hasPermission(ctx.roleKey, 'portal.client.appointments.view')) {
    return deny('permission_denied', 'Klient:innenportal nicht freigegeben.');
  }
  return allow();
}

export type AssignmentResource = {
  tenantId: string;
  employeeId: string;
  clientId: string;
};

export function canViewAssignment(
  ctx: WorkspaceAccessContext,
  assignment: AssignmentResource,
): WorkspaceAccessDecision {
  const auth = assertAuth(ctx);
  if (auth) return auth;
  const tenant = assertTenantScope(ctx, assignment.tenantId);
  if (tenant) return tenant;

  if (isAdministrationRole(ctx.roleKey) && hasPermission(ctx.roleKey, 'assist.assignments.view')) {
    if (hasFullTenantDataAccess(ctx.roleKey)) {
      return allow();
    }
    if (ctx.employeeId) {
      return assignment.employeeId === ctx.employeeId
        ? allow()
        : deny('not_assigned', 'Einsatz ist nicht zugewiesen.');
    }
    return allow();
  }

  if (isEmployeePortalRole(ctx.roleKey) || ctx.roleKey === 'employee_portal') {
    if (!ctx.employeeId) {
      return deny('no_assignment_context', 'Mitarbeiterkontext fehlt.');
    }
    return assignment.employeeId === ctx.employeeId
      ? allow()
      : deny('not_assigned', 'Einsatz ist nicht zugewiesen.');
  }

  if (isClientPortalRole(ctx.roleKey)) {
    if (!ctx.clientId) {
      return deny('no_assignment_context', 'Klient:innenkontext fehlt.');
    }
    const own = assignment.clientId === ctx.clientId;
    const shared = ctx.sharedClientIds?.includes(assignment.clientId) ?? false;
    return own || shared ? allow() : deny('not_own_client', 'Einsatz gehört nicht zum eigenen Klient:innenprofil.');
  }

  return deny('permission_denied', 'Keine Berechtigung für Einsatzansicht.');
}

export function canEditAssignment(
  ctx: WorkspaceAccessContext,
  assignment: AssignmentResource,
): WorkspaceAccessDecision {
  const view = canViewAssignment(ctx, assignment);
  if (!view.allowed) return view;
  if (!hasPermission(ctx.roleKey, 'assist.assignments.manage')) {
    return deny('permission_denied', 'Einsätze dürfen nur von der Verwaltung geplant werden.');
  }
  return allow();
}

export function canStartAssignment(
  ctx: WorkspaceAccessContext,
  assignment: AssignmentResource,
): WorkspaceAccessDecision {
  const view = canViewAssignment(ctx, assignment);
  if (!view.allowed) return view;

  if (hasPermission(ctx.roleKey, 'assist.assignments.manage')) {
    return allow();
  }

  if (hasPermission(ctx.roleKey, 'assist.execution.manage')) {
    if (!ctx.employeeId || assignment.employeeId !== ctx.employeeId) {
      return deny('not_assigned', 'Einsatz kann nur vom zugewiesenen Mitarbeitenden gestartet werden.');
    }
    return allow();
  }

  return deny('permission_denied', 'Einsatzstart nicht freigegeben.');
}

export function canCompleteAssignment(
  ctx: WorkspaceAccessContext,
  assignment: AssignmentResource,
): WorkspaceAccessDecision {
  return canStartAssignment(ctx, assignment);
}

export type ClientRecordResource = {
  tenantId: string;
  clientId: string;
  visibility?: 'office' | 'assignment' | 'shared' | 'own';
};

export function canViewClientRecord(
  ctx: WorkspaceAccessContext,
  record: ClientRecordResource,
): WorkspaceAccessDecision {
  const auth = assertAuth(ctx);
  if (auth) return auth;
  const tenant = assertTenantScope(ctx, record.tenantId);
  if (tenant) return tenant;

  if (isAdministrationRole(ctx.roleKey) && hasPermission(ctx.roleKey, 'office.clients.view')) {
    return allow();
  }

  if (isEmployeePortalRole(ctx.roleKey) || ctx.roleKey === 'employee_portal') {
    if (record.visibility === 'assignment' && ctx.clientId === record.clientId) {
      return allow();
    }
    return deny('permission_denied', 'Klient:innenakte nur im Einsatzkontext sichtbar.');
  }

  if (isClientPortalRole(ctx.roleKey)) {
    if (ctx.clientId === record.clientId) return allow();
    if (ctx.sharedClientIds?.includes(record.clientId)) return allow();
    return deny('not_shared_client', 'Klientendaten nicht freigegeben.');
  }

  return deny('permission_denied', 'Keine Berechtigung für Klient:innenakte.');
}

export type DocumentResource = {
  tenantId: string;
  clientId?: string | null;
  employeeId?: string | null;
  visibility: 'office' | 'shared' | 'own' | 'internal';
  documentType?: 'invoice' | 'contract' | 'service_proof' | 'documentation' | 'general';
};

export function canViewDocument(
  ctx: WorkspaceAccessContext,
  document: DocumentResource,
): WorkspaceAccessDecision {
  const auth = assertAuth(ctx);
  if (auth) return auth;
  const tenant = assertTenantScope(ctx, document.tenantId);
  if (tenant) return tenant;

  if (document.visibility === 'internal' && !isAdministrationRole(ctx.roleKey)) {
    return deny('document_not_shared', 'Internes Dokument nicht für Portale freigegeben.');
  }

  if (document.documentType === 'invoice' && !isAdministrationRole(ctx.roleKey)) {
    return deny('permission_denied', 'Rechnungen sind nur in der Verwaltung sichtbar.');
  }

  if (isAdministrationRole(ctx.roleKey) && hasPermission(ctx.roleKey, 'office.documents.view')) {
    return allow();
  }

  if (isEmployeePortalRole(ctx.roleKey) || ctx.roleKey === 'employee_portal') {
    if (
      hasPermission(ctx.roleKey, 'portal.employee.documents.view') &&
      (document.visibility === 'shared' || document.visibility === 'own')
    ) {
      return allow();
    }
    return deny('document_not_shared', 'Dokument nicht für Mitarbeitendenportal freigegeben.');
  }

  if (isClientPortalRole(ctx.roleKey)) {
    if (!hasPermission(ctx.roleKey, 'portal.client.documents.view')) {
      return deny('permission_denied', 'Dokumentenansicht nicht freigegeben.');
    }
    if (document.visibility === 'shared' || document.visibility === 'own') {
      if (!document.clientId || document.clientId === ctx.clientId || ctx.sharedClientIds?.includes(document.clientId)) {
        return allow();
      }
    }
    return deny('document_not_shared', 'Dokument nicht freigegeben.');
  }

  return deny('permission_denied', 'Keine Dokumentenberechtigung.');
}

export function canRequestReschedule(ctx: WorkspaceAccessContext): WorkspaceAccessDecision {
  const auth = assertAuth(ctx);
  if (auth) return auth;
  if (isClientPortalRole(ctx.roleKey) && hasPermission(ctx.roleKey, 'portal.client.appointments.request_change')) {
    return allow();
  }
  if (isAdministrationRole(ctx.roleKey)) {
    return allow();
  }
  return deny('permission_denied', 'Verschiebungsanfrage nicht freigegeben.');
}

export function canCancelVisitRequest(ctx: WorkspaceAccessContext): WorkspaceAccessDecision {
  return canRequestReschedule(ctx);
}

export function canViewAuditLog(ctx: WorkspaceAccessContext): WorkspaceAccessDecision {
  const auth = assertAuth(ctx);
  if (auth) return auth;
  if (isPortalOnlyRole(ctx.roleKey)) {
    return deny('audit_forbidden', 'Audit-Logs sind für Portale nicht sichtbar.');
  }
  if (ctx.roleKey === 'business_admin' || ctx.roleKey === 'business_manager') {
    return allow();
  }
  return deny('audit_forbidden', 'Audit-Logs nur für autorisierte Verwaltungsrollen.');
}

export function canDirectEmployeeClientChat(ctx: WorkspaceAccessContext): WorkspaceAccessDecision {
  return deny(
    'direct_chat_forbidden',
    'Direkte Mitarbeitende-Klient:innen-Chats sind nicht freigeschaltet — Kommunikation läuft über die Verwaltung.',
  );
}

export function assertWorkspaceAccess(
  action: string,
  ctx: WorkspaceAccessContext,
  check: () => WorkspaceAccessDecision,
  resource?: { type: string; id?: string | null },
): WorkspaceAccessDecision {
  const decision = check();
  logWorkspaceAccessEvent({
    tenantId: ctx.tenantId ?? 'unknown',
    userId: ctx.userId,
    roleKey: ctx.roleKey,
    action,
    resourceType: resource?.type ?? 'workspace',
    resourceId: resource?.id ?? null,
    outcome: decision.allowed ? 'allowed' : 'denied',
    code: decision.allowed ? undefined : decision.code,
    summary: decision.allowed ? `${action} erlaubt` : decision.message,
  });
  return decision;
}

export function filterAssignmentsForActor<T extends AssignmentResource>(
  items: T[],
  ctx: WorkspaceAccessContext,
): T[] {
  return items.filter((item) => canViewAssignment(ctx, item).allowed);
}

export function resolveWorkspaceAreaForPath(path: string): 'administration' | 'employee_portal' | 'client_portal' | null {
  if (path.startsWith('/portal/employee')) return 'employee_portal';
  if (path.startsWith('/portal/client') || path.startsWith('/portal/relative')) return 'client_portal';
  if (
    path.startsWith('/business') ||
    path.startsWith('/office') ||
    path.startsWith('/assist') ||
    path.startsWith('/pflege') ||
    path.startsWith('/beratung') ||
    path.startsWith('/stationaer') ||
    path.startsWith('/akademie') ||
    path.startsWith('/insight')
  ) {
    return 'administration';
  }
  return null;
}

export function checkWorkspaceAreaAccess(
  path: string,
  ctx: WorkspaceAccessContext,
): WorkspaceAccessDecision {
  const area = resolveWorkspaceAreaForPath(path);
  if (!area) return allow();

  switch (area) {
    case 'administration':
      return canAccessAdminArea(ctx);
    case 'employee_portal':
      return canAccessEmployeePortal(ctx);
    case 'client_portal':
      return canAccessClientPortal(ctx);
    default:
      return allow();
  }
}

export function canAccessOperationsMonitoring(ctx: WorkspaceAccessContext): WorkspaceAccessDecision {
  const admin = canAccessAdminArea(ctx);
  if (!admin.allowed) return admin;
  if (ctx.roleKey !== 'business_admin') {
    return deny('permission_denied', 'Betrieb & Monitoring nur für Mandanten-Administratoren.');
  }
  return allow();
}

export function isRoleAllowedForAdminRoute(roleKey: RoleKey | null): boolean {
  return canAccessAdminArea(buildWorkspaceAccessContext({ roleKey, tenantId: 'tenant', userId: 'u' })).allowed;
}

export { PORTAL_ONLY_ROLES, EMPLOYEE_PORTAL_ROLES, CLIENT_PORTAL_ROLES };
