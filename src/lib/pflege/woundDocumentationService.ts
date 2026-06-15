import type { RoleKey, ServiceResult } from '@/types';
import type { WoundDocumentation } from '@/types/modules/pflege';
import { createDemoWound, getDemoWoundDocumentations } from '@/data/demo/woundDocumentations';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { isPflegeDemoFunctional } from '@/lib/pflege/pflegeModuleConfig';

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** WP375 — Wunddokumentation Liste (Demo / preparedOnly) */
export async function fetchWoundDocumentationList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<WoundDocumentation[]>> {
  const denied = enforcePermission<WoundDocumentation[]>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    // Demo-funktional fallback until wounds live repo ships
  }

  await demoDelay();
  return { ok: true, data: getDemoWoundDocumentations() };
}

/** Wunddokumentation anlegen — Demo-Persistenz */
export async function createWoundDocumentation(
  tenantId: string,
  input: {
    clientId: string;
    bodyLocation: string;
    description: string;
    woundType?: string;
    woundSize?: string;
  },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<WoundDocumentation>> {
  const denied = enforcePermission<WoundDocumentation>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!isPflegeDemoFunctional()) {
    return { ok: false, error: 'Wunddokumentation anlegen: Demo-Modus erforderlich.' };
  }

  await demoDelay(280);
  const wound = createDemoWound({
    clientId: input.clientId,
    bodyLocation: input.bodyLocation.trim(),
    description: [input.woundType, input.woundSize, input.description].filter(Boolean).join(' · '),
  });
  return { ok: true, data: wound };
}
