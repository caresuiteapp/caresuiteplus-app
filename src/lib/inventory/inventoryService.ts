import type { RoleKey, ServiceResult } from '@/types';
import type {
  CreateInventoryItemInput,
  DeviceManagementProfile,
  InventoryAssignment,
  InventoryAuditEvent,
  InventoryCategory,
  InventoryDamageReport,
  InventoryDashboardSnapshot,
  InventoryItem,
  InventoryLocation,
  InventoryReturnRecord,
  EmployeeEquipmentSummary,
  IssueInventoryItemInput,
} from '@/types/inventory';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { inventorySupabaseRepository } from './inventoryRepository.supabase';
import { inventoryDemoRepository, peekInventoryAuditEvents } from './inventoryRepository.demo';
import { getServiceMode } from '@/lib/services/mode';
import {
  enforceInventoryPermission,
  INVENTORY_AUDIT_VIEW,
  INVENTORY_MANAGE_ITEMS,
  INVENTORY_ISSUE,
  INVENTORY_RETURN_MANAGE,
  INVENTORY_VIEW,
  PORTAL_EMPLOYEE_INVENTORY_VIEW,
} from './inventoryPermissions';
import { INVENTORY_PREPARED_MESSAGE, isInventoryLiveReady } from './inventoryModuleConfig';

function inventoryNotReady<T>(): ServiceResult<T> {
  return { ok: false, error: INVENTORY_PREPARED_MESSAGE };
}

function requireLiveRepo(): typeof inventorySupabaseRepository | typeof inventoryDemoRepository | ServiceResult<never> {
  if (getServiceMode() === 'demo') return inventoryDemoRepository;
  if (!isInventoryLiveReady()) {
    return inventoryNotReady();
  }
  return inventorySupabaseRepository;
}

export async function fetchInventoryDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryDashboardSnapshot>> {
  const denied = enforceInventoryPermission<InventoryDashboardSnapshot>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const repo = requireLiveRepo();
  if (!('buildDashboard' in repo)) return repo;
  return repo.buildDashboard(tenantId);
}

