import type { ServiceResult } from '@/types';
import type {
  CreateInventoryItemInput,
  DeviceManagementProfile,
  InventoryAssignment,
  InventoryCategory,
  InventoryCategoryGroup,
  InventoryDamageReport,
  InventoryDashboardSnapshot,
  InventoryItem,
  InventoryLocation,
  InventoryReturnProtocol,
  InventoryReturnRecord,
  EmployeeEquipmentSummary,
  IssueInventoryItemInput,
  RecordReturnInput,
} from '@/types/inventory';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { buildDefaultCategoryRows } from './inventoryDefaultCategories';
import {
  mapDeviceManagementProfile,
  mapInventoryAssignment,
  mapInventoryCategory,
  mapInventoryDamageReport,
  mapInventoryItem,
  mapInventoryLocation,
  mapInventoryReturnProtocol,
  mapInventoryReturnRecord,
} from './inventoryMapper';

const ITEM_SELECT =
  '*, inventory_categories!inner(group_key)';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function fail<T>(error: unknown): ServiceResult<T> {
  return { ok: false, error: toGermanSupabaseError(error) };
}

async function ensureDefaultCategories(tenantId: string): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { count, error: countError } = await fromUnknownTable(supabase, 'inventory_categories')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (countError) return fail(countError);
  if ((count ?? 0) > 0) return { ok: true, data: undefined };

  const { error: insertError } = await fromUnknownTable(supabase, 'inventory_categories').insert(
    buildDefaultCategoryRows(tenantId),
  );

  if (insertError) return fail(insertError);
  return { ok: true, data: undefined };
}

async function categoryGroupMap(tenantId: string): Promise<Map<string, InventoryCategoryGroup>> {
  const supabase = getSupabaseClient();
  const map = new Map<string, InventoryCategoryGroup>();
  if (!supabase) return map;

  const { data } = await fromUnknownTable(supabase, 'inventory_categories')
    .select('id, group_key')
    .eq('tenant_id', tenantId);

  for (const row of data ?? []) {
    const r = row as { id: string; group_key: InventoryCategoryGroup };
    map.set(r.id, r.group_key);
  }
  return map;
}

