import type { ServiceResult } from '@/types';
import type {
  CreateInventoryItemInput,
  DeviceManagementProfile,
  InventoryAssignment,
  InventoryCategory,
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

function unavailable<T>(): ServiceResult<T> {
  return {
    ok: false,
    error: 'Inventar im Live-Modus noch nicht vollständig angebunden (Migration 0051).',
  };
}

/** Supabase-Repository — vorbereitet, kein Write bis Live-Flip. */
export const inventorySupabaseRepository = {
  listItems: (_tenantId: string): Promise<ServiceResult<InventoryItem[]>> => Promise.resolve(unavailable()),
  getItem: (_tenantId: string, _itemId: string): Promise<ServiceResult<InventoryItem | null>> =>
    Promise.resolve(unavailable()),
  listCategories: (_tenantId: string): Promise<ServiceResult<InventoryCategory[]>> =>
    Promise.resolve(unavailable()),
  listLocations: (_tenantId: string): Promise<ServiceResult<InventoryLocation[]>> =>
    Promise.resolve(unavailable()),
  listAssignments: (_tenantId: string): Promise<ServiceResult<InventoryAssignment[]>> =>
    Promise.resolve(unavailable()),
  listAssignmentsForEmployee: (_tenantId: string, _employeeId: string): Promise<ServiceResult<InventoryAssignment[]>> =>
    Promise.resolve(unavailable()),
  getAssignment: (_tenantId: string, _assignmentId: string): Promise<ServiceResult<InventoryAssignment | null>> =>
    Promise.resolve(unavailable()),
  listReturnRecords: (_tenantId: string): Promise<ServiceResult<InventoryReturnRecord[]>> =>
    Promise.resolve(unavailable()),
  listDamageReports: (_tenantId: string): Promise<ServiceResult<InventoryDamageReport[]>> =>
    Promise.resolve(unavailable()),
  listReturnProtocols: (_tenantId: string): Promise<ServiceResult<InventoryReturnProtocol[]>> =>
    Promise.resolve(unavailable()),
  listDeviceProfiles: (_tenantId: string): Promise<ServiceResult<DeviceManagementProfile[]>> =>
    Promise.resolve(unavailable()),
  getDeviceProfileForItem: (_tenantId: string, _itemId: string): Promise<ServiceResult<DeviceManagementProfile | null>> =>
    Promise.resolve(unavailable()),
  createItem: (_tenantId: string, _input: CreateInventoryItemInput): Promise<ServiceResult<InventoryItem>> =>
    Promise.resolve(unavailable()),
  updateItem: (
    _tenantId: string,
    _itemId: string,
    _patch: Partial<InventoryItem>,
  ): Promise<ServiceResult<InventoryItem>> => Promise.resolve(unavailable()),
  issueItem: (_tenantId: string, _input: IssueInventoryItemInput): Promise<ServiceResult<InventoryAssignment>> =>
    Promise.resolve(unavailable()),
  acknowledgeAssignment: (
    _tenantId: string,
    _assignmentId: string,
  ): Promise<ServiceResult<InventoryAssignment>> => Promise.resolve(unavailable()),
  requestReturn: (_tenantId: string, _assignmentId: string): Promise<ServiceResult<InventoryAssignment>> =>
    Promise.resolve(unavailable()),
  recordReturn: (_tenantId: string, _input: RecordReturnInput): Promise<ServiceResult<InventoryReturnRecord>> =>
    Promise.resolve(unavailable()),
  reportDamage: (
    _tenantId: string,
    _report: Omit<InventoryDamageReport, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<InventoryDamageReport>> => Promise.resolve(unavailable()),
  buildDashboard: (_tenantId: string): Promise<ServiceResult<InventoryDashboardSnapshot>> =>
    Promise.resolve(unavailable()),
  buildEmployeeSummary: (_tenantId: string, _employeeId: string): Promise<ServiceResult<EmployeeEquipmentSummary>> =>
    Promise.resolve(unavailable()),
};
