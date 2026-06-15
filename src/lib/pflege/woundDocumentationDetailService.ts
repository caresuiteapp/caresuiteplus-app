import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import {
  getDemoWoundDocumentationDetail,
  type WoundDocumentationDetail,
} from './woundDocumentationDetailStats';

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** WP379 — Wunddokumentation Detail (Demo / preparedOnly) */
export async function fetchWoundDocumentationDetail(
  woundId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<WoundDocumentationDetail>> {
  const denied = enforcePermission<WoundDocumentationDetail>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    // Demo-funktional fallback
  }

  await demoDelay();
  const detail = getDemoWoundDocumentationDetail(woundId);
  if (!detail) {
    return { ok: false, error: 'Wundfall nicht gefunden.' };
  }
  return { ok: true, data: detail };
}
