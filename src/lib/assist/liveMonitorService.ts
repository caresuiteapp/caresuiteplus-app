import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type {
  DayMonitorAssignmentRow,
  DayMonitorDisplayStatus,
  LiveMonitorActorContext,
} from '@/types/modules/liveMonitor';
import { DAY_MONITOR_STATUS_COLORS } from '@/types/modules/liveMonitor';
import { enforcePermission } from '@/lib/permissions';
import { buildWorkspaceAccessContext, canStartAssignment, canViewAssignment } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';
import { validateAssignmentTransition } from './assignmentStatusMachine';
import {
  getAssignmentWorkflow,
  listAssignmentWorkflows,
  type AssignmentWorkflowRecord,
} from './assignmentWorkflowService';
import { LIVE_MONITOR_STORE } from './liveMonitorStore';
import { upsertAssignmentForMonitor } from './liveMonitorStoreBridge';
import { handleStatusSideEffects } from './liveMonitorOrchestrator';

function isToday(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function resolveDisplayStatus(record: AssignmentWorkflowRecord): DayMonitorDisplayStatus {
  if (record.canonicalStatus === 'cancel_requested') return 'abgesagt';
  if (record.canonicalStatus === 'reschedule_requested') return 'verschoben';

  const hasEmergency = LIVE_MONITOR_STORE.emergencyReports.some(
    (r) => r.tenantId === record.tenantId && r.assignmentId === record.id,
  );
  const hasProblem = LIVE_MONITOR_STORE.problemReports.some(
    (r) => r.tenantId === record.tenantId && r.assignmentId === record.id,
  );
  if (hasEmergency || hasProblem) return 'kritisch';

  const map: Partial<Record<AssignmentStatus, DayMonitorDisplayStatus>> = {
    geplant: 'geplant',
    bestaetigt: 'geplant',
    unterwegs: 'unterwegs',
    angekommen: 'angekommen',
    gestartet: 'gestartet',
    pausiert: 'pausiert',
    beendet: 'beendet',
    dokumentation_offen: 'doku_fehlt',
    unterschrift_offen: 'signatur_fehlt',
    abgeschlossen: 'abgeschlossen',
    storniert: 'abgesagt',
    nicht_erschienen: 'nicht_angetroffen',
  };
  return map[record.status] ?? 'geplant';
}

function computeDelayMinutes(plannedStart: string, actualStart: string | null): number | null {
  if (!actualStart) return null;
  return Math.round((new Date(actualStart).getTime() - new Date(plannedStart).getTime()) / 60_000);
}

function computeOverrunMinutes(plannedEnd: string, actualEnd: string | null): number | null {
  if (!actualEnd) return null;
  const diff = Math.round((new Date(actualEnd).getTime() - new Date(plannedEnd).getTime()) / 60_000);
  return diff > 0 ? diff : null;
}

function buildDayMonitorRow(record: AssignmentWorkflowRecord): DayMonitorAssignmentRow {
  const displayStatus = resolveDisplayStatus(record);

  const hasEmergency = LIVE_MONITOR_STORE.emergencyReports.some(
    (r) => r.tenantId === record.tenantId && r.assignmentId === record.id,
  );
  const hasProblem = LIVE_MONITOR_STORE.problemReports.some(
    (r) => r.tenantId === record.tenantId && r.assignmentId === record.id,
  );

  return {
    assignmentId: record.id,
    tenantId: record.tenantId,
    title: record.title,
    employeeId: record.employeeId,
    clientId: record.clientId,
    status: record.status,
    canonicalStatus: record.canonicalStatus,
    displayStatus,
    statusColor: DAY_MONITOR_STATUS_COLORS[displayStatus],
    plannedStartAt: record.plannedStartAt,
    plannedEndAt: record.plannedEndAt,
    actualStartAt: record.actualStartAt,
    actualEndAt: record.actualEndAt,
    delayMinutes: computeDelayMinutes(record.plannedStartAt, record.actualStartAt),
    overrunMinutes: computeOverrunMinutes(record.plannedEndAt, record.actualEndAt),
    docStatus: record.requiresDocumentation
      ? record.status === 'dokumentation_offen' || (record.status === 'beendet' && !record.completedAt)
        ? 'missing'
        : 'ok'
      : 'na',
    signatureStatus: record.requiresSignature
      ? record.status === 'unterschrift_offen'
        ? 'missing'
        : 'ok'
      : 'na',
    problemStatus: hasEmergency ? 'emergency' : hasProblem ? 'reported' : 'none',
    cancelRequest: record.canonicalStatus === 'cancel_requested',
    rescheduleRequest: record.canonicalStatus === 'reschedule_requested',
  };
}

export function fetchDayMonitor(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  actorContext?: LiveMonitorActorContext,
): ServiceResult<DayMonitorAssignmentRow[]> {
  const denied = enforcePermission<DayMonitorAssignmentRow[]>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;

  if (!tenantId?.trim()) {
    return { ok: false, error: 'Kein Live-Monitor ohne tenant_id.' };
  }

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const liveBlock = guardLiveDemoFeature<DayMonitorAssignmentRow[]>(tenantId, 'Live-Monitor');
    if (liveBlock) return liveBlock;
  }

  const ctx = buildWorkspaceAccessContext({
    tenantId,
    roleKey: actorRoleKey ?? null,
    userId: actorContext?.userId ?? 'demo-user',
    employeeId: actorContext?.employeeId ?? null,
    clientId: actorContext?.clientId ?? null,
  });

  const rows = listAssignmentWorkflows(tenantId)
    .filter((a) => isToday(a.plannedStartAt))
    .filter((a) =>
      canViewAssignment(ctx, {
        tenantId: a.tenantId,
        employeeId: a.employeeId ?? '',
        clientId: a.clientId,
      }).allowed,
    )
    .map(buildDayMonitorRow);

  return { ok: true, data: rows };
}

