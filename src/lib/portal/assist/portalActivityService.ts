import type { ServiceResult } from '@/types';
import type { PortalActivity, PortalActivityType } from '@/types/portal/assist';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';

export type LogPortalActivityInput = {
  tenantId: string;
  clientId: string;
  portalUserId?: string | null;
  moduleKey?: string;
  activityType: PortalActivityType;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapActivityRow(row: Record<string, unknown>): PortalActivity {
  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenant_id ?? ''),
    clientId: String(row.client_id ?? ''),
    portalUserId: row.portal_user_id ? String(row.portal_user_id) : null,
    moduleKey: String(row.module_key ?? 'assist'),
    activityType: String(row.activity_type ?? 'system') as PortalActivityType,
    title: String(row.title ?? ''),
    description: row.description ? String(row.description) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

/** List recent portal activities for client overview feed. */
export async function listPortalActivities(
  tenantId: string,
  clientId: string,
  limit = 10,
): Promise<ServiceResult<PortalActivity[]>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'portal_activities')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return {
      ok: true,
      data: ((data ?? []) as Record<string, unknown>[]).map(mapActivityRow),
    };
  });
}

/** Insert a portal activity row (best-effort — does not throw). */
export async function logPortalActivity(input: LogPortalActivityInput): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await fromUnknownTable(supabase, 'portal_activities').insert({
    tenant_id: input.tenantId,
    client_id: input.clientId,
    portal_user_id: input.portalUserId ?? null,
    module_key: input.moduleKey ?? 'assist',
    activity_type: input.activityType,
    title: input.title,
    description: input.description?.trim() || null,
    metadata: input.metadata ?? {},
  });

  if (error && !isMissingTableError(error)) {
    console.warn('[logPortalActivity]', error.message);
  }
}
