import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  emptyTrackingDashboard,
  mapTrackingDashboardRow,
  TRACKING_DASHBOARD_SELECT_COLUMNS,
  type TrackingDashboardLiveRow,
} from '@/lib/assist/trackingDashboardMapper';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export const TRACKING_DASHBOARD_TABLE = 'assist_tracking_dashboard';

/** WP320 — Live Supabase Repository (Assist Live-Tracking Dashboard) */
export const trackingSupabaseRepository = {
  wpNumber: 320,
  table: TRACKING_DASHBOARD_TABLE,
  entityLabel: 'Live-Tracking',

  async getDashboardForTenant(
    tenantId: string,
  ): Promise<ServiceResult<TrackingDashboardLiveRow | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, TRACKING_DASHBOARD_TABLE)
      .select(TRACKING_DASHBOARD_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data as TrackingDashboardLiveRow | null) ?? null };
  },

  async getDashboardMapped(tenantId: string) {
    const result = await this.getDashboardForTenant(tenantId);
    if (!result.ok) return result;
    if (!result.data) {
      return { ok: true as const, data: emptyTrackingDashboard() };
    }
    return mapTrackingDashboardRow(result.data);
  },
};

export type { TrackingDashboardLiveRow };
