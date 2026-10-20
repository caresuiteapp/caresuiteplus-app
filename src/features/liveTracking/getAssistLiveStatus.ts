/**
 * Assist Live-Status — delegates to getAssistLiveMonitoring (ASSIST.LIVE.1).
 */
import type { RoleKey, ServiceResult } from '@/types';
import {
  getAssistLiveMonitoring,
  formatTimerSeconds,
  type AssistLiveMonitoringOverview,
  type AssistLiveMonitoringRow,
} from '@/features/assistLive/getAssistLiveMonitoring';

export type AssistLiveStatusRow = AssistLiveMonitoringRow;
export type AssistLiveStatusOverview = AssistLiveMonitoringOverview;

export async function getAssistLiveStatus(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistLiveStatusOverview>> {
  return getAssistLiveMonitoring(tenantId, actorRoleKey);
}

export { formatTimerSeconds };
