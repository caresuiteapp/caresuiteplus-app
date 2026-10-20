import type { ServiceResult } from '@/types';
import type {
  HandoverDetail,
  HandoverReportListItem,
  LivingAreaDetail,
  LivingAreaListItem,
} from '@/types/modules/stationaer';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  HANDOVER_LIVE_SELECT_COLUMNS,
  LIVING_AREA_LIVE_SELECT_COLUMNS,
  mapHandoverRowToDetail,
  mapHandoverRowToListItem,
  mapLivingAreaRowToDetail,
  mapLivingAreaRowsToListItems,
  type HandoverLiveRow,
  type LivingAreaLiveRow,
} from '@/lib/stationaer/livingAreaExtensionMapper';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP390 Extension — Live Supabase (Migration 0036) */
export const stationaerExtensionSupabaseRepository = {
  wpNumber: 390,
  migration: '0036_module_extensions_prepared',

  async listLivingAreasMapped(tenantId: string): Promise<ServiceResult<LivingAreaListItem[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable<LivingAreaListItem[]>();
    const { data, error } = await fromUnknownTable(supabase, 'stationaer_living_areas')
      .select(LIVING_AREA_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const rows = (data ?? []) as unknown as LivingAreaLiveRow[];
    return { ok: true, data: mapLivingAreaRowsToListItems(rows) };
  },

  async getLivingAreaDetailMapped(
    tenantId: string,
    areaId: string,
  ): Promise<ServiceResult<LivingAreaDetail>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable<LivingAreaDetail>();
    const { data, error } = await fromUnknownTable(supabase, 'stationaer_living_areas')
      .select(LIVING_AREA_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', areaId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Wohnbereich nicht gefunden.' };
    return {
      ok: true,
      data: mapLivingAreaRowToDetail(data as unknown as LivingAreaLiveRow),
    };
  },

  async listHandoversMapped(tenantId: string): Promise<ServiceResult<HandoverReportListItem[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable<HandoverReportListItem[]>();
    const { data, error } = await fromUnknownTable(supabase, 'stationaer_handovers')
      .select(HANDOVER_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('handover_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const rows = (data ?? []) as unknown as HandoverLiveRow[];
    return { ok: true, data: rows.map(mapHandoverRowToListItem) };
  },

  async getHandoverDetailMapped(
    tenantId: string,
    handoverId: string,
  ): Promise<ServiceResult<HandoverDetail>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable<HandoverDetail>();
    const { data, error } = await fromUnknownTable(supabase, 'stationaer_handovers')
      .select(HANDOVER_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', handoverId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Übergabebericht nicht gefunden.' };
    return {
      ok: true,
      data: mapHandoverRowToDetail(data as unknown as HandoverLiveRow),
    };
  },
};
