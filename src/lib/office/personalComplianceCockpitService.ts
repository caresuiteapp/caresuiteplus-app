import type { RoleKey, ServiceResult } from '@/types';
import type {
  CreatePersonalComplianceTaskInput,
  PersonalComplianceAuditEvent,
  PersonalComplianceListFilter,
  PersonalComplianceSnapshot,
} from '@/types/modules/personalComplianceCockpit';
import { createManagementTask } from '@/lib/assist/managementTaskService';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import {
  buildPersonalComplianceAccessContext,
  canManagePersonalComplianceTasks,
  canViewPersonalComplianceCockpit,
  filterPersonalComplianceRisksForViewer,
} from './personalComplianceAccess';
import {
  buildPersonalComplianceSnapshot,
  filterPersonalComplianceSnapshot,
} from './personalComplianceCockpitBuilder';
import { resetPersonalComplianceStore, seedPersonalComplianceDemoStore } from './personalComplianceStore';
import { resetTrainingStoreForTests, seedTrainingDemoStore } from '@/lib/training/trainingStore';

export const PERSONAL_COMPLIANCE_PREPARED_MESSAGE =
  'Personal-Compliance-Cockpit nutzt vorbereitete Mandantendaten — Live-Persistenz über geplante Migration.';

export const PERSONAL_COMPLIANCE_COCKPIT_ROUTE = '/business/office/personal/compliance';

const auditEvents: PersonalComplianceAuditEvent[] = [];
let auditCounter = 0;

export function isPersonalComplianceLiveReady(): boolean {
  return false;
}

function nextAuditId(): string {
  auditCounter += 1;
  return `pc-audit-${auditCounter}`;
}

export function appendPersonalComplianceAuditEvent(
  event: Omit<PersonalComplianceAuditEvent, 'id' | 'createdAt'>,
): PersonalComplianceAuditEvent {
  const full: PersonalComplianceAuditEvent = {
    id: nextAuditId(),
    createdAt: new Date().toISOString(),
    ...event,
  };
  auditEvents.push(full);
  return full;
}

export function listPersonalComplianceAuditEvents(
  tenantId: string,
  employeeId?: string,
): PersonalComplianceAuditEvent[] {
  return auditEvents.filter(
    (e) => e.tenantId === tenantId && (!employeeId || e.employeeId === employeeId),
  );
}

export function resetPersonalComplianceCockpitState(): void {
  resetPersonalComplianceStore();
  resetTrainingStoreForTests();
  auditEvents.length = 0;
  auditCounter = 0;
}

export function fetchPersonalComplianceSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  filter?: PersonalComplianceListFilter,
  workspaceContext?: { userId?: string | null; employeeId?: string | null },
): ServiceResult<PersonalComplianceSnapshot> {
  const accessCtx = buildPersonalComplianceAccessContext({
    tenantId,
    roleKey: actorRoleKey ?? null,
    userId: workspaceContext?.userId,
    employeeId: workspaceContext?.employeeId,
  });

  const access = canViewPersonalComplianceCockpit(accessCtx);
  if (!access.allowed) {
    return { ok: false, error: access.reason ?? 'Kein Zugriff.' };
  }

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const liveBlock = guardLiveDemoFeature<PersonalComplianceSnapshot>(
      tenantId,
      'Personal-Compliance-Cockpit',
    );
    if (liveBlock) return liveBlock;
  }

  seedTrainingDemoStore();
  seedPersonalComplianceDemoStore();

  const built = buildPersonalComplianceSnapshot({ tenantId });
  const filtered = filterPersonalComplianceSnapshot(built, filter);
  const snapshot: PersonalComplianceSnapshot = {
    ...filtered,
    risks: filterPersonalComplianceRisksForViewer(accessCtx, filtered.risks),
    preparedOnly: !isPersonalComplianceLiveReady(),
  };

  appendPersonalComplianceAuditEvent({
    tenantId,
    action: 'cockpit.viewed',
    employeeId: null,
    actorId: workspaceContext?.userId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: `Personal-Compliance-Cockpit abgerufen (${snapshot.risks.length} Risiken)`,
    metadata: { kpiCount: String(snapshot.kpis.length) },
  });

  return { ok: true, data: snapshot };
}

