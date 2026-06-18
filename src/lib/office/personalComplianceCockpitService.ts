import type { RoleKey, ServiceResult } from '@/types';
import type {
  CreatePersonalComplianceTaskInput,
  PersonalComplianceListFilter,
  PersonalComplianceSnapshot,
} from '@/types/modules/personalComplianceCockpit';
import type { ManagementTask } from '@/types/modules/liveMonitor';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';
import { createManagementTask } from '@/lib/assist/managementTaskService';
import {
  buildPersonalComplianceAccessContext,
  canManagePersonalComplianceTasks,
  canViewPersonalComplianceCockpit,
  filterPersonalComplianceRisksForViewer,
} from './personalComplianceAccess';
import {
  auditPersonalComplianceTaskCreated,
  auditPersonalComplianceView,
} from './personalcomplianceauditservice';
import {
  buildPersonalComplianceSnapshot,
  emptyPersonalComplianceSnapshot,
  filterPersonalComplianceSnapshot,
} from './personalComplianceCockpitBuilder';
import { seedDefaultComplianceItemsForTenant } from './complianceTrainingService';
import { COMPLIANCE_TRAINING_STORE } from './complianceTrainingStore';
import { seedPersonalComplianceDemoStore } from './personalComplianceStore';

async function ensureComplianceDemoSeed(tenantId: string): Promise<void> {
  if (COMPLIANCE_TRAINING_STORE.items.length === 0) {
    await seedDefaultComplianceItemsForTenant(tenantId, 'business_admin');
  }
}

export async function fetchPersonalComplianceCockpit(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
  filter?: PersonalComplianceListFilter,
): Promise<ServiceResult<PersonalComplianceSnapshot>> {
  const ctx = buildPersonalComplianceAccessContext({
    tenantId,
    roleKey: actorRoleKey ?? null,
    userId: actorId,
  });

  const access = canViewPersonalComplianceCockpit(ctx);
  if (!access.allowed) return { ok: false, error: access.reason ?? 'Kein Zugriff.' };

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const liveBlock = guardLiveDemoFeature<PersonalComplianceSnapshot>(
      tenantId,
      'Personal-Compliance-Cockpit',
    );
    if (liveBlock) {
      return {
        ok: true,
        data: {
          ...emptyPersonalComplianceSnapshot(tenantId),
          preparedOnly: true,
        },
      };
    }
  }

  return runService(async () => {
    seedPersonalComplianceDemoStore();
    await ensureComplianceDemoSeed(tenantId);

    const snapshot = buildPersonalComplianceSnapshot({ tenantId });
    const filtered = filterPersonalComplianceSnapshot(snapshot, filter);
    const visibleRisks = filterPersonalComplianceRisksForViewer(ctx, filtered.risks);

    auditPersonalComplianceView({
      tenantId,
      actorId: actorId ?? null,
      actorRole: actorRoleKey ?? null,
      kpiCount: filtered.kpis.length,
      riskCount: visibleRisks.length,
    });

    return {
      ok: true,
      data: { ...filtered, risks: visibleRisks },
    };
  }, { delayMs: 240 });
}

export async function createPersonalComplianceTask(
  input: CreatePersonalComplianceTaskInput,
): Promise<ServiceResult<ManagementTask>> {
  const ctx = buildPersonalComplianceAccessContext({
    tenantId: input.tenantId,
    roleKey: input.actorRole ?? null,
    userId: input.actorId,
  });

  const access = canViewPersonalComplianceCockpit(ctx);
  if (!access.allowed) return { ok: false, error: access.reason ?? 'Kein Zugriff.' };
  if (!canManagePersonalComplianceTasks(ctx)) {
    return { ok: false, error: 'Keine Berechtigung zum Anlegen von Personalaufgaben.' };
  }

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const liveBlock = guardLiveDemoFeature<ManagementTask>(
      input.tenantId,
      'Personal-Compliance-Aufgabe',
    );
    if (liveBlock) return liveBlock;
  }

  const denied = enforcePermission<ManagementTask>(input.actorRole ?? null, 'office.employees.edit');
  if (denied) return denied;

  const task = createManagementTask({
    tenantId: input.tenantId,
    taskType: 'master_data_review',
    title: input.title,
    description: input.description,
    employeeId: input.employeeId,
    dueAt: input.dueAt ?? null,
    priority: 'normal',
    createdBy: input.actorId ?? null,
    relatedEntityType: 'document',
    relatedEntityId: input.employeeId,
    metadata: { source: 'personal_compliance_cockpit' },
  });

  auditPersonalComplianceTaskCreated({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    taskId: task.id,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    title: input.title,
  });

  return { ok: true, data: task };
}

export function buildPersonalComplianceSnapshotForTests(
  tenantId: string,
  filter?: PersonalComplianceListFilter,
): PersonalComplianceSnapshot {
  seedPersonalComplianceDemoStore();
  const snapshot = buildPersonalComplianceSnapshot({ tenantId });
  return filterPersonalComplianceSnapshot(snapshot, filter);
}
