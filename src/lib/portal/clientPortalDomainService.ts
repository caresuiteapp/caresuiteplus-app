import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
import type {
  ClientPortalCompletedAssignment,
  ClientPortalContext,
  ClientPortalDashboard,
  ClientPortalDigitalFile,
  ClientPortalPlannedAssignment,
  ClientPortalVisitRequestSummary,
} from '@/types/portal/clientPortalDomain';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { getDemoClientPortalProfile } from '@/data/demo/portalClient';
import {
  getClientPortalAssignments,
  getAssignmentWorkflow,
} from '@/lib/assist/assignmentWorkflowService';
import { listClientVisitRequests } from '@/lib/assist/clientVisitRequestService';
import { enforcePermission } from '@/lib/permissions';
import {
  buildWorkspaceAccessContext,
  canAccessClientPortal,
  canViewAssignment,
} from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { getPortalProfileLink } from './portalVisibility';
import {
  buildClientPortalContext,
  countOpenClientPortalMessages,
  listClientPortalMessages,
} from './clientMessagePortalService';
import {
  countDocumentsToSign,
  listReleasedDocumentsForClient,
} from './clientDocumentSignatureService';

const COMPLETED_STATUSES = new Set(['completed', 'locked', 'cancelled']);
const PLANNED_STATUSES = new Set([
  'planned',
  'assigned',
  'confirmed',
  'cancel_requested',
  'reschedule_requested',
]);

