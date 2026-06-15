import type { ServiceResult } from '@/types';
import type { VitalReadingListItem, VitalReadingType } from '@/types/modules/pflege';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  mapVitalSignOverviewRowToDetail,
  mapVitalSignOverviewRows,
  parseVitalReadingId,
  VITAL_SIGN_OVERVIEW_SELECT_COLUMNS,
  type VitalSignOverviewRow,
} from '@/lib/pflege/vitalSignListMapper';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP380 — Live Supabase Repository (vital_signs via v_vital_sign_overview) */
export const vitalSignSupabaseRepository = {
  wpNumber: 380,
  table: 'v_vital_sign_overview',
  entityLabel: 'Vitalwert',

  async listOverview(tenantId: string): Promise<ServiceResult<VitalSignOverviewRow[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'v_vital_sign_overview')
      .select(VITAL_SIGN_OVERVIEW_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('measured_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as unknown as VitalSignOverviewRow[] };
  },

  async listMapped(tenantId: string): Promise<ServiceResult<VitalReadingListItem[]>> {
    const result = await this.listOverview(tenantId);
    if (!result.ok) return result;
    return mapVitalSignOverviewRows(result.data);
  },

  async getOverviewById(
    tenantId: string,
    baseId: string,
  ): Promise<ServiceResult<VitalSignOverviewRow | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'v_vital_sign_overview')
      .select(VITAL_SIGN_OVERVIEW_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', baseId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data as VitalSignOverviewRow | null) ?? null };
  },

  async getDetailMapped(
    readingId: string,
    tenantId: string,
  ): Promise<ServiceResult<VitalReadingListItem>> {
    const parsed = parseVitalReadingId(readingId);
    if (!parsed) {
      return { ok: false, error: 'Vitalwert-Messung nicht gefunden.' };
    }

    const result = await this.getOverviewById(tenantId, parsed.baseId);
    if (!result.ok) return result;
    if (!result.data) {
      return { ok: false, error: 'Vitalwert-Messung nicht gefunden.' };
    }

    const mapped = mapVitalSignOverviewRowToDetail(result.data, parsed.type as VitalReadingType);
    if (!mapped) {
      return { ok: false, error: 'Vitalwert-Messung nicht gefunden.' };
    }

    return { ok: true, data: mapped };
  },
};
