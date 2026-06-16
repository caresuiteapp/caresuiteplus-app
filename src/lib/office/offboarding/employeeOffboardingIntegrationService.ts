import type { RoleKey, ServiceResult } from '@/types';
import type { CanonicalAssignmentStatus } from '@/types/modules/assignmentWorkflow';
import type {
  EmployeeWorkMaterialRecord,
  EmployeeWorkMaterialStatus,
} from '@/types/modules/employeePersonnelFile';
import type { EmployeeTimePeriod } from '@/types/modules/employeeTime';
import { getCompletionChainStatus, listCompletionMonitorItems } from '@/lib/assist/assignmentCompletionChainService';
import { listAssignmentWorkflows } from '@/lib/assist/assignmentWorkflowService';
import { getConnectProviderPlaceholders } from '@/lib/connect/connectProviderService';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import { checkOffboardingInventory } from '@/lib/inventory/inventoryOffboardingService';
import { inventoryDemoRepository } from '@/lib/inventory/inventoryRepository.demo';
import { ABSENCE_STORE } from '@/lib/office/absenceStore';
import { isPeriodLocked } from '@/lib/office/employeeTime/employeeTimeCalculationService';
import { listPeriods } from '@/lib/office/employeeTime/employeeTimeStore';

const OPEN_ASSIGNMENT_STATUSES = new Set<CanonicalAssignmentStatus>([
  'planned',
  'assigned',
  'confirmed',
  'on_the_way',
  'arrived',
  'started',
  'paused',
  'resumed',
  'finished',
  'documentation_pending',
  'signature_pending',
  'cancel_requested',
  'reschedule_requested',
  'no_show',
  'missed',
  'corrected',
]);

const RETURN_PENDING_STATUSES = new Set<EmployeeWorkMaterialStatus>([
  'issued',
  'return_pending',
  'damaged',
  'lost',
]);

export type OffboardingIntegrationSnapshot = {
  openAssignments: number;
  openReplacements: number;
  openDocumentation: number;
  openCorrections: number;
  openSignatures: number;
  workTimeOpen: boolean;
  payrollPrepared: boolean;
  openReturns: number;
  portalActive: boolean;
  externalProviderConnected: boolean;
  workMaterials: EmployeeWorkMaterialRecord[];
  openPeriods: EmployeeTimePeriod[];
};

export function countOpenAssignmentsForEmployee(
  tenantId: string,
  employeeId: string,
): number {
  return listAssignmentWorkflows(tenantId).filter(
    (a) =>
      a.employeeId === employeeId &&
      OPEN_ASSIGNMENT_STATUSES.has(a.canonicalStatus),
  ).length;
}

export function countOpenReplacementsForEmployee(
  tenantId: string,
  employeeId: string,
): number {
  return ABSENCE_STORE.replacementRequests.filter(
    (r) =>
      r.tenantId === tenantId &&
      r.originalEmployeeId === employeeId &&
      r.status !== 'cancelled' &&
      r.status !== 'completed',
  ).length;
}

export function countOpenDocumentationForEmployee(
  tenantId: string,
  employeeId: string,
): number {
  return listCompletionMonitorItems(tenantId, 'missing_doc').filter(
    (item) => item.employeeId === employeeId,
  ).length;
}

export function countOpenCorrectionsForEmployee(
  tenantId: string,
  employeeId: string,
): number {
  return listCompletionMonitorItems(tenantId, 'correction_requested').filter(
    (item) => item.employeeId === employeeId,
  ).length;
}

export function countOpenSignaturesForEmployee(
  tenantId: string,
  employeeId: string,
): number {
  const missing = listCompletionMonitorItems(tenantId, 'missing_signature').filter(
    (item) => item.employeeId === employeeId,
  ).length;

  const chainPending = listAssignmentWorkflows(tenantId).filter((a) => {
    if (a.employeeId !== employeeId) return false;
    const chain = getCompletionChainStatus(a.id);
    return chain === 'signature_pending';
  }).length;

  return Math.max(missing, chainPending);
}

export function listEmployeeWorkMaterials(
  tenantId: string,
  employeeId: string,
): EmployeeWorkMaterialRecord[] {
  const file = getDemoEmployeePersonnelFile(employeeId);
  if (!file || file.tenantId !== tenantId) return [];
  return file.workMaterials;
}

export function countOpenInventoryReturns(
  tenantId: string,
  employeeId: string,
): number {
  const materialCount = listEmployeeWorkMaterials(tenantId, employeeId).filter((item) =>
    RETURN_PENDING_STATUSES.has(item.status),
  ).length;

  const assignmentsResult = inventoryDemoRepository.listAssignmentsForEmployee(tenantId, employeeId);
  if (!assignmentsResult.ok) return materialCount;

  const itemsResult = inventoryDemoRepository.listItems(tenantId);
  if (!itemsResult.ok) return materialCount;
  const itemMap = new Map(itemsResult.data.map((i) => [i.id, i]));

  const inventoryOpen = assignmentsResult.data.filter((a) => {
    const blocking = ['planned', 'issued', 'acknowledged', 'return_requested', 'partially_returned', 'overdue', 'disputed'];
    if (!blocking.includes(a.status)) return false;
    if (!a.returnRequired) return false;
    const item = itemMap.get(a.itemId);
    return item?.requiresReturnOnExit !== false;
  }).length;

  return Math.max(materialCount, inventoryOpen);
}

