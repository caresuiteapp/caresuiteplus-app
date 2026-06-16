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
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { inventoryDemoRepository, peekInventoryAuditEvents } from './inventoryRepository.demo';
import { inventorySupabaseRepository } from './inventoryRepository.supabase';
import {
  enforceInventoryPermission,
  INVENTORY_AUDIT_VIEW,
  INVENTORY_MANAGE_ITEMS,
  INVENTORY_ISSUE,
  INVENTORY_RETURN_MANAGE,
  INVENTORY_VIEW,
  PORTAL_EMPLOYEE_INVENTORY_VIEW,
} from './inventoryPermissions';
import { isInventoryLiveReady } from './inventoryModuleConfig';

function repo() {
  return getServiceMode() === 'supabase' && isInventoryLiveReady()
    ? inventorySupabaseRepository
    : inventoryDemoRepository;
}

const OPEN_ASSIGNMENT_STATUSES: InventoryAssignment['status'][] = [
  'planned',
  'issued',
  'acknowledged',
  'return_requested',
  'partially_returned',
  'overdue',
  'disputed',
];

export async function fetchInventoryDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryDashboardSnapshot>> {
  const denied = enforceInventoryPermission<InventoryDashboardSnapshot>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  return repo().buildDashboard(tenantId);
}

export async function fetchInventoryItems(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryItem[]>> {
  const denied = enforceInventoryPermission<InventoryItem[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'supabase' && isInventoryLiveReady()) {
    return inventorySupabaseRepository.listItems(tenantId);
  }
  return inventoryDemoRepository.listItems(tenantId);
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
  const r = repo();
  const result = r.getItem(tenantId, itemId);
  return result instanceof Promise ? result : Promise.resolve(result);
}

export async function fetchInventoryCategories(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryCategory[]>> {
  const denied = enforceInventoryPermission<InventoryCategory[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const result = repo().listCategories(tenantId);
  return result instanceof Promise ? result : Promise.resolve(result);
}

export async function fetchInventoryLocations(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryLocation[]>> {
  const denied = enforceInventoryPermission<InventoryLocation[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const result = repo().listLocations(tenantId);
  return result instanceof Promise ? result : Promise.resolve(result);
}

export async function fetchInventoryAssignments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryAssignment[]>> {
  const denied = enforceInventoryPermission<InventoryAssignment[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const result = repo().listAssignments(tenantId);
  return result instanceof Promise ? result : Promise.resolve(result);
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

  const assignmentsResult = repo().listAssignmentsForEmployee(tenantId, employeeId);
  const assignments = assignmentsResult instanceof Promise ? await assignmentsResult : assignmentsResult;
  if (!assignments.ok) return assignments;

  if (options?.portalSelf) {
    const itemsResult = repo().listItems(tenantId);
    const items = itemsResult instanceof Promise ? await itemsResult : itemsResult;
    if (!items.ok) return items;
    const visibleItemIds = new Set(
      items.data.filter((i) => i.portalVisibleToEmployee).map((i) => i.id),
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
  const result = repo().buildEmployeeSummary(tenantId, employeeId);
  return result instanceof Promise ? result : Promise.resolve(result);
}

export async function createInventoryItem(
  tenantId: string,
  input: CreateInventoryItemInput,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
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

  const r = repo();
  if (r === inventorySupabaseRepository) {
    return inventorySupabaseRepository.createItem(tenantId, input);
  }
  return inventoryDemoRepository.createItem(tenantId, input, actorProfileId);
}

export async function issueInventoryItem(
  tenantId: string,
  input: IssueInventoryItemInput,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
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

  const now = new Date().toISOString();
  const assignment: InventoryAssignment = {
    id: `inv-asg-${Date.now()}`,
    tenantId,
    itemId: input.itemId,
    recipientEmployeeId: input.recipientEmployeeId,
    responsibleEmployeeId: input.responsibleEmployeeId ?? input.recipientEmployeeId,
    issuedByProfileId: input.issuedByProfileId ?? actorProfileId ?? null,
    issuedAt: now,
    expectedReturnAt: input.expectedReturnAt ?? null,
    status: 'issued',
    issueCondition: input.issueCondition ?? itemResult.data.condition,
    issueNotes: input.issueNotes ?? null,
    returnRequired: itemResult.data.requiresReturnOnExit,
    createdAt: now,
    updatedAt: now,
  };

  if (getServiceMode() === 'supabase' && isInventoryLiveReady()) {
    return inventorySupabaseRepository.issueItem(tenantId, input);
  }
  return inventoryDemoRepository.createAssignment(tenantId, assignment, actorProfileId);
}

export async function acknowledgeInventoryAssignment(
  tenantId: string,
  assignmentId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<InventoryAssignment>> {
  const denied = enforceInventoryPermission<InventoryAssignment>(actorRoleKey, INVENTORY_ISSUE);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (inventorySupabaseRepository && getServiceMode() === 'supabase' && isInventoryLiveReady()) {
    return inventorySupabaseRepository.acknowledgeAssignment(tenantId, assignmentId);
  }

  const existing = inventoryDemoRepository.getAssignment(tenantId, assignmentId);
  if (!existing.ok || !existing.data) return { ok: false, error: 'Ausgabe nicht gefunden.' };
  if (existing.data.status !== 'issued' && existing.data.status !== 'planned') {
    return { ok: false, error: 'Bestätigung nur für geplante/ausgegebene Posten möglich.' };
  }

  return inventoryDemoRepository.updateAssignment(
    tenantId,
    assignmentId,
    { status: 'acknowledged', acknowledgedAt: new Date().toISOString() },
    'acknowledge_assignment',
    actorProfileId,
  );
}

export async function requestInventoryReturn(
  tenantId: string,
  assignmentId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<InventoryAssignment>> {
  const denied = enforceInventoryPermission<InventoryAssignment>(actorRoleKey, INVENTORY_RETURN_MANAGE);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase' && isInventoryLiveReady()) {
    return inventorySupabaseRepository.requestReturn(tenantId, assignmentId);
  }

  const existing = inventoryDemoRepository.getAssignment(tenantId, assignmentId);
  if (!existing.ok || !existing.data) return { ok: false, error: 'Ausgabe nicht gefunden.' };
  if (!OPEN_ASSIGNMENT_STATUSES.includes(existing.data.status)) {
    return { ok: false, error: 'Rückgabe kann für diesen Status nicht angefordert werden.' };
  }

  return inventoryDemoRepository.updateAssignment(
    tenantId,
    assignmentId,
    { status: 'return_requested' },
    'request_return',
    actorProfileId,
  );
}

export async function fetchInventoryAuditEvents(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryAuditEvent[]>> {
  const denied = enforceInventoryPermission<InventoryAuditEvent[]>(actorRoleKey, INVENTORY_AUDIT_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  return { ok: true, data: peekInventoryAuditEvents(tenantId) };
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
  const result = repo().getDeviceProfileForItem(tenantId, itemId);
  return result instanceof Promise ? result : Promise.resolve(result);
}

export async function fetchInventoryDamageReports(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryDamageReport[]>> {
  const denied = enforceInventoryPermission<InventoryDamageReport[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const result = repo().listDamageReports(tenantId);
  return result instanceof Promise ? result : Promise.resolve(result);
}

export async function fetchInventoryReturnRecords(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryReturnRecord[]>> {
  const denied = enforceInventoryPermission<InventoryReturnRecord[]>(actorRoleKey, INVENTORY_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const result = repo().listReturnRecords(tenantId);
  return result instanceof Promise ? result : Promise.resolve(result);
}

export { resetInventoryDemoStore } from './inventoryRepository.demo';
