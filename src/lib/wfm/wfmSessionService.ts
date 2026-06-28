import type { RoleKey, ServiceResult } from '@/types';
import type { WfmWorkSession } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  listSessionsForDate,
  todayWorkDate,
} from './wfmWorkSessionRepository';

export async function listTeamSessionsToday(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<WfmWorkSession[]>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return listSessionsForDate(tenantId, todayWorkDate());
}

export async function listActiveTeamSessions(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<WfmWorkSession[]>> {
  const result = await listTeamSessionsToday(tenantId, actorRoleKey);
  if (!result.ok) return result;

  const active = result.data.filter(
    (s) => s.isOnline && !['offline', 'ended'].includes(s.status),
  );
  return { ok: true, data: active };
}