export function createPersonalComplianceTaskFromRisk(input: {
  tenantId: string;
  riskId: string;
  actorRoleKey?: RoleKey | null;
  actorId?: string | null;
}): ServiceResult<{ taskId: string }> {
  const accessCtx = buildPersonalComplianceAccessContext({
    tenantId: input.tenantId,
    roleKey: input.actorRoleKey ?? null,
    userId: input.actorId,
  });

  if (!canManagePersonalComplianceTasks(accessCtx)) {
    return { ok: false, error: 'Keine Berechtigung zum Anlegen von Personalaufgaben.' };
  }

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const liveBlock = guardLiveDemoFeature<{ taskId: string }>(
      input.tenantId,
      'Personal-Compliance-Cockpit',
    );
    if (liveBlock) return liveBlock;
  }

  const snapshotResult = fetchPersonalComplianceSnapshot(
    input.tenantId,
    input.actorRoleKey,
    undefined,
    { userId: input.actorId },
  );
  if (!snapshotResult.ok) return snapshotResult;

  const risk = snapshotResult.data.risks.find((r) => r.id === input.riskId);
  if (!risk) {
    return { ok: false, error: 'Risiko nicht gefunden.' };
  }

  const taskType =
    risk.code === 'document_missing'
      ? 'missing_contract'
      : risk.code === 'not_deployable'
        ? 'master_data_review'
        : risk.code === 'open_correction'
          ? 'correction_review'
          : 'audit_review';

  const task = createManagementTask({
    tenantId: input.tenantId,
    taskType,
    title: `Personal: ${risk.title}`,
    description: risk.message,
    priority: risk.severity === 'critical' ? 'high' : 'normal',
    employeeId: risk.employeeId,
    relatedEntityType: 'document',
    relatedEntityId: risk.relatedEntityId,
    createdBy: input.actorId ?? null,
    metadata: {
      personalComplianceRiskId: risk.id,
      dataSource: risk.dataSource,
    },
    dedupeKey: `${input.tenantId}:personal_compliance:${risk.id}`,
  });

  appendPersonalComplianceAuditEvent({
    tenantId: input.tenantId,
    action: 'management_task.created',
    employeeId: risk.employeeId,
    actorId: input.actorId ?? null,
    actorRole: input.actorRoleKey ?? null,
    summary: `Verwaltungsaufgabe aus Personal-Compliance erstellt: ${task.title}`,
    metadata: { riskId: risk.id, dataSource: risk.dataSource },
  });

  return { ok: true, data: { taskId: task.id } };
}

export function createPersonalComplianceTask(
  input: CreatePersonalComplianceTaskInput,
): ServiceResult<{ taskId: string }> {
  const accessCtx = buildPersonalComplianceAccessContext({
    tenantId: input.tenantId,
    roleKey: input.actorRole ?? null,
    userId: input.actorId,
  });

  if (!canManagePersonalComplianceTasks(accessCtx)) {
    return { ok: false, error: 'Keine Berechtigung zum Anlegen von Personalaufgaben.' };
  }

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const liveBlock = guardLiveDemoFeature<{ taskId: string }>(
      input.tenantId,
      'Personal-Compliance-Cockpit',
    );
    if (liveBlock) return liveBlock;
  }

  const task = createManagementTask({
    tenantId: input.tenantId,
    taskType: 'master_data_review',
    title: input.title,
    description: input.description,
    priority: 'normal',
    employeeId: input.employeeId,
    relatedEntityType: 'document',
    relatedEntityId: input.employeeId,
    dueAt: input.dueAt ?? null,
    createdBy: input.actorId ?? null,
    metadata: { source: 'personal_compliance_cockpit' },
    dedupeKey: `${input.tenantId}:personal_compliance:manual:${input.employeeId}:${input.title}`,
  });

  appendPersonalComplianceAuditEvent({
    tenantId: input.tenantId,
    action: 'management_task.created',
    employeeId: input.employeeId,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    summary: `Personalaufgabe manuell erstellt: ${input.title}`,
  });

  return { ok: true, data: { taskId: task.id } };
}
