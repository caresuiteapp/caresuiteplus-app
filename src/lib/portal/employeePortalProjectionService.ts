/**
 * Employee portal projections — assignment-scoped, no budget/invoices/full record.
 */
import type { RoleKey, ServiceResult } from '@/types';
import type {
  EmployeePortalDashboardProjection,
  EmployeePortalProjection,
  EmployeePortalVisitProjection,
} from '@/types/portalSystem';
import type { EmployeePortalAssignmentListItem } from '@/types/modules/employeePortalExecution';
import {
  getAllowedClientFieldsForEmployeeVisit,
  getEmployeePortalImpactSummary,
  sanitizeEmployeePortalPayload,
} from './portalVisibilityService';
import {
  fetchEmployeePortalAssignmentDetail,
  fetchEmployeePortalOverview,
} from './employeePortalExecutionService';
import {
  buildEmployeePortalDashboardFromOverview,
} from './employeePortalLiveOverviewService';
import { fetchLiveEmployeePortalOverviewWrapped } from './employeePortalExecutionLiveService';
import { fetchPortalSignatureDashboardCounts } from './portalDocumentSignatureService';
import { listAssignmentWorkflows } from '@/lib/assist/assignmentWorkflowService';
import { canViewAccessHints, canViewEmergencyContact } from './employeePortalModuleAccess';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';

export function canEmployeePortalSeeVisit(
  tenantId: string,
  employeeId: string,
  assignmentId: string,
  assignedEmployeeId: string | null | undefined,
): boolean {
  if (!tenantId || !employeeId || !assignmentId) return false;
  return assignedEmployeeId === employeeId;
}

export function canEmployeePortalSeeClientField(
  field: string,
  roleKey: RoleKey | null,
): boolean {
  const allowed = getAllowedClientFieldsForEmployeeVisit({
    showAccessHints: canViewAccessHints(roleKey),
    showEmergencyContact: canViewEmergencyContact(roleKey),
  });
  return allowed.includes(field as never);
}

function mapListItemToVisitProjection(
  item: EmployeePortalAssignmentListItem,
  roleKey: RoleKey | null,
): EmployeePortalVisitProjection {
  const allowed = getAllowedClientFieldsForEmployeeVisit({
    showAccessHints: canViewAccessHints(roleKey),
    showEmergencyContact: canViewEmergencyContact(roleKey),
  });

  const clientSlice: EmployeePortalVisitProjection['client'] = {};
  if (allowed.includes('displayName')) clientSlice.displayName = item.clientName;
  if (allowed.includes('street')) clientSlice.street = item.locationAddress || null;

  return sanitizeEmployeePortalPayload({
    assignmentId: item.assignmentId,
    visitId: null,
    title: item.title,
    scheduledStart: item.plannedStartAt,
    scheduledEnd: item.plannedEndAt,
    status: item.status,
    serviceName: null,
    client: clientSlice,
    executionHref: `/portal/employee/assignments/${item.assignmentId}/execute`,
  }) as EmployeePortalVisitProjection;
}

