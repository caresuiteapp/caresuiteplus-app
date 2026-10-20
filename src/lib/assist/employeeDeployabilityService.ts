import type { RoleKey } from '@/types/core/auth';
import { hasPermission } from '@/lib/permissions';

/** Prüft ob Rolle Einsätze ausführen darf (Assist). */
export function roleCanPerformAssignment(roleKey: RoleKey | null | undefined): boolean {
  if (!roleKey) return false;
  return hasPermission(roleKey, 'assist.execution.manage') || hasPermission(roleKey, 'assist.assignments.manage');
}
