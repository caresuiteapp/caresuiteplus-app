export {
  isInventoryLiveReady,
  INVENTORY_PREPARED_MESSAGE,
  INVENTORY_MDM_PREPARED_MESSAGE,
  INVENTORY_MIGRATION,
  getInventoryLiveFlipBlockers,
  isInventoryCategoryLive,
} from './inventoryModuleConfig';

export {
  INVENTORY_VIEW,
  INVENTORY_MANAGE_ITEMS,
  INVENTORY_ISSUE,
  INVENTORY_RETURN_MANAGE,
  INVENTORY_AUDIT_VIEW,
  INVENTORY_REPORT_DAMAGE,
  INVENTORY_OFFBOARDING,
  PORTAL_EMPLOYEE_INVENTORY_VIEW,
  enforceInventoryPermission,
} from './inventoryPermissions';

export {
  fetchInventoryDashboard,
  fetchInventoryItems,
  fetchInventoryItem,
  fetchInventoryCategories,
  fetchInventoryLocations,
  fetchInventoryAssignments,
  fetchEmployeeIssuedItems,
  fetchEmployeeEquipmentSummary,
  createInventoryItem,
  issueInventoryItem,
  acknowledgeInventoryAssignment,
  requestInventoryReturn,
  fetchInventoryAuditEvents,
  fetchDeviceManagementProfile,
  fetchInventoryDamageReports,
  fetchInventoryReturnRecords,
  resetInventoryDemoStore,
} from './inventoryService';

export {
  recordInventoryReturn,
  reportInventoryDamageOrLoss,
  generateInventoryReturnProtocol,
  fetchInventoryReturnProtocols,
} from './inventoryReturnService';

export {
  checkOffboardingInventory,
  assertOffboardingCanComplete,
} from './inventoryOffboardingService';

export { peekInventoryAuditEvents } from './inventoryRepository.demo';

export { demoInventoryCategories, demoInventoryItems } from './inventory.demoData';
export { INVENTORY_CATEGORY_LABELS, INVENTORY_CATEGORY_GROUPS } from '@/types/inventory';

export type {
  InventoryCategoryGroup,
  InventoryItem,
  InventoryAssignment,
  InventoryReturnProtocol,
} from '@/types/inventory';
