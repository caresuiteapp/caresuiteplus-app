import type {
  CreateInventoryItemInput,
  InventoryAssignment,
  InventoryAuditEvent,
  InventoryCategory,
  InventoryDamageReport,
  InventoryDashboardSnapshot,
  InventoryItem,
  InventoryLocation,
  InventoryReturnProtocol,
  InventoryReturnRecord,
  DeviceManagementProfile,
  EmployeeEquipmentSummary,
} from '@/types/inventory';
import type { ServiceResult } from '@/types';
import {
  demoDeviceManagementProfiles,
  demoInventoryAssignments,
  demoInventoryCategories,
  demoInventoryDamageReports,
  demoInventoryItems,
  demoInventoryLocations,
  demoInventoryReturnProtocols,
  demoInventoryReturnRecords,
} from './inventory.demoData';

let items = [...demoInventoryItems];
let assignments = [...demoInventoryAssignments];
let categories = [...demoInventoryCategories];
let locations = [...demoInventoryLocations];
let returnRecords = [...demoInventoryReturnRecords];
let damageReports = [...demoInventoryDamageReports];
let returnProtocols = [...demoInventoryReturnProtocols];
let deviceProfiles = [...demoDeviceManagementProfiles];
let auditEvents: InventoryAuditEvent[] = [];

export function resetInventoryDemoStore(): void {
  items = [...demoInventoryItems];
  assignments = [...demoInventoryAssignments];
  categories = [...demoInventoryCategories];
  locations = [...demoInventoryLocations];
  returnRecords = [...demoInventoryReturnRecords];
  damageReports = [...demoInventoryDamageReports];
  returnProtocols = [...demoInventoryReturnProtocols];
  deviceProfiles = [...demoDeviceManagementProfiles];
  auditEvents = [];
}

export function peekInventoryAuditEvents(tenantId: string): InventoryAuditEvent[] {
  return auditEvents.filter((e) => e.tenantId === tenantId);
}