export async function fetchInventoryItems(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryItem[]>> {
  const denied = enforceInventoryPermission<InventoryItem[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const repo = requireLiveRepo();
  if (!('listItems' in repo)) return repo;
  return repo.listItems(tenantId);
}

export async function fetchInventoryItem(
  tenantId: string,
  itemId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryItem | null>> {
  const denied = enforceInventoryPermission<InventoryItem | null>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const repo = requireLiveRepo();
  if (!('getItem' in repo)) return repo;
  return repo.getItem(tenantId, itemId);
}

export async function fetchInventoryCategories(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryCategory[]>> {
  const denied = enforceInventoryPermission<InventoryCategory[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const repo = requireLiveRepo();
  if (!('listCategories' in repo)) return repo;
  return repo.listCategories(tenantId);
}

export async function fetchInventoryLocations(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryLocation[]>> {
  const denied = enforceInventoryPermission<InventoryLocation[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const repo = requireLiveRepo();
  if (!('listLocations' in repo)) return repo;
  return repo.listLocations(tenantId);
}

export async function fetchInventoryAssignments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryAssignment[]>> {
  const denied = enforceInventoryPermission<InventoryAssignment[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const repo = requireLiveRepo();
  if (!('listAssignments' in repo)) return repo;
  return repo.listAssignments(tenantId);
}

export async function fetchEmployeeIssuedItems(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  options?: { portalSelf?: boolean; viewerEmployeeId?: string | null },
): Promise<ServiceResult<InventoryAssignment[]>> {
  if (options?.portalSelf) {
    const denied = enforceInventoryPermission<InventoryAssignment[]>(
      actorRoleKey,
      PORTAL_EMPLOYEE_INVENTORY_VIEW,
    );
    if (denied) return denied;
    if (options.viewerEmployeeId && options.viewerEmployeeId !== employeeId) {
      return { ok: false, error: 'Nur eigene Ausgaben sichtbar.' };
    }
  } else {
    const denied = enforceInventoryPermission<InventoryAssignment[]>(actorRoleKey, INVENTORY_VIEW);
    if (denied) return denied;
  }

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const repo = requireLiveRepo();
  if (!('listAssignmentsForEmployee' in repo)) return repo;

  const assignments = await repo.listAssignmentsForEmployee(tenantId, employeeId);
  if (!assignments.ok) return assignments;

  if (options?.portalSelf) {
    const itemsResult = await repo.listItems(tenantId);
    if (!itemsResult.ok) return itemsResult;
    const visibleItemIds = new Set(
      itemsResult.data.filter((i) => i.portalVisibleToEmployee).map((i) => i.id),
    );
    return {
      ok: true,
      data: assignments.data.filter((a) => visibleItemIds.has(a.itemId)),
    };
  }

  return assignments;
}

export async function fetchEmployeeEquipmentSummary(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeeEquipmentSummary>> {
  const denied = enforceInventoryPermission<EmployeeEquipmentSummary>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const repo = requireLiveRepo();
  if (!('buildEmployeeSummary' in repo)) return repo;
  return repo.buildEmployeeSummary(tenantId, employeeId);
}

export async function createInventoryItem(
  tenantId: string,
  input: CreateInventoryItemInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryItem>> {
  const denied = enforceInventoryPermission<InventoryItem>(actorRoleKey, INVENTORY_MANAGE_ITEMS);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.name?.trim()) {
    return { ok: false, error: 'Bezeichnung ist erforderlich.' };
  }
  if (!input.categoryId) {
    return { ok: false, error: 'Kategorie ist erforderlich.' };
  }

  const repo = requireLiveRepo();
  if (!('createItem' in repo)) return repo;
  return repo.createItem(tenantId, input);
}

export async function issueInventoryItem(
  tenantId: string,
  input: IssueInventoryItemInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryAssignment>> {
  const denied = enforceInventoryPermission<InventoryAssignment>(actorRoleKey, INVENTORY_ISSUE);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.recipientEmployeeId?.trim()) {
    return { ok: false, error: 'Empfänger oder Verantwortliche:r ist erforderlich.' };
  }

  const itemResult = await fetchInventoryItem(tenantId, input.itemId, actorRoleKey);
  if (!itemResult.ok) return itemResult;
  if (!itemResult.data) return { ok: false, error: 'Inventarposten nicht gefunden.' };
  if (itemResult.data.status !== 'available') {
    return { ok: false, error: 'Posten ist nicht verfügbar.' };
  }

  const repo = requireLiveRepo();
  if (!('issueItem' in repo)) return repo;
  return repo.issueItem(tenantId, input);
}

export async function acknowledgeInventoryAssignment(
  tenantId: string,
  assignmentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryAssignment>> {
  const denied = enforceInventoryPermission<InventoryAssignment>(actorRoleKey, INVENTORY_ISSUE);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const repo = requireLiveRepo();
  if (!('acknowledgeAssignment' in repo)) return repo;
  return repo.acknowledgeAssignment(tenantId, assignmentId);
}

export async function requestInventoryReturn(
  tenantId: string,
  assignmentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryAssignment>> {
  const denied = enforceInventoryPermission<InventoryAssignment>(actorRoleKey, INVENTORY_RETURN_MANAGE);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const repo = requireLiveRepo();
  if (!('requestReturn' in repo)) return repo;
  return repo.requestReturn(tenantId, assignmentId);
}

export async function fetchInventoryAuditEvents(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryAuditEvent[]>> {
  const denied = enforceInventoryPermission<InventoryAuditEvent[]>(actorRoleKey, INVENTORY_AUDIT_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: peekInventoryAuditEvents(tenantId) };
  }
  if (!isInventoryLiveReady()) {
    return { ok: true, data: [] };
  }
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: [] };
  const { data, error } = await fromUnknownTable(supabase, 'inventory_audit_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return {
    ok: true,
    data: (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        tenantId: String(r.tenant_id),
        actorProfileId: r.actor_profile_id ? String(r.actor_profile_id) : null,
        action: String(r.action),
        entityType: r.entity_type as InventoryAuditEvent['entityType'],
        entityId: String(r.entity_id),
        metadata: (r.metadata as Record<string, unknown>) ?? {},
        createdAt: String(r.created_at),
      };
    }),
  };
}

export async function fetchDeviceManagementProfile(
  tenantId: string,
  itemId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DeviceManagementProfile | null>> {
  const denied = enforceInventoryPermission<DeviceManagementProfile | null>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const repo = requireLiveRepo();
  if (!('getDeviceProfileForItem' in repo)) return repo;
  return repo.getDeviceProfileForItem(tenantId, itemId);
}

export async function fetchInventoryDamageReports(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryDamageReport[]>> {
  const denied = enforceInventoryPermission<InventoryDamageReport[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const repo = requireLiveRepo();
  if (!('listDamageReports' in repo)) return repo;
  return repo.listDamageReports(tenantId);
}

export async function fetchInventoryReturnRecords(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryReturnRecord[]>> {
  const denied = enforceInventoryPermission<InventoryReturnRecord[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const repo = requireLiveRepo();
  if (!('listReturnRecords' in repo)) return repo;
  return repo.listReturnRecords(tenantId);
}

export { resetInventoryDemoStore } from './inventoryRepository.demo';
