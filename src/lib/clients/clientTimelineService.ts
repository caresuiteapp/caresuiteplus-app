import type { ServiceResult } from '@/types';
import type { ClientTimelineEvent } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';
import { filterTimelineForPortal } from './portalFilter';

export async function fetchClientTimeline(
  tenantId: string,
  clientId: string,
  options?: { portalOnly?: boolean },
): Promise<ServiceResult<ClientTimelineEvent[]>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchTimeline(tenantId, clientId, options?.portalOnly);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const events = options?.portalOnly ? filterTimelineForPortal(full) : full.timeline;
    return { ok: true, data: events };
  }, { delayMs: 200 });
}

export async function addTimelineEvent(
  tenantId: string,
  clientId: string,
  event: Omit<ClientTimelineEvent, 'id' | 'clientId'>,
): Promise<ServiceResult<ClientTimelineEvent>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().addTimelineEvent(tenantId, clientId, event);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const entry: ClientTimelineEvent = {
      id: `tl-${clientId}-${Date.now()}`,
      clientId,
      ...event,
    };
    upsertDemoClientFullDetail({
      ...full,
      timeline: [entry, ...full.timeline],
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, data: entry };
  }, { delayMs: 250 });
}
