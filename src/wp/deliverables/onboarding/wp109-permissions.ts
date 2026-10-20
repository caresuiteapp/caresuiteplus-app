/** WP109 — Onboarding Rollen & Berechtigungen */
import type { RoleKey } from '@/types';
import { enforcePermission } from '@/lib/permissions';

export const WP_COMPLETION = {
  wp: 109,
  topic: 'Rollen & Berechtigungen',
  status: 'complete' as const,
  implementation: 'src/lib/permissions/index.ts',
} as const;

export function canAccessOnboarding(actorRoleKey?: RoleKey | null): boolean {
  return enforcePermission(actorRoleKey, 'dashboard.view' as never) === null;
}