export async function countOpenInventoryReturnsWithInventoryModule(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
): Promise<number> {
  const base = countOpenInventoryReturns(tenantId, employeeId);
  const inventoryCheck = await checkOffboardingInventory(tenantId, employeeId, actorRoleKey);
  if (!inventoryCheck.ok) return base;
  return Math.max(base, inventoryCheck.data.openAssignments.length);
}

export function countOpenReturnsByCategory(
  tenantId: string,
  employeeId: string,
  category: EmployeeWorkMaterialRecord['category'],
): number {
  return listEmployeeWorkMaterials(tenantId, employeeId).filter(
    (item) => item.category === category && RETURN_PENDING_STATUSES.has(item.status),
  ).length;
}

export function recordWorkMaterialReturn(
  tenantId: string,
  employeeId: string,
  materialId: string,
  status: EmployeeWorkMaterialStatus = 'returned',
): EmployeeWorkMaterialRecord | null {
  const file = getDemoEmployeePersonnelFile(employeeId);
  if (!file || file.tenantId !== tenantId) return null;

  const material = file.workMaterials.find((m) => m.id === materialId);
  if (!material) return null;

  material.status = status;
  material.updatedAt = new Date().toISOString();
  return material;
}

export function listOpenEmployeeTimePeriods(
  tenantId: string,
  employeeId: string,
): EmployeeTimePeriod[] {
  return listPeriods(tenantId, employeeId).filter((p) => !isPeriodLocked(p.status));
}

export function isWorkTimeClosedForEmployee(
  tenantId: string,
  employeeId: string,
): boolean {
  const periods = listPeriods(tenantId, employeeId);
  if (periods.length === 0) return true;
  return periods.every((p) => isPeriodLocked(p.status));
}

export function isPayrollExportPreparedForEmployee(
  tenantId: string,
  employeeId: string,
): boolean {
  const periods = listPeriods(tenantId, employeeId);
  if (periods.length === 0) return true;
  return periods.some(
    (p) => p.status === 'exported' || p.status === 'locked' || p.exportedAt != null,
  );
}

export function isPortalAccessActive(tenantId: string, employeeId: string): boolean {
  const file = getDemoEmployeePersonnelFile(employeeId);
  if (!file || file.tenantId !== tenantId) return false;
  return file.portalAccess.portalActive;
}

export function lockEmployeePortalAccess(
  tenantId: string,
  employeeId: string,
): boolean {
  const file = getDemoEmployeePersonnelFile(employeeId);
  if (!file || file.tenantId !== tenantId) return false;
  file.portalAccess.portalActive = false;
  file.portalAccess.lastLoginAt = file.portalAccess.lastLoginAt;
  return true;
}

export function isExternalAccessProviderConnected(tenantId: string): boolean {
  const providers = getConnectProviderPlaceholders(tenantId);
  const externalKeys = new Set(['email', 'personio', 'microsoft365', 'google_workspace']);
  return providers.some(
    (p) => externalKeys.has(p.integrationKey) && p.status !== 'not_configured',
  );
}

export function buildOffboardingIntegrationSnapshot(
  tenantId: string,
  employeeId: string,
): OffboardingIntegrationSnapshot {
  return {
    openAssignments: countOpenAssignmentsForEmployee(tenantId, employeeId),
    openReplacements: countOpenReplacementsForEmployee(tenantId, employeeId),
    openDocumentation: countOpenDocumentationForEmployee(tenantId, employeeId),
    openCorrections: countOpenCorrectionsForEmployee(tenantId, employeeId),
    openSignatures: countOpenSignaturesForEmployee(tenantId, employeeId),
    workTimeOpen: !isWorkTimeClosedForEmployee(tenantId, employeeId),
    payrollPrepared: isPayrollExportPreparedForEmployee(tenantId, employeeId),
    openReturns: countOpenInventoryReturns(tenantId, employeeId),
    portalActive: isPortalAccessActive(tenantId, employeeId),
    externalProviderConnected: isExternalAccessProviderConnected(tenantId),
    workMaterials: listEmployeeWorkMaterials(tenantId, employeeId),
    openPeriods: listOpenEmployeeTimePeriods(tenantId, employeeId),
  };
}

export function setEmployeeEmploymentStatusAfterOffboarding(
  tenantId: string,
  employeeId: string,
  status: 'terminated' | 'archived',
): boolean {
  const file = getDemoEmployeePersonnelFile(employeeId);
  if (!file || file.tenantId !== tenantId) return false;
  file.employment.employmentStatus = status;
  file.masterData.exitDate = file.masterData.exitDate;
  file.masterData.status = status === 'archived' ? 'archiviert' : 'beendet';
  return true;
}
