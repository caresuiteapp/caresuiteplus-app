import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { platformDemo } from '@/data/demo/domains/platformDemo';
import { enforcePermission } from '@/lib/permissions';

/** WP463 — Plattform Hub (OCR/KI) Dashboard-Service */
export async function fetchPlatformHubDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ ocrJobs: number; aiCapabilities: string[] }>> {
  const denied = enforcePermission<{ ocrJobs: number; aiCapabilities: string[] }>(actorRoleKey, 'platform.ocr.view' as never);
  if (denied) return denied;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 130));
  return {
    ok: true,
    data: {
      ocrJobs: platformDemo.records.length,
      aiCapabilities: ['ocr', 'summarize', 'classify', 'assist'],
    },
  };
}