async function insertAudit(
  tenantId: string,
  action: string,
  entityType: string,
  entityId: string,
  actorProfileId?: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  await fromUnknownTable(supabase, 'inventory_audit_events').insert({
    tenant_id: tenantId,
    actor_profile_id: actorProfileId ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}

/** Supabase-Repository — Inventar Live (Migration 0051). */
export const inventorySupabaseRepository = {
  async listItems(tenantId: string): Promise<ServiceResult<InventoryItem[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_items')
      .select(ITEM_SELECT)
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) return fail(error);
    return { ok: true, data: (data ?? []).map((row) => mapInventoryItem(row)) };
  },

  async getItem(tenantId: string, itemId: string): Promise<ServiceResult<InventoryItem | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_items')
      .select(ITEM_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', itemId)
      .maybeSingle();

    if (error) return fail(error);
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapInventoryItem(data) };
  },

  async listCategories(tenantId: string): Promise<ServiceResult<InventoryCategory[]>> {
    const seeded = await ensureDefaultCategories(tenantId);
    if (!seeded.ok) return seeded;

    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('label', { ascending: true });

    if (error) return fail(error);
    return { ok: true, data: (data ?? []).map(mapInventoryCategory) };
  },

  async listLocations(tenantId: string): Promise<ServiceResult<InventoryLocation[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_locations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('label', { ascending: true });

    if (error) return fail(error);
    return { ok: true, data: (data ?? []).map(mapInventoryLocation) };
  },

  async listAssignments(tenantId: string): Promise<ServiceResult<InventoryAssignment[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_assignments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) return fail(error);
    return { ok: true, data: (data ?? []).map(mapInventoryAssignment) };
  },

  async listAssignmentsForEmployee(
    tenantId: string,
    employeeId: string,
  ): Promise<ServiceResult<InventoryAssignment[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_assignments')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`recipient_employee_id.eq.${employeeId},responsible_employee_id.eq.${employeeId}`)
      .order('issued_at', { ascending: false });

    if (error) return fail(error);
    return { ok: true, data: (data ?? []).map(mapInventoryAssignment) };
  },

  async getAssignment(
    tenantId: string,
    assignmentId: string,
  ): Promise<ServiceResult<InventoryAssignment | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_assignments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId)
      .maybeSingle();

    if (error) return fail(error);
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapInventoryAssignment(data) };
  },

  async listReturnRecords(tenantId: string): Promise<ServiceResult<InventoryReturnRecord[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_return_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('returned_at', { ascending: false });

    if (error) return fail(error);
    return { ok: true, data: (data ?? []).map(mapInventoryReturnRecord) };
  },

  async listDamageReports(tenantId: string): Promise<ServiceResult<InventoryDamageReport[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_damage_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('reported_at', { ascending: false });

    if (error) return fail(error);
    return { ok: true, data: (data ?? []).map(mapInventoryDamageReport) };
  },

  async listReturnProtocols(tenantId: string): Promise<ServiceResult<InventoryReturnProtocol[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_return_protocols')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('protocol_date', { ascending: false });

    if (error) return fail(error);
    return { ok: true, data: (data ?? []).map(mapInventoryReturnProtocol) };
  },

  async listDeviceProfiles(tenantId: string): Promise<ServiceResult<DeviceManagementProfile[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'device_management_profiles')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) return fail(error);
    return { ok: true, data: (data ?? []).map(mapDeviceManagementProfile) };
  },

  async getDeviceProfileForItem(
    tenantId: string,
    itemId: string,
  ): Promise<ServiceResult<DeviceManagementProfile | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'device_management_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('item_id', itemId)
      .maybeSingle();

    if (error) return fail(error);
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapDeviceManagementProfile(data) };
  },

  async createItem(tenantId: string, input: CreateInventoryItemInput): Promise<ServiceResult<InventoryItem>> {
    const categories = await this.listCategories(tenantId);
    if (!categories.ok) return categories;
    const category = categories.data.find((c) => c.id === input.categoryId);
    if (!category) return { ok: false, error: 'Kategorie nicht gefunden.' };

    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const payload = {
      tenant_id: tenantId,
      category_id: input.categoryId,
      name: input.name.trim(),
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      serial_number: input.serialNumber ?? null,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      purchase_date: input.purchaseDate ?? null,
      warranty_until: input.warrantyUntil ?? null,
      location_id: input.locationId ?? null,
      status: 'available',
      condition: input.condition ?? 'new',
      notes: input.notes ?? null,
      requires_return_on_exit: input.requiresReturnOnExit ?? category.requiresReturnOnExit,
      portal_visible_to_employee: input.portalVisibleToEmployee ?? category.portalVisibleToEmployee,
    };

    const { data, error } = await fromUnknownTable(supabase, 'inventory_items')
      .insert(payload)
      .select(ITEM_SELECT)
      .single();

    if (error) return fail(error);
    const item = mapInventoryItem(data, category.group);
    await insertAudit(tenantId, 'create_item', 'inventory_item', item.id, null, {
      name: item.name,
      categoryGroup: item.categoryGroup,
    });
    return { ok: true, data: item };
  },

  async updateItem(
    tenantId: string,
    itemId: string,
    patch: Partial<InventoryItem>,
  ): Promise<ServiceResult<InventoryItem>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const rowPatch: Record<string, unknown> = {};
    if (patch.name != null) rowPatch.name = patch.name;
    if (patch.status != null) rowPatch.status = patch.status;
    if (patch.condition != null) rowPatch.condition = patch.condition;
    if (patch.notes !== undefined) rowPatch.notes = patch.notes;
    if (patch.locationId !== undefined) rowPatch.location_id = patch.locationId;

    const { data, error } = await fromUnknownTable(supabase, 'inventory_items')
      .update(rowPatch)
      .eq('tenant_id', tenantId)
      .eq('id', itemId)
      .select(ITEM_SELECT)
      .single();

    if (error) return fail(error);
    return { ok: true, data: mapInventoryItem(data) };
  },

  async issueItem(tenantId: string, input: IssueInventoryItemInput): Promise<ServiceResult<InventoryAssignment>> {
    const itemResult = await this.getItem(tenantId, input.itemId);
    if (!itemResult.ok) return itemResult;
    if (!itemResult.data) return { ok: false, error: 'Inventarposten nicht gefunden.' };
    if (itemResult.data.status !== 'available') {
      return { ok: false, error: 'Posten ist nicht verfügbar.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const now = new Date().toISOString();
    const { data, error } = await fromUnknownTable(supabase, 'inventory_assignments')
      .insert({
        tenant_id: tenantId,
        item_id: input.itemId,
        recipient_employee_id: input.recipientEmployeeId,
        responsible_employee_id: input.responsibleEmployeeId ?? input.recipientEmployeeId,
        issued_by_profile_id: input.issuedByProfileId ?? null,
        issued_at: now,
        expected_return_at: input.expectedReturnAt ?? null,
        status: 'issued',
        issue_condition: input.issueCondition ?? itemResult.data.condition,
        issue_notes: input.issueNotes ?? null,
        return_required: itemResult.data.requiresReturnOnExit,
      })
      .select('*')
      .single();

    if (error) return fail(error);

    await this.updateItem(tenantId, input.itemId, { status: 'assigned' });
    const assignment = mapInventoryAssignment(data);
    await insertAudit(tenantId, 'issue_item', 'inventory_assignment', assignment.id, input.issuedByProfileId, {
      itemId: input.itemId,
      recipientEmployeeId: input.recipientEmployeeId,
    });
    return { ok: true, data: assignment };
  },

  async acknowledgeAssignment(
    tenantId: string,
    assignmentId: string,
  ): Promise<ServiceResult<InventoryAssignment>> {
    const existing = await this.getAssignment(tenantId, assignmentId);
    if (!existing.ok) return existing;
    if (!existing.data) return { ok: false, error: 'Ausgabe nicht gefunden.' };
    if (existing.data.status !== 'issued' && existing.data.status !== 'planned') {
      return { ok: false, error: 'Bestätigung nur für geplante/ausgegebene Posten möglich.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const now = new Date().toISOString();
    const { data, error } = await fromUnknownTable(supabase, 'inventory_assignments')
      .update({ status: 'acknowledged', acknowledged_at: now })
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId)
      .select('*')
      .single();

    if (error) return fail(error);
    return { ok: true, data: mapInventoryAssignment(data) };
  },

  async requestReturn(tenantId: string, assignmentId: string): Promise<ServiceResult<InventoryAssignment>> {
    const existing = await this.getAssignment(tenantId, assignmentId);
    if (!existing.ok) return existing;
    if (!existing.data) return { ok: false, error: 'Ausgabe nicht gefunden.' };

    const openStatuses = [
      'planned',
      'issued',
      'acknowledged',
      'return_requested',
      'partially_returned',
      'overdue',
      'disputed',
    ];
    if (!openStatuses.includes(existing.data.status)) {
      return { ok: false, error: 'Rückgabe kann für diesen Status nicht angefordert werden.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_assignments')
      .update({ status: 'return_requested' })
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId)
      .select('*')
      .single();

    if (error) return fail(error);
    return { ok: true, data: mapInventoryAssignment(data) };
  },

  async recordReturn(tenantId: string, input: RecordReturnInput): Promise<ServiceResult<InventoryReturnRecord>> {
    const assignmentResult = await this.getAssignment(tenantId, input.assignmentId);
    if (!assignmentResult.ok) return assignmentResult;
    if (!assignmentResult.data) return { ok: false, error: 'Ausgabe nicht gefunden.' };

    const assignment = assignmentResult.data;
    const itemResult = await this.getItem(tenantId, assignment.itemId);
    if (!itemResult.ok || !itemResult.data) {
      return { ok: false, error: 'Inventarposten nicht gefunden.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const now = new Date().toISOString();
    const capture = input.capture;

    let newAssignmentStatus = assignment.status;
    let newItemStatus = itemResult.data.status;

    if (!capture.returned) {
      newAssignmentStatus = 'disputed';
    } else if (capture.condition === 'lost') {
      newAssignmentStatus = 'lost';
      newItemStatus = 'lost';
    } else if (capture.condition === 'damaged' || capture.condition === 'unusable') {
      newAssignmentStatus = capture.complete ? 'damaged_returned' : 'partially_returned';
      newItemStatus = capture.complete ? 'damaged' : 'maintenance';
    } else if (capture.complete) {
      newAssignmentStatus = 'returned';
      newItemStatus = 'available';
    } else {
      newAssignmentStatus = 'partially_returned';
      newItemStatus = 'maintenance';
    }

    const { data, error } = await fromUnknownTable(supabase, 'inventory_return_records')
      .insert({
        tenant_id: tenantId,
        assignment_id: assignment.id,
        item_id: assignment.itemId,
        employee_id: assignment.recipientEmployeeId,
        returned_at: now,
        returned: capture.returned,
        complete: capture.complete,
        condition: capture.condition,
        damage_description: capture.damageDescription ?? null,
        accessories_complete: capture.accessoriesComplete ?? null,
        charger_returned: capture.chargerReturned ?? null,
        sim_removed: capture.simRemoved ?? null,
        device_reset: capture.deviceReset ?? null,
        data_deleted: capture.dataDeleted ?? null,
        photo_refs: capture.photoRefs ?? [],
        signature_refs: capture.signatureRefs ?? [],
        notes: capture.notes ?? null,
        recorded_by_profile_id: input.recordedByProfileId ?? null,
      })
      .select('*')
      .single();

    if (error) return fail(error);

    await fromUnknownTable(supabase, 'inventory_assignments')
      .update({ status: newAssignmentStatus })
      .eq('tenant_id', tenantId)
      .eq('id', assignment.id);

    await this.updateItem(tenantId, assignment.itemId, {
      status: newItemStatus,
      condition: capture.condition,
    });

    const record = mapInventoryReturnRecord(data);
    await insertAudit(tenantId, 'record_return', 'inventory_return', record.id, input.recordedByProfileId, {
      assignmentId: assignment.id,
      complete: capture.complete,
    });
    return { ok: true, data: record };
  },

  async reportDamage(
    tenantId: string,
    report: Omit<InventoryDamageReport, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<InventoryDamageReport>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'inventory_damage_reports')
      .insert({
        tenant_id: tenantId,
        item_id: report.itemId,
        assignment_id: report.assignmentId ?? null,
        employee_id: report.employeeId ?? null,
        report_type: report.reportType,
        description: report.description,
        condition: report.condition,
        reported_at: report.reportedAt,
        reported_by_profile_id: report.reportedByProfileId ?? null,
        resolved_at: report.resolvedAt ?? null,
      })
      .select('*')
      .single();

    if (error) return fail(error);

    if (report.reportType === 'loss') {
      await this.updateItem(tenantId, report.itemId, { status: 'lost', condition: 'lost' });
    } else if (report.reportType === 'damage') {
      await this.updateItem(tenantId, report.itemId, { status: 'damaged', condition: 'damaged' });
    }

    if (report.assignmentId) {
      await fromUnknownTable(supabase, 'inventory_assignments')
        .update({ status: report.reportType === 'loss' ? 'lost' : 'damaged_returned' })
        .eq('tenant_id', tenantId)
        .eq('id', report.assignmentId);
    }

    const mapped = mapInventoryDamageReport(data);
    await insertAudit(tenantId, `report_${report.reportType}`, 'inventory_damage', mapped.id, report.reportedByProfileId, {
      itemId: report.itemId,
    });
    return { ok: true, data: mapped };
  },

  async buildDashboard(tenantId: string): Promise<ServiceResult<InventoryDashboardSnapshot>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    await ensureDefaultCategories(tenantId);

    const [itemsResult, assignmentsResult, damageResult, categoriesResult] = await Promise.all([
      fromUnknownTable(supabase, 'inventory_items').select('status').eq('tenant_id', tenantId),
      fromUnknownTable(supabase, 'inventory_assignments').select('status').eq('tenant_id', tenantId),
      fromUnknownTable(supabase, 'inventory_damage_reports')
        .select('id')
        .eq('tenant_id', tenantId)
        .is('resolved_at', null),
      fromUnknownTable(supabase, 'inventory_categories')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ]);

    const errors = [itemsResult.error, assignmentsResult.error, damageResult.error, categoriesResult.error].filter(
      Boolean,
    );
    if (errors.length > 0) return fail(errors[0]);

    const items = (itemsResult.data ?? []) as { status: string }[];
    const assignments = (assignmentsResult.data ?? []) as { status: string }[];

    return {
      ok: true,
      data: {
        totalItems: items.length,
        availableItems: items.filter((i) => i.status === 'available').length,
        assignedItems: items.filter((i) => ['assigned', 'in_use'].includes(i.status)).length,
        overdueReturns: assignments.filter((a) => a.status === 'overdue').length,
        openReturnRequests: assignments.filter((a) => a.status === 'return_requested').length,
        damageReportsOpen: damageResult.data?.length ?? 0,
        categoriesCount: categoriesResult.count ?? 0,
      },
    };
  },

  async buildEmployeeSummary(
    tenantId: string,
    employeeId: string,
  ): Promise<ServiceResult<EmployeeEquipmentSummary>> {
    const assignmentsResult = await this.listAssignmentsForEmployee(tenantId, employeeId);
    if (!assignmentsResult.ok) return assignmentsResult;

    const itemsResult = await this.listItems(tenantId);
    if (!itemsResult.ok) return itemsResult;

    const empAssignments = assignmentsResult.data.filter(
      (a) => !['returned', 'archived'].includes(a.status),
    );
    const itemMap = new Map(itemsResult.data.map((i) => [i.id, i]));
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