function resolveEmployeeName(employeeId: string | null): string | null {
  if (!employeeId) return null;
  const employee = demoEmployees.find((e) => e.id === employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : null;
}

function isEmployeeNameReleased(assignment: AssignmentWorkflowRecord): boolean {
  return assignment.employeeId != null && assignment.canonicalStatus !== 'planned';
}

function canRequestChange(assignment: AssignmentWorkflowRecord): boolean {
  return (
    PLANNED_STATUSES.has(assignment.canonicalStatus) &&
    assignment.canonicalStatus !== 'cancelled' &&
    !assignment.lockedAt
  );
}

function mapPlannedAssignment(assignment: AssignmentWorkflowRecord): ClientPortalPlannedAssignment {
  return {
    id: assignment.id,
    assignmentId: assignment.id,
    date: assignment.plannedStartAt.slice(0, 10),
    startsAt: assignment.plannedStartAt,
    endsAt: assignment.plannedEndAt,
    durationMinutes: assignment.plannedDurationMinutes,
    serviceType: assignment.serviceType,
    status: assignment.canonicalStatus,
    employeeName: isEmployeeNameReleased(assignment)
      ? resolveEmployeeName(assignment.employeeId)
      : null,
    notes: assignment.clientVisibleNotes || null,
    canRequestCancel: canRequestChange(assignment),
    canRequestReschedule: canRequestChange(assignment),
  };
}

function mapCompletedAssignment(assignment: AssignmentWorkflowRecord): ClientPortalCompletedAssignment {
  const actualDuration =
    assignment.actualStartAt && assignment.actualEndAt
      ? Math.round(
          (new Date(assignment.actualEndAt).getTime() - new Date(assignment.actualStartAt).getTime()) /
            60_000,
        )
      : assignment.plannedDurationMinutes;

  return {
    id: assignment.id,
    assignmentId: assignment.id,
    date: (assignment.completedAt ?? assignment.plannedStartAt).slice(0, 10),
    actualDurationMinutes: assignment.canonicalStatus === 'completed' ? actualDuration : null,
    serviceType: assignment.serviceType,
    status: assignment.canonicalStatus,
    serviceProofReleased:
      assignment.canonicalStatus === 'completed' && assignment.requiresSignature,
    shortReport: assignment.clientVisibleNotes || null,
    releasedDocumentIds: [],
  };
}

function mapVisitRequests(
  tenantId: string,
  clientId: string,
): ClientPortalVisitRequestSummary[] {
  return listClientVisitRequests(tenantId)
    .filter((r) => r.clientId === clientId)
    .map((r) => ({
      id: r.id,
      assignmentId: r.assignmentId,
      requestType: r.requestType,
      status: r.status,
      reason: r.reason,
      requestedAt: r.requestedAt,
    }));
}

function filterAssignmentsForContext(
  ctx: ClientPortalContext,
  assignments: AssignmentWorkflowRecord[],
): AssignmentWorkflowRecord[] {
  const accessCtx = buildWorkspaceAccessContext({
    userId: ctx.profileId,
    tenantId: ctx.tenantId,
    roleKey: ctx.roleKey,
    clientId: ctx.clientId,
    sharedClientIds: ctx.sharedClientIds,
  });

  return assignments.filter((a) =>
    canViewAssignment(accessCtx, {
      tenantId: a.tenantId,
      employeeId: a.employeeId ?? '',
      clientId: a.clientId,
    }).allowed,
  );
}

export function resolveClientPortalContext(input: {
  tenantId: string;
  profileId: string;
  roleKey: RoleKey;
  clientId?: string | null;
  sharedClientIds?: string[];
}): ServiceResult<ClientPortalContext> {
  const denied = enforcePermission<ClientPortalContext>(input.roleKey, 'portal.client.appointments.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const link = getPortalProfileLink(input.profileId);
  const clientId = input.clientId ?? link.clientId ?? null;
  const ctx = buildClientPortalContext({
    tenantId: input.tenantId,
    profileId: input.profileId,
    roleKey: input.roleKey,
    clientId,
    sharedClientIds: input.sharedClientIds,
  });

  if (!ctx) {
    return { ok: false, error: 'Kein Klient:innenkontext für Portal verfügbar.' };
  }

  const access = canAccessClientPortal(
    buildWorkspaceAccessContext({
      userId: ctx.profileId,
      tenantId: ctx.tenantId,
      roleKey: ctx.roleKey,
      clientId: ctx.clientId,
      sharedClientIds: ctx.sharedClientIds,
    }),
  );
  if (!access.allowed) {
    return { ok: false, error: access.message ?? 'Portalzugriff verweigert.' };
  }

  return { ok: true, data: ctx };
}

export function assertClientPortalProductionSafe(
  tenantId: string,
  usesDemoFallback = false,
): { ok: false; error: string } | null {
  if (getServiceMode() === 'supabase' && usesDemoFallback) {
    return {
      ok: false,
      error: 'Demo-Fallback im Production Mode blockiert.',
    };
  }

  const liveBlock = guardLiveDemoFeature(tenantId, 'Klient:innenportal');
  if (liveBlock && !liveBlock.ok && usesDemoFallback) return liveBlock;
  return null;
}

export async function fetchClientPortalDashboard(
  ctx: ClientPortalContext,
): Promise<ServiceResult<ClientPortalDashboard>> {
  const denied = enforcePermission<ClientPortalDashboard>(ctx.roleKey, 'portal.client.profile.view');
  if (denied) return denied;

  const productionBlock = assertClientPortalProductionSafe(ctx.tenantId, false);
  if (productionBlock) return productionBlock;

  const all = filterAssignmentsForContext(
    ctx,
    getClientPortalAssignments(ctx.tenantId, ctx.clientId, ctx.roleKey),
  );

  const planned = all
    .filter((a) => !COMPLETED_STATUSES.has(a.canonicalStatus))
    .sort((a, b) => new Date(a.plannedStartAt).getTime() - new Date(b.plannedStartAt).getTime())
    .map(mapPlannedAssignment);

  const completed = all
    .filter((a) => a.canonicalStatus === 'completed')
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? b.plannedStartAt).getTime() -
        new Date(a.completedAt ?? a.plannedStartAt).getTime(),
    )
    .slice(0, 5)
    .map(mapCompletedAssignment);

  const profile = getDemoClientPortalProfile(ctx.clientId, ctx.profileId);

  return {
    ok: true,
    data: {
      nextPlannedAssignment: planned[0] ?? null,
      upcomingAssignments: planned.slice(0, 5),
      recentCompleted: completed,
      openMessageCount: countOpenClientPortalMessages(ctx),
      documentsToSign: countDocumentsToSign(ctx),
      visitRequestStatuses: mapVisitRequests(ctx.tenantId, ctx.clientId),
      adminNotices: ['Bitte halten Sie Ihre Kontaktdaten aktuell.'],
      importantContacts: profile?.emergencyContact
        ? [{ label: 'Notfallkontakt', phone: profile.primaryContactPhone }]
        : [],
    },
  };
}