export async function getEmployeeAssignedVisitsProjection(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<EmployeePortalVisitProjection[]>> {
  return runService(async () => {
    const overview =
      getServiceMode() === 'supabase'
        ? await fetchLiveEmployeePortalOverviewWrapped(tenantId, employeeId, roleKey)
        : await fetchEmployeePortalOverview(tenantId, employeeId, roleKey);
    if (!overview.ok) return overview;

    const items = overview.data.weeklyPlan
      .filter((row) => canEmployeePortalSeeVisit(tenantId, employeeId, row.assignmentId, employeeId))
      .map((row) => mapListItemToVisitProjection(row, roleKey));

    return { ok: true, data: items };
  });
}

export async function getEmployeePortalVisitProjection(
  tenantId: string,
  employeeId: string,
  assignmentId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<EmployeePortalVisitProjection | null>> {
  return runService(async () => {
    const detail = await fetchEmployeePortalAssignmentDetail(
      tenantId,
      assignmentId,
      employeeId,
      roleKey,
    );
    if (!detail.ok) return detail;

    if (!canEmployeePortalSeeVisit(tenantId, employeeId, assignmentId, employeeId)) {
      return { ok: false, error: 'Einsatz nicht zugewiesen.' };
    }

    if (getServiceMode() !== 'supabase') {
      const record = listAssignmentWorkflows(tenantId).find((a) => a.id === assignmentId);
      if (!canEmployeePortalSeeVisit(tenantId, employeeId, assignmentId, record?.employeeId)) {
        return { ok: false, error: 'Einsatz nicht zugewiesen.' };
      }
    }

    const allowed = getAllowedClientFieldsForEmployeeVisit({
      showAccessHints: canViewAccessHints(roleKey),
      showEmergencyContact: canViewEmergencyContact(roleKey),
    });

    const clientSlice: EmployeePortalVisitProjection['client'] = {};
    if (allowed.includes('displayName')) clientSlice.displayName = detail.data.clientName;
    if (allowed.includes('street')) clientSlice.street = detail.data.locationAddress || null;
    if (allowed.includes('accessHint') && detail.data.accessHints) {
      clientSlice.accessHint = detail.data.accessHints;
    }
    if (allowed.includes('emergencyContact') && detail.data.emergencyContact) {
      clientSlice.emergencyContact = detail.data.emergencyContact;
    }

    return {
      ok: true,
      data: sanitizeEmployeePortalPayload({
        assignmentId: detail.data.assignmentId,
        visitId: null,
        title: detail.data.title,
        scheduledStart: detail.data.plannedStartAt,
        scheduledEnd: detail.data.plannedEndAt,
        status: detail.data.status,
        serviceName: null,
        client: clientSlice,
        executionHref: `/portal/employee/assignments/${detail.data.assignmentId}/execute`,
      }) as EmployeePortalVisitProjection,
    };
  });
}

export async function getEmployeePortalDashboardProjection(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<EmployeePortalDashboardProjection>> {
  return runService(async () => {
    if (getServiceMode() === 'supabase') {
      const liveOverview = await fetchLiveEmployeePortalOverviewWrapped(tenantId, employeeId, roleKey);
      if (!liveOverview.ok) return liveOverview;
      const dashboard = buildEmployeePortalDashboardFromOverview(liveOverview.data);
      const sigCounts = await fetchPortalSignatureDashboardCounts(
        tenantId,
        employeeId,
        roleKey,
      );
      if (sigCounts.ok && sigCounts.data) {
        dashboard.openSignatureDocumentCount = sigCounts.data.openCount;
        dashboard.overdueSignatureDocumentCount = sigCounts.data.overdueCount;
      }
      return { ok: true, data: dashboard };
    }

    const overview = await fetchEmployeePortalOverview(tenantId, employeeId, roleKey);
    if (!overview.ok) return overview;

    const dashboard = buildEmployeePortalDashboardFromOverview(overview.data);
    const sigCounts = await fetchPortalSignatureDashboardCounts(
      tenantId,
      employeeId,
      roleKey,
    );
    if (sigCounts.ok && sigCounts.data) {
      dashboard.openSignatureDocumentCount = sigCounts.data.openCount;
      dashboard.overdueSignatureDocumentCount = sigCounts.data.overdueCount;
    }

    return { ok: true, data: dashboard };
  });
}

export async function getEmployeePortalTaskProjection(
  tenantId: string,
  employeeId: string,
  assignmentId: string,
  roleKey: RoleKey | null,
) {
  return fetchEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId, roleKey);
}

export async function getEmployeePortalTimeAndDriveProjection(
  tenantId: string,
  _employeeId: string,
  assignmentId: string,
): Promise<ServiceResult<{ assignmentId: string; trackingAllowed: true; budgetVisible: false }>> {
  void tenantId;
  return runService(async () => ({
    ok: true,
    data: {
      assignmentId,
      trackingAllowed: true,
      budgetVisible: false as const,
    },
  }));
}

export async function getEmployeePortalProjection(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<EmployeePortalProjection>> {
  return runService(async () => {
    const overview =
      getServiceMode() === 'supabase'
        ? await fetchLiveEmployeePortalOverviewWrapped(tenantId, employeeId, roleKey)
        : await fetchEmployeePortalOverview(tenantId, employeeId, roleKey);
    if (!overview.ok) return overview;

    const assigned = await getEmployeeAssignedVisitsProjection(tenantId, employeeId, roleKey);
    if (!assigned.ok) return assigned;

    const impact = getEmployeePortalImpactSummary();

    return {
      ok: true,
      data: {
        tenantId,
        employeeId,
        overview: overview.data,
        assignedVisits: assigned.data,
        dashboard: {
          todayAssignments: overview.data.todayAssignments,
          upcomingAssignments: overview.data.nextAssignments,
          openTasks: [],
          openDocumentationCount: overview.data.openDocumentations,
          missingSignatureCount: overview.data.missingSignatures,
          messageCount: overview.data.adminMessageCount,
        },
        blockedFields: impact.blockedClientFields,
      },
    };
  });
}
