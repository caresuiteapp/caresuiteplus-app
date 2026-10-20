import type {
  DeviceManagementProfile,
  InventoryAssignment,
  InventoryCategory,
  InventoryCategoryGroup,
  InventoryDamageReport,
  InventoryItem,
  InventoryLocation,
  InventoryReturnProtocol,
  InventoryReturnRecord,
} from '@/types/inventory';

function row(row: unknown): Record<string, unknown> {
  return row as Record<string, unknown>;
}

function str(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value);
}

function optStr(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

export function mapInventoryCategory(raw: unknown): InventoryCategory {
  const r = row(raw);
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    group: str(r.group_key) as InventoryCategoryGroup,
    label: str(r.label),
    requiresReturnOnExit: Boolean(r.requires_return_on_exit ?? true),
    portalVisibleToEmployee: Boolean(r.portal_visible_to_employee ?? false),
    barcodeEnabled: Boolean(r.barcode_enabled ?? false),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function mapInventoryLocation(raw: unknown): InventoryLocation {
  const r = row(raw);
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    label: str(r.label),
    building: optStr(r.building),
    room: optStr(r.room),
    notes: optStr(r.notes),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function mapInventoryItem(raw: unknown, categoryGroup?: InventoryCategoryGroup): InventoryItem {
  const r = row(raw);
  const joined = row(r.inventory_categories);
  const group =
    categoryGroup ??
    (joined.group_key ? (str(joined.group_key) as InventoryCategoryGroup) : ('devices' as InventoryCategoryGroup));

  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    categoryId: str(r.category_id),
    categoryGroup: group,
    name: str(r.name),
    sku: optStr(r.sku),
    barcode: optStr(r.barcode),
    serialNumber: optStr(r.serial_number),
    manufacturer: optStr(r.manufacturer),
    model: optStr(r.model),
    purchaseDate: optStr(r.purchase_date),
    warrantyUntil: optStr(r.warranty_until),
    locationId: optStr(r.location_id),
    status: str(r.status, 'available') as InventoryItem['status'],
    condition: str(r.condition, 'new') as InventoryItem['condition'],
    notes: optStr(r.notes),
    requiresReturnOnExit: Boolean(r.requires_return_on_exit ?? true),
    portalVisibleToEmployee: Boolean(r.portal_visible_to_employee ?? false),
    vehicleRefId: optStr(r.vehicle_ref_id),
    accessAccountRef: optStr(r.access_account_ref),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function mapInventoryAssignment(raw: unknown): InventoryAssignment {
  const r = row(raw);
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    itemId: str(r.item_id),
    recipientEmployeeId: str(r.recipient_employee_id),
    responsibleEmployeeId: optStr(r.responsible_employee_id),
    issuedByProfileId: optStr(r.issued_by_profile_id),
    issuedAt: optStr(r.issued_at),
    expectedReturnAt: optStr(r.expected_return_at),
    acknowledgedAt: optStr(r.acknowledged_at),
    status: str(r.status, 'planned') as InventoryAssignment['status'],
    issueCondition: str(r.issue_condition, 'good') as InventoryAssignment['issueCondition'],
    issueNotes: optStr(r.issue_notes),
    returnRequired: Boolean(r.return_required ?? true),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function mapInventoryReturnRecord(raw: unknown): InventoryReturnRecord {
  const r = row(raw);
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    assignmentId: str(r.assignment_id),
    itemId: str(r.item_id),
    employeeId: str(r.employee_id),
    returnedAt: str(r.returned_at),
    capture: {
      returned: Boolean(r.returned),
      complete: Boolean(r.complete),
      condition: str(r.condition, 'unknown') as InventoryReturnRecord['capture']['condition'],
      damageDescription: optStr(r.damage_description),
      accessoriesComplete:
        r.accessories_complete == null ? null : Boolean(r.accessories_complete),
      chargerReturned: r.charger_returned == null ? null : Boolean(r.charger_returned),
      simRemoved: r.sim_removed == null ? null : Boolean(r.sim_removed),
      deviceReset: r.device_reset == null ? null : Boolean(r.device_reset),
      dataDeleted: r.data_deleted == null ? null : Boolean(r.data_deleted),
      photoRefs: Array.isArray(r.photo_refs) ? r.photo_refs.map(String) : [],
      signatureRefs: Array.isArray(r.signature_refs) ? r.signature_refs.map(String) : [],
      notes: optStr(r.notes),
    },
    recordedByProfileId: optStr(r.recorded_by_profile_id),
    createdAt: str(r.created_at),
  };
}

export function mapInventoryDamageReport(raw: unknown): InventoryDamageReport {
  const r = row(raw);
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    itemId: str(r.item_id),
    assignmentId: optStr(r.assignment_id),
    employeeId: optStr(r.employee_id),
    reportType: str(r.report_type) as InventoryDamageReport['reportType'],
    description: str(r.description),
    condition: str(r.condition, 'damaged') as InventoryDamageReport['condition'],
    reportedAt: str(r.reported_at),
    reportedByProfileId: optStr(r.reported_by_profile_id),
    resolvedAt: optStr(r.resolved_at),
    createdAt: str(r.created_at),
  };
}

export function mapInventoryReturnProtocol(raw: unknown): InventoryReturnProtocol {
  const r = row(raw);
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    employeeId: str(r.employee_id),
    employeeName: str(r.employee_name),
    personnelNumber: optStr(r.personnel_number),
    exitDate: str(r.exit_date),
    issuedItems: (r.issued_items as InventoryReturnProtocol['issuedItems']) ?? [],
    returnedItems: (r.returned_items as InventoryReturnProtocol['returnedItems']) ?? [],
    missingItems: (r.missing_items as InventoryReturnProtocol['missingItems']) ?? [],
    damagedItems: (r.damaged_items as InventoryReturnProtocol['damagedItems']) ?? [],
    notes: optStr(r.notes),
    adminProfileId: optStr(r.admin_profile_id),
    adminName: optStr(r.admin_name),
    employeeSignatureRef: optStr(r.employee_signature_ref),
    adminSignatureRef: optStr(r.admin_signature_ref),
    protocolDate: str(r.protocol_date),
    contentHash: str(r.content_hash),
    pdfTemplatePrepared: Boolean(r.pdf_template_prepared ?? true),
    createdAt: str(r.created_at),
  };
}

export function mapDeviceManagementProfile(raw: unknown): DeviceManagementProfile {
  const r = row(raw);
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    itemId: str(r.item_id),
    deviceId: optStr(r.device_id),
    osName: optStr(r.os_name),
    osVersion: optStr(r.os_version),
    appVersion: optStr(r.app_version),
    lastLoginAt: optStr(r.last_login_at),
    lastSyncAt: optStr(r.last_sync_at),
    mdmStatus: str(r.mdm_status, 'not_configured') as DeviceManagementProfile['mdmStatus'],
    remoteLockPrepared: Boolean(r.remote_lock_prepared ?? true),
    remoteWipePrepared: Boolean(r.remote_wipe_prepared ?? true),
    mdmProviderKey: optStr(r.mdm_provider_key),
    updatedAt: str(r.updated_at),
  };
}
