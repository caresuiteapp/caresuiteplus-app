import type { RoleKey, ServiceResult } from '@/types';
import type {
  InventoryDamageReport,
  InventoryReturnProtocol,
  InventoryReturnRecord,
  RecordReturnInput,
} from '@/types/inventory';
import { computeDocumentContentHash } from '@/lib/documents/documentHashService';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { demoEmployees } from '@/data/demo/employees';
import { inventoryDemoRepository } from './inventoryRepository.demo';
import { inventorySupabaseRepository } from './inventoryRepository.supabase';
import {
  enforceInventoryPermission,
  INVENTORY_REPORT_DAMAGE,
  INVENTORY_RETURN_MANAGE,
} from './inventoryPermissions';
import { INVENTORY_RETURN_PROTOCOL_PDF_PREPARED, isInventoryLiveReady } from './inventoryModuleConfig';
import { fetchInventoryItem } from './inventoryService';

const OPEN_STATUSES = ['issued', 'acknowledged', 'return_requested', 'partially_returned', 'overdue', 'disputed'];

export async function recordInventoryReturn(
  tenantId: string,
  input: RecordReturnInput,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<InventoryReturnRecord>> {
  const denied = enforceInventoryPermission<InventoryReturnRecord>(actorRoleKey, INVENTORY_RETURN_MANAGE);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase' && isInventoryLiveReady()) {
    return inventorySupabaseRepository.recordReturn(tenantId, input);
  }

  const assignmentResult = inventoryDemoRepository.getAssignment(tenantId, input.assignmentId);
  if (!assignmentResult.ok || !assignmentResult.data) {
    return { ok: false, error: 'Ausgabe nicht gefunden.' };
  }
  const assignment = assignmentResult.data;
  if (!OPEN_STATUSES.includes(assignment.status)) {
    return { ok: false, error: 'Rückgabe für diesen Status nicht möglich.' };
  }

  const itemResult = await fetchInventoryItem(tenantId, assignment.itemId, actorRoleKey);
  if (!itemResult.ok || !itemResult.data) {
    return { ok: false, error: 'Inventarposten nicht gefunden.' };
  }

  const now = new Date().toISOString();
  const record: InventoryReturnRecord = {
    id: `inv-ret-${Date.now()}`,
    tenantId,
    assignmentId: assignment.id,
    itemId: assignment.itemId,
    employeeId: assignment.recipientEmployeeId,
    returnedAt: now,
    capture: input.capture,
    recordedByProfileId: input.recordedByProfileId ?? actorProfileId ?? null,
    createdAt: now,
  };

  let newAssignmentStatus = assignment.status;
  let newItemStatus = itemResult.data.status;

  if (!input.capture.returned) {
    newAssignmentStatus = 'disputed';
  } else if (input.capture.condition === 'lost') {
    newAssignmentStatus = 'lost';
    newItemStatus = 'lost';
  } else if (input.capture.condition === 'damaged' || input.capture.condition === 'unusable') {
    newAssignmentStatus = input.capture.complete ? 'damaged_returned' : 'partially_returned';
    newItemStatus = input.capture.complete ? 'damaged' : 'maintenance';
  } else if (input.capture.complete) {
    newAssignmentStatus = 'returned';
    newItemStatus = 'available';
  } else {
    newAssignmentStatus = 'partially_returned';
    newItemStatus = 'maintenance';
  }

  inventoryDemoRepository.addReturnRecord(record, actorProfileId);
  inventoryDemoRepository.updateAssignment(
    tenantId,
    assignment.id,
    { status: newAssignmentStatus },
    'record_return',
    actorProfileId,
  );
  inventoryDemoRepository.updateItem(tenantId, assignment.itemId, {
    status: newItemStatus,
    condition: input.capture.condition,
  });

  return { ok: true, data: record };
}

export async function reportInventoryDamageOrLoss(
  tenantId: string,
  input: {
    itemId: string;
    assignmentId?: string | null;
    employeeId?: string | null;
    reportType: InventoryDamageReport['reportType'];
    description: string;
    condition?: InventoryDamageReport['condition'];
  },
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<InventoryDamageReport>> {
  const denied = enforceInventoryPermission<InventoryDamageReport>(actorRoleKey, INVENTORY_REPORT_DAMAGE);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.description.trim()) {
    return { ok: false, error: 'Beschreibung ist erforderlich.' };
  }

  if (getServiceMode() === 'supabase' && isInventoryLiveReady()) {
    return inventorySupabaseRepository.reportDamage(tenantId, {
      tenantId,
      itemId: input.itemId,
      assignmentId: input.assignmentId ?? null,
      employeeId: input.employeeId ?? null,
      reportType: input.reportType,
      description: input.description.trim(),
      condition: input.condition ?? (input.reportType === 'loss' ? 'lost' : 'damaged'),
      reportedAt: new Date().toISOString(),
      reportedByProfileId: actorProfileId ?? null,
    });
  }

  const now = new Date().toISOString();
  const report: InventoryDamageReport = {
    id: `inv-dmg-${Date.now()}`,
    tenantId,
    itemId: input.itemId,
    assignmentId: input.assignmentId ?? null,
    employeeId: input.employeeId ?? null,
    reportType: input.reportType,
    description: input.description.trim(),
    condition: input.condition ?? (input.reportType === 'loss' ? 'lost' : 'damaged'),
    reportedAt: now,
    reportedByProfileId: actorProfileId ?? null,
    createdAt: now,
  };

  if (input.assignmentId) {
    inventoryDemoRepository.updateAssignment(
      tenantId,
      input.assignmentId,
      { status: input.reportType === 'loss' ? 'lost' : 'damaged_returned' },
      `report_${input.reportType}`,
      actorProfileId,
    );
  }

  return inventoryDemoRepository.addDamageReport(report, actorProfileId);
}

