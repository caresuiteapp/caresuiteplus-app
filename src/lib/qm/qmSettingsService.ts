import type { RoleKey, ServiceResult } from '@/types';

export type QmSettingsSnapshot = {
  reviewCycleMonths: number;
  approvalWorkflow: string;
  mdTokenDays: number;
};

/** QM-Einstellungen — Mandanten-Konfiguration (Demo) */
export async function fetchQmSettingsSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmSettingsSnapshot>> {
  void tenantId;
  void actorRoleKey;
  await new Promise((r) => setTimeout(r, 100));
  return {
    ok: true,
    data: {
      reviewCycleMonths: 12,
      approvalWorkflow: 'QMB → PDL → Veröffentlichung',
      mdTokenDays: 90,
    },
  };
}