function pushAudit(event: Omit<InventoryAuditEvent, 'id' | 'createdAt'>): InventoryAuditEvent {
  const record: InventoryAuditEvent = {
    ...event,
    id: `inv-audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  auditEvents.push(record);
  return record;
}

function tenantFilter<T extends { tenantId: string }>(list: T[], tenantId: string): T[] {
  return list.filter((x) => x.tenantId === tenantId);
}

export const inventoryDemoRepository = {
  listItems(tenantId: string): ServiceResult<InventoryItem[]> {
    return { ok: true, data: tenantFilter(items, tenantId) };
  },

  getItem(tenantId: string, itemId: string): ServiceResult<InventoryItem | null> {
    const item = items.find((i) => i.tenantId === tenantId && i.id === itemId) ?? null;
    return { ok: true, data: item };
  },

  listCategories(tenantId: string): ServiceResult<InventoryCategory[]> {
    return { ok: true, data: tenantFilter(categories, tenantId) };
  },

  listLocations(tenantId: string): ServiceResult<InventoryLocation[]> {
    return { ok: true, data: tenantFilter(locations, tenantId) };
  },

  listAssignments(tenantId: string): ServiceResult<InventoryAssignment[]> {
    return { ok: true, data: tenantFilter(assignments, tenantId) };
  },

  listAssignmentsForEmployee(tenantId: string, employeeId: string): ServiceResult<InventoryAssignment[]> {
    const data = tenantFilter(assignments, tenantId).filter(
      (a) => a.recipientEmployeeId === employeeId || a.responsibleEmployeeId === employeeId,
    );
    return { ok: true, data };
  },

  getAssignment(tenantId: string, assignmentId: string): ServiceResult<InventoryAssignment | null> {
    const a = assignments.find((x) => x.tenantId === tenantId && x.id === assignmentId) ?? null;
    return { ok: true, data: a };
  },

  listReturnRecords(tenantId: string): ServiceResult<InventoryReturnRecord[]> {
    return { ok: true, data: tenantFilter(returnRecords, tenantId) };
  },

  listDamageReports(tenantId: string): ServiceResult<InventoryDamageReport[]> {
    return { ok: true, data: tenantFilter(damageReports, tenantId) };
  },

  listReturnProtocols(tenantId: string): ServiceResult<InventoryReturnProtocol[]> {
    return { ok: true, data: tenantFilter(returnProtocols, tenantId) };
  },

  listDeviceProfiles(tenantId: string): ServiceResult<DeviceManagementProfile[]> {
    return { ok: true, data: tenantFilter(deviceProfiles, tenantId) };
  },

  getDeviceProfileForItem(tenantId: string, itemId: string): ServiceResult<DeviceManagementProfile | null> {
    const p = deviceProfiles.find((d) => d.tenantId === tenantId && d.itemId === itemId) ?? null;
    return { ok: true, data: p };
  },

  createItem(
    tenantId: string,
    input: CreateInventoryItemInput,
    actorProfileId?: string | null,
  ): ServiceResult<InventoryItem> {
    const category = categories.find((c) => c.tenantId === tenantId && c.id === input.categoryId);
    if (!category) return { ok: false, error: 'Kategorie nicht gefunden.' };

    const now = new Date().toISOString();
    const item: InventoryItem = {
      id: `inv-item-${Date.now()}`,
      tenantId,
      categoryId: category.id,
      categoryGroup: category.group,
      name: input.name.trim(),
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      serialNumber: input.serialNumber ?? null,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      purchaseDate: input.purchaseDate ?? null,
      warrantyUntil: input.warrantyUntil ?? null,
      locationId: input.locationId ?? null,
      status: 'available',
      condition: input.condition ?? 'new',
      notes: input.notes ?? null,
      requiresReturnOnExit: input.requiresReturnOnExit ?? category.requiresReturnOnExit,
      portalVisibleToEmployee: input.portalVisibleToEmployee ?? category.portalVisibleToEmployee,
      createdAt: now,
      updatedAt: now,
    };
    items.push(item);
    pushAudit({
      tenantId,
      actorProfileId: actorProfileId ?? null,
      action: 'create_item',
      entityType: 'inventory_item',
      entityId: item.id,
      metadata: { name: item.name, categoryGroup: item.categoryGroup },
    });
    return { ok: true, data: item };
  },

  updateItem(tenantId: string, itemId: string, patch: Partial<InventoryItem>): ServiceResult<InventoryItem> {
    const idx = items.findIndex((i) => i.tenantId === tenantId && i.id === itemId);
    if (idx < 0) return { ok: false, error: 'Inventarposten nicht gefunden.' };
    items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
    return { ok: true, data: items[idx] };
  },

  createAssignment(
    tenantId: string,
    assignment: InventoryAssignment,
    actorProfileId?: string | null,
  ): ServiceResult<InventoryAssignment> {
    assignments.push(assignment);
    const itemIdx = items.findIndex((i) => i.id === assignment.itemId && i.tenantId === tenantId);
    if (itemIdx >= 0) {
      items[itemIdx] = {
        ...items[itemIdx],
        status: 'assigned',
        updatedAt: new Date().toISOString(),
      };
    }
    pushAudit({
      tenantId,
      actorProfileId: actorProfileId ?? null,
      action: 'issue_item',
      entityType: 'inventory_assignment',
      entityId: assignment.id,
      metadata: {
        itemId: assignment.itemId,
        recipientEmployeeId: assignment.recipientEmployeeId,
      },
    });
    return { ok: true, data: assignment };
  },

  updateAssignment(
    tenantId: string,
    assignmentId: string,
    patch: Partial<InventoryAssignment>,
    auditAction?: string,
    actorProfileId?: string | null,
  ): ServiceResult<InventoryAssignment> {
    const idx = assignments.findIndex((a) => a.tenantId === tenantId && a.id === assignmentId);
    if (idx < 0) return { ok: false, error: 'Ausgabe nicht gefunden.' };
    assignments[idx] = { ...assignments[idx], ...patch, updatedAt: new Date().toISOString() };
    if (auditAction) {
      pushAudit({
        tenantId,
        actorProfileId: actorProfileId ?? null,
        action: auditAction,
        entityType: 'inventory_assignment',
        entityId: assignmentId,
        metadata: patch as Record<string, unknown>,
      });
    }
    return { ok: true, data: assignments[idx] };
  },

  addReturnRecord(record: InventoryReturnRecord, actorProfileId?: string | null): ServiceResult<InventoryReturnRecord> {
    returnRecords.push(record);
    pushAudit({
      tenantId: record.tenantId,
      actorProfileId: actorProfileId ?? null,
      action: 'record_return',
      entityType: 'inventory_return',
      entityId: record.id,
      metadata: { assignmentId: record.assignmentId, complete: record.capture.complete },
    });
    return { ok: true, data: record };
  },

  addDamageReport(report: InventoryDamageReport, actorProfileId?: string | null): ServiceResult<InventoryDamageReport> {
    damageReports.push(report);
    const itemIdx = items.findIndex((i) => i.id === report.itemId && i.tenantId === report.tenantId);
    if (itemIdx >= 0 && report.reportType === 'loss') {
      items[itemIdx] = { ...items[itemIdx], status: 'lost', condition: 'lost', updatedAt: new Date().toISOString() };
    } else if (itemIdx >= 0 && report.reportType === 'damage') {
      items[itemIdx] = { ...items[itemIdx], status: 'damaged', condition: 'damaged', updatedAt: new Date().toISOString() };
    }
    pushAudit({
      tenantId: report.tenantId,
      actorProfileId: actorProfileId ?? null,
      action: `report_${report.reportType}`,
      entityType: 'inventory_damage',
      entityId: report.id,
      metadata: { itemId: report.itemId },
    });
    return { ok: true, data: report };
  },

  addReturnProtocol(protocol: InventoryReturnProtocol): ServiceResult<InventoryReturnProtocol> {
    returnProtocols.push(protocol);
    pushAudit({
      tenantId: protocol.tenantId,
      actorProfileId: protocol.adminProfileId ?? null,
      action: 'generate_return_protocol',
      entityType: 'return_protocol',
      entityId: protocol.id,
      metadata: { employeeId: protocol.employeeId, contentHash: protocol.contentHash },
    });
    return { ok: true, data: protocol };
  },

  buildDashboard(tenantId: string): ServiceResult<InventoryDashboardSnapshot> {
    const tenantItems = tenantFilter(items, tenantId);
    const tenantAssignments = tenantFilter(assignments, tenantId);
    const openStatuses: InventoryAssignment['status'][] = [
      'issued',
      'acknowledged',
      'return_requested',
      'partially_returned',
      'overdue',
      'disputed',
    ];
    return {
      ok: true,
      data: {
        totalItems: tenantItems.length,
        availableItems: tenantItems.filter((i) => i.status === 'available').length,
        assignedItems: tenantItems.filter((i) => ['assigned', 'in_use'].includes(i.status)).length,
        overdueReturns: tenantAssignments.filter((a) => a.status === 'overdue').length,
        openReturnRequests: tenantAssignments.filter((a) => a.status === 'return_requested').length,
        damageReportsOpen: tenantFilter(damageReports, tenantId).filter((d) => !d.resolvedAt).length,
        categoriesCount: tenantFilter(categories, tenantId).length,
      },
    };
  },

  buildEmployeeSummary(tenantId: string, employeeId: string): ServiceResult<EmployeeEquipmentSummary> {
    const empAssignments = tenantFilter(assignments, tenantId).filter(
      (a) =>
        (a.recipientEmployeeId === employeeId || a.responsibleEmployeeId === employeeId) &&
        !['returned', 'archived'].includes(a.status),
    );
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const categories = [
      ...new Set(
        empAssignments
          .map((a) => itemMap.get(a.itemId)?.categoryGroup)
          .filter(Boolean) as EmployeeEquipmentSummary['categories'],
      ),
    ];
    return {
      ok: true,
      data: {
        employeeId,
        tenantId,
        activeAssignments: empAssignments.length,
        overdueReturns: empAssignments.filter((a) => a.status === 'overdue').length,
        openReturnRequests: empAssignments.filter((a) => a.status === 'return_requested').length,
        lastIssuedAt: empAssignments
          .map((a) => a.issuedAt)
          .filter(Boolean)
          .sort()
          .reverse()[0],
        categories,
      },
    };
  },
};