export async function fetchClientPlannedAssignments(
  ctx: ClientPortalContext,
): Promise<ServiceResult<ClientPortalPlannedAssignment[]>> {
  const denied = enforcePermission<ClientPortalPlannedAssignment[]>(
    ctx.roleKey,
    'portal.client.appointments.view',
  );
  if (denied) return denied;

  const assignments = filterAssignmentsForContext(
    ctx,
    getClientPortalAssignments(ctx.tenantId, ctx.clientId, ctx.roleKey),
  ).filter((a) => !COMPLETED_STATUSES.has(a.canonicalStatus));

  return {
    ok: true,
    data: assignments
      .sort((a, b) => new Date(a.plannedStartAt).getTime() - new Date(b.plannedStartAt).getTime())
      .map(mapPlannedAssignment),
  };
}

export async function fetchClientCompletedAssignments(
  ctx: ClientPortalContext,
): Promise<ServiceResult<ClientPortalCompletedAssignment[]>> {
  const denied = enforcePermission<ClientPortalCompletedAssignment[]>(
    ctx.roleKey,
    'portal.client.appointments.view',
  );
  if (denied) return denied;

  const assignments = filterAssignmentsForContext(
    ctx,
    getClientPortalAssignments(ctx.tenantId, ctx.clientId, ctx.roleKey),
  ).filter((a) => a.canonicalStatus === 'completed');

  return {
    ok: true,
    data: assignments
      .sort(
        (a, b) =>
          new Date(b.completedAt ?? b.plannedStartAt).getTime() -
          new Date(a.completedAt ?? a.plannedStartAt).getTime(),
      )
      .map(mapCompletedAssignment),
  };
}

export async function fetchClientDigitalFile(
  ctx: ClientPortalContext,
): Promise<ServiceResult<ClientPortalDigitalFile>> {
  const denied = enforcePermission<ClientPortalDigitalFile>(ctx.roleKey, 'portal.client.profile.view');
  if (denied) return denied;

  const client = demoClients.find((c) => c.id === ctx.clientId);
  if (!client) {
    return { ok: false, error: 'Klient:innenprofil nicht gefunden.' };
  }

  const [planned, completed] = await Promise.all([
    fetchClientPlannedAssignments(ctx),
    fetchClientCompletedAssignments(ctx),
  ]);
  if (!planned.ok) return planned;
  if (!completed.ok) return completed;

  const released = listReleasedDocumentsForClient(ctx);

  return {
    ok: true,
    data: {
      masterData: {
        displayName: `${client.firstName} ${client.lastName}`,
        city: client.city ?? null,
        zip: client.zip ?? null,
        careLevel: formatCareLevel(client.careLevel) || null,
      },
      contracts: released.filter((d) => d.category === 'contract'),
      consents: released.filter((d) => d.category === 'consent'),
      plannedAssignments: planned.data,
      completedAssignments: completed.data,
      releasedDocuments: released,
      messages: listClientPortalMessages(ctx),
      visitRequests: mapVisitRequests(ctx.tenantId, ctx.clientId),
    },
  };
}

/** Prüft, ob ein Einsatz interne Notizen enthält — diese werden im Portal nie zurückgegeben. */
export function stripInternalAssignmentFields(
  assignment: AssignmentWorkflowRecord,
): Omit<AssignmentWorkflowRecord, 'internalNotes' | 'notesForEmployee'> {
  const { internalNotes: _i, notesForEmployee: _n, ...safe } = assignment;
  return safe;
}

export function getClientPortalAssignmentDetail(
  ctx: ClientPortalContext,
  assignmentId: string,
): ServiceResult<ClientPortalPlannedAssignment | ClientPortalCompletedAssignment> {
  const assignment = getAssignmentWorkflow(ctx.tenantId, assignmentId);
  if (!assignment) {
    return { ok: false, error: 'Einsatz nicht gefunden.' };
  }

  const accessCtx = buildWorkspaceAccessContext({
    userId: ctx.profileId,
    tenantId: ctx.tenantId,
    roleKey: ctx.roleKey,
    clientId: ctx.clientId,
    sharedClientIds: ctx.sharedClientIds,
  });
  const view = canViewAssignment(accessCtx, {
    tenantId: assignment.tenantId,
    employeeId: assignment.employeeId ?? '',
    clientId: assignment.clientId,
  });
  if (!view.allowed) {
    return { ok: false, error: view.message ?? 'Kein Zugriff auf diesen Einsatz.' };
  }

  if (assignment.canonicalStatus === 'completed') {
    return { ok: true, data: mapCompletedAssignment(assignment) };
  }
  return { ok: true, data: mapPlannedAssignment(assignment) };
}
