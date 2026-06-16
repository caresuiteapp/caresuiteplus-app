/** Inventarkategorien — 7 Gruppen (Prompt 74). */
export const INVENTORY_CATEGORY_GROUPS = [
  'devices',
  'mobile_sim',
  'uniform',
  'keys_access',
  'documents',
  'vehicles',
  'software_access',
] as const;

export type InventoryCategoryGroup = (typeof INVENTORY_CATEGORY_GROUPS)[number];

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategoryGroup, string> = {
  devices: 'Geräte',
  mobile_sim: 'Mobil/SIM',
  uniform: 'Dienstkleidung',
  keys_access: 'Schlüssel & Zugang',
  documents: 'Dokumente',
  vehicles: 'Fahrzeuge',
  software_access: 'Software & Zugänge',
};

export const INVENTORY_ITEM_STATUSES = [
  'available',
  'assigned',
  'in_use',
  'reserved',
  'maintenance',
  'damaged',
  'lost',
  'returned',
  'decommissioned',
  'archived',
] as const;

export type InventoryItemStatus = (typeof INVENTORY_ITEM_STATUSES)[number];

export const INVENTORY_ASSIGNMENT_STATUSES = [
  'planned',
  'issued',
  'acknowledged',
  'return_requested',
  'partially_returned',
  'returned',
  'overdue',
  'damaged_returned',
  'lost',
  'disputed',
  'archived',
] as const;

export type InventoryAssignmentStatus = (typeof INVENTORY_ASSIGNMENT_STATUSES)[number];

export const INVENTORY_CONDITIONS = [
  'new',
  'very_good',
  'good',
  'used',
  'damaged',
  'unusable',
  'lost',
  'unknown',
] as const;

export type InventoryCondition = (typeof INVENTORY_CONDITIONS)[number];

export type InventoryLocation = {
  id: string;
  tenantId: string;
  label: string;
  building?: string | null;
  room?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InventoryCategory = {
  id: string;
  tenantId: string;
  group: InventoryCategoryGroup;
  label: string;
  requiresReturnOnExit: boolean;
  portalVisibleToEmployee: boolean;
  barcodeEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryItem = {
  id: string;
  tenantId: string;
  categoryId: string;
  categoryGroup: InventoryCategoryGroup;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  locationId?: string | null;
  status: InventoryItemStatus;
  condition: InventoryCondition;
  notes?: string | null;
  requiresReturnOnExit: boolean;
  portalVisibleToEmployee: boolean;
  /** Fahrzeuge — Verknüpfung mit Fahrtenbuch (Prompt 73, vorbereitet). */
  vehicleRefId?: string | null;
  /** Software/Zugänge — kein physisches Asset. */
  accessAccountRef?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InventoryAssignment = {
  id: string;
  tenantId: string;
  itemId: string;
  /** Empfänger oder Verantwortliche:r — Pflicht bei Ausgabe. */
  recipientEmployeeId: string;
  responsibleEmployeeId?: string | null;
  issuedByProfileId?: string | null;
  issuedAt?: string | null;
  expectedReturnAt?: string | null;
  acknowledgedAt?: string | null;
  status: InventoryAssignmentStatus;
  issueCondition: InventoryCondition;
  issueNotes?: string | null;
  returnRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryReturnCapture = {
  returned: boolean;
  complete: boolean;
  condition: InventoryCondition;
  damageDescription?: string | null;
  accessoriesComplete?: boolean | null;
  chargerReturned?: boolean | null;
  simRemoved?: boolean | null;
  deviceReset?: boolean | null;
  dataDeleted?: boolean | null;
  photoRefs?: string[];
  signatureRefs?: string[];
  notes?: string | null;
};

export type InventoryReturnRecord = {
  id: string;
  tenantId: string;
  assignmentId: string;
  itemId: string;
  employeeId: string;
  returnedAt: string;
  capture: InventoryReturnCapture;
  recordedByProfileId?: string | null;
  createdAt: string;
};

export type InventoryDamageReport = {
  id: string;
  tenantId: string;
  itemId: string;
  assignmentId?: string | null;
  employeeId?: string | null;
  reportType: 'damage' | 'loss' | 'missing_return';
  description: string;
  condition: InventoryCondition;
  reportedAt: string;
  reportedByProfileId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
};

export type InventoryReturnProtocolLine = {
  itemId: string;
  itemName: string;
  categoryGroup: InventoryCategoryGroup;
  serialNumber?: string | null;
  issuedAt?: string | null;
  status: 'returned' | 'missing' | 'damaged' | 'lost';
  condition?: InventoryCondition | null;
  notes?: string | null;
};

export type InventoryReturnProtocol = {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  personnelNumber?: string | null;
  exitDate: string;
  issuedItems: InventoryReturnProtocolLine[];
  returnedItems: InventoryReturnProtocolLine[];
  missingItems: InventoryReturnProtocolLine[];
  damagedItems: InventoryReturnProtocolLine[];
  notes?: string | null;
  adminProfileId?: string | null;
  adminName?: string | null;
  employeeSignatureRef?: string | null;
  adminSignatureRef?: string | null;
  protocolDate: string;
  contentHash: string;
  pdfTemplatePrepared: boolean;
  createdAt: string;
};

export type DeviceManagementProfile = {
  id: string;
  tenantId: string;
  itemId: string;
  deviceId?: string | null;
  osName?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
  lastLoginAt?: string | null;
  lastSyncAt?: string | null;
  mdmStatus: 'not_configured' | 'enrolled' | 'pending' | 'removed';
  remoteLockPrepared: boolean;
  remoteWipePrepared: boolean;
  mdmProviderKey?: string | null;
  updatedAt: string;
};

export type EmployeeEquipmentSummary = {
  employeeId: string;
  tenantId: string;
  activeAssignments: number;
  overdueReturns: number;
  openReturnRequests: number;
  lastIssuedAt?: string | null;
  categories: InventoryCategoryGroup[];
};

export type InventoryAuditEvent = {
  id: string;
  tenantId: string;
  actorProfileId?: string | null;
  action: string;
  entityType: 'inventory_item' | 'inventory_assignment' | 'inventory_return' | 'inventory_damage' | 'return_protocol';
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type InventoryDashboardSnapshot = {
  totalItems: number;
  availableItems: number;
  assignedItems: number;
  overdueReturns: number;
  openReturnRequests: number;
  damageReportsOpen: number;
  categoriesCount: number;
};

export type CreateInventoryItemInput = {
  categoryId: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  locationId?: string | null;
  condition?: InventoryCondition;
  notes?: string | null;
  requiresReturnOnExit?: boolean;
  portalVisibleToEmployee?: boolean;
};

export type IssueInventoryItemInput = {
  itemId: string;
  recipientEmployeeId: string;
  responsibleEmployeeId?: string | null;
  expectedReturnAt?: string | null;
  issueCondition?: InventoryCondition;
  issueNotes?: string | null;
  issuedByProfileId?: string | null;
};

export type RecordReturnInput = {
  assignmentId: string;
  capture: InventoryReturnCapture;
  recordedByProfileId?: string | null;
};

export type OffboardingInventoryCheck = {
  employeeId: string;
  canCompleteOffboarding: boolean;
  openAssignments: InventoryAssignment[];
  returnTasksSuggested: string[];
  portalLockPrepared: boolean;
  deviceAccessDeactivatePrepared: boolean;
};