export function transitionAssignmentLiveStatus(
  tenantId: string,
  assignmentId: string,
  toStatus: AssignmentStatus,
  actor: LiveMonitorActorContext & { actorRoleKey?: RoleKey | null },
): ServiceResult<AssignmentWorkflowRecord> {
  if (!tenantId?.trim()) {
    return { ok: false, error: 'Kein Statuswechsel ohne tenant_id.' };
  }

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const assignment = getAssignmentWorkflow(tenantId, assignmentId);
  if (!assignment) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const ctx = buildWorkspaceAccessContext({
    tenantId,
    roleKey: actor.actorRoleKey ?? null,
    userId: actor.userId ?? 'demo-user',
    employeeId: actor.employeeId ?? null,
  });

  const isAdmin = canViewAssignment(ctx, {
    tenantId: assignment.tenantId,
    employeeId: assignment.employeeId ?? '',
    clientId: assignment.clientId,
  }).allowed && (actor.actorRoleKey === 'business_admin' || actor.actorRoleKey === 'dispatch');

  if (!isAdmin) {
    const startCheck = canStartAssignment(ctx, {
      tenantId: assignment.tenantId,
      employeeId: assignment.employeeId ?? '',
      clientId: assignment.clientId,
    });
    if (!startCheck.allowed) {
      return { ok: false, error: startCheck.message ?? 'Statuswechsel nicht erlaubt.' };
    }
  }

  const validation = validateAssignmentTransition(assignment.status, toStatus);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  const oldStatus = assignment.status;
  const now = new Date().toISOString();
  const timestampPatch: Partial<AssignmentWorkflowRecord> = {};

  if (toStatus === 'unterwegs' && !assignment.actualStartAt) {
    timestampPatch.actualStartAt = now;
  }
  if (toStatus === 'gestartet' && !assignment.actualStartAt) {
    timestampPatch.actualStartAt = now;
  }
  if (toStatus === 'abgeschlossen') {
    timestampPatch.actualEndAt = now;
    timestampPatch.completedAt = now;
  }
  if (toStatus === 'beendet' && !assignment.actualEndAt) {
    timestampPatch.actualEndAt = now;
  }

  let canonicalStatus = assignment.canonicalStatus;
  if (toStatus === 'dokumentation_offen') canonicalStatus = 'documentation_pending';
  if (toStatus === 'unterschrift_offen') canonicalStatus = 'signature_pending';
  if (toStatus === 'abgeschlossen') canonicalStatus = 'completed';

  const updated: AssignmentWorkflowRecord = {
    ...assignment,
    ...timestampPatch,
    status: toStatus,
    canonicalStatus,
    updatedAt: now,
  };

  upsertAssignmentForMonitor(updated);

  handleStatusSideEffects({
    tenantId,
    assignmentId,
    clientId: assignment.clientId,
    employeeId: assignment.employeeId,
    oldStatus,
    newStatus: toStatus,
    actorUserId: actor.userId,
    actorRole: actor.actorRoleKey ?? actor.roleKey ?? null,
    source: actor.source ?? 'employee_portal',
    metadata: actor.locationNote ? { locationNote: actor.locationNote } : undefined,
  });

  return { ok: true, data: updated };
}

export function isProductionLiveMonitorSafe(): boolean {
  if (isDemoMode()) return true;
  return getServiceMode() === 'supabase';
}

export function wouldEmitFakeLiveData(): boolean {
  return isDemoMode() && getServiceMode() !== 'supabase';
}