export async function generateInventoryReturnProtocol(
  tenantId: string,
  employeeId: string,
  exitDate: string,
  actorRoleKey?: RoleKey | null,
  options?: {
    adminProfileId?: string | null;
    adminName?: string | null;
    personnelNumber?: string | null;
    notes?: string | null;
  },
): Promise<ServiceResult<InventoryReturnProtocol>> {
  const denied = enforceInventoryPermission<InventoryReturnProtocol>(actorRoleKey, INVENTORY_RETURN_MANAGE);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const employee = demoEmployees.find((e) => e.id === employeeId);
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Unbekannt';

  const assignmentsResult = inventoryDemoRepository.listAssignmentsForEmployee(tenantId, employeeId);
  if (!assignmentsResult.ok) return assignmentsResult;

  const itemsResult = inventoryDemoRepository.listItems(tenantId);
  if (!itemsResult.ok) return itemsResult;
  const itemMap = new Map(itemsResult.data.map((i) => [i.id, i]));

  const openAssignments = assignmentsResult.data.filter(
    (a) => a.returnRequired && !['returned', 'archived'].includes(a.status),
  );

  const toLine = (a: (typeof assignmentsResult.data)[0], status: InventoryReturnProtocol['returnedItems'][0]['status']) => {
    const item = itemMap.get(a.itemId);
    return {
      itemId: a.itemId,
      itemName: item?.name ?? a.itemId,
      categoryGroup: item?.categoryGroup ?? ('devices' as const),
      serialNumber: item?.serialNumber ?? null,
      issuedAt: a.issuedAt ?? null,
      status,
      condition: a.issueCondition,
      notes: a.issueNotes ?? null,
    };
  };

  const returnedItems = assignmentsResult.data
    .filter((a) => a.status === 'returned' || a.status === 'damaged_returned')
    .map((a) => toLine(a, a.status === 'damaged_returned' ? 'damaged' : 'returned'));

  const missingItems = openAssignments
    .filter((a) => ['overdue', 'return_requested', 'disputed'].includes(a.status))
    .map((a) => toLine(a, 'missing'));

  const damagedItems = openAssignments
    .filter((a) => a.status === 'damaged_returned')
    .map((a) => toLine(a, 'damaged'));

  const issuedItems = assignmentsResult.data
    .filter((a) => a.returnRequired)
    .map((a) => toLine(a, 'returned'));

  const protocolDate = new Date().toISOString();
  const contentPayload = JSON.stringify({
    tenantId,
    employeeId,
    exitDate,
    returnedItems,
    missingItems,
    damagedItems,
    protocolDate,
  });
  const contentHash = computeDocumentContentHash(contentPayload);

  const protocol: InventoryReturnProtocol = {
    id: `inv-proto-${Date.now()}`,
    tenantId,
    employeeId,
    employeeName,
    personnelNumber: options?.personnelNumber ?? null,
    exitDate,
    issuedItems,
    returnedItems,
    missingItems,
    damagedItems,
    notes: options?.notes ?? null,
    adminProfileId: options?.adminProfileId ?? null,
    adminName: options?.adminName ?? null,
    protocolDate,
    contentHash,
    pdfTemplatePrepared: INVENTORY_RETURN_PROTOCOL_PDF_PREPARED,
    createdAt: protocolDate,
  };

  return inventoryDemoRepository.addReturnProtocol(protocol);
}

export async function fetchInventoryReturnProtocols(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InventoryReturnProtocol[]>> {
  const denied = enforceInventoryPermission<InventoryReturnProtocol[]>(actorRoleKey, INVENTORY_RETURN_MANAGE);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'supabase' && isInventoryLiveReady()) {
    return inventorySupabaseRepository.listReturnProtocols(tenantId);
  }
  return inventoryDemoRepository.listReturnProtocols(tenantId);
}
