import type { RoleKey, ServiceResult } from '@/types';
import type { OffboardingInventoryCheck } from '@/types/inventory';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { inventoryDemoRepository } from './inventoryRepository.demo';
import { enforceInventoryPermission, INVENTORY_OFFBOARDING } from './inventoryPermissions';

const BLOCKING_STATUSES = [
  'planned',
  'issued',
  'acknowledged',
  'return_requested',
  'partially_returned',
  'overdue',
  'disputed',
] as const;

/**
 * Offboarding-Integration — blockiert Abschluss bei offenen rückgabepflichtigen Ausgaben.
 * Portal-Sperre und Geräte-Deaktivierung vorbereitet (kein Fake-MDM).
 */
export async function checkOffboardingInventory(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OffboardingInventoryCheck>> {
  const denied = enforceInventoryPermission<OffboardingInventoryCheck>(actorRoleKey, INVENTORY_OFFBOARDING);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const assignmentsResult = inventoryDemoRepository.listAssignmentsForEmployee(tenantId, employeeId);
  if (!assignmentsResult.ok) return assignmentsResult;

  const itemsResult = inventoryDemoRepository.listItems(tenantId);
  if (!itemsResult.ok) return itemsResult;
  const itemMap = new Map(itemsResult.data.map((i) => [i.id, i]));

  const openAssignments = assignmentsResult.data.filter((a) => {
    if (!BLOCKING_STATUSES.includes(a.status as (typeof BLOCKING_STATUSES)[number])) return false;
    if (!a.returnRequired) return false;
    const item = itemMap.get(a.itemId);
    return item?.requiresReturnOnExit !== false;
  });

  const returnTasksSuggested = openAssignments.map((a) => {
    const item = itemMap.get(a.itemId);
    return `Rückgabe: ${item?.name ?? a.itemId} (${a.status})`;
  });

  return {
    ok: true,
    data: {
      employeeId,
      canCompleteOffboarding: openAssignments.length === 0,
      openAssignments,
      returnTasksSuggested,
      portalLockPrepared: openAssignments.length > 0,
      deviceAccessDeactivatePrepared: openAssignments.some((a) => {
        const item = itemMap.get(a.itemId);
        return item?.categoryGroup === 'devices' || item?.categoryGroup === 'mobile_sim' || item?.categoryGroup === 'software_access';
      }),
    },
  };
}

export async function assertOffboardingCanComplete(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ allowed: boolean; reason?: string }>> {
  const check = await checkOffboardingInventory(tenantId, employeeId, actorRoleKey);
  if (!check.ok) return check;
  if (!check.data.canCompleteOffboarding) {
    return {
      ok: true,
      data: {
        allowed: false,
        reason: `Offboarding blockiert: ${check.data.openAssignments.length} offene Rückgabe(n).`,
      },
    };
  }
  return { ok: true, data: { allowed: true } };
}
