import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { TenantTableRow } from './createTenantTableRepository';
import {
  mapResidentRowToDetail,
  RESIDENT_DETAIL_SELECT_COLUMNS,
  type ResidentDetailLiveRow,
} from '@/lib/stationaer/residentDetailMapper';
import {
  mapResidentRowsToListItems,
  RESIDENT_LIVE_SELECT_COLUMNS,
  type ResidentLiveRow,
} from '@/lib/stationaer/residentListMapper';
import type { ResidentListItem } from '@/types/modules/stationaer';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP390 — Live Supabase Repository (Stationaer) */
export const stationaerSupabaseRepository = {
  wpNumber: 390,
  table: 'care_records',
  entityLabel: 'Stationaer',

  async list(tenantId: string): Promise<ServiceResult<TenantTableRow[]>> {
    const result = await this.listForResidents(tenantId);
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data.map((row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        title: row.title,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    };
  },

  async listForResidents(tenantId: string): Promise<ServiceResult<ResidentLiveRow[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'care_records')
      .select(RESIDENT_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('record_type', 'resident')
      .order('updated_at', { ascending: false });
    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return { ok: true, data: [], tableMissing: true };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    return { ok: true, data: (data ?? []) as unknown as ResidentLiveRow[] };
  },

  async listMapped(tenantId: string): Promise<ServiceResult<ResidentListItem[]>> {
    const result = await this.listForResidents(tenantId);
    if (!result.ok) return result;
    if (result.tableMissing) {
      return { ok: true, data: [] as ResidentListItem[], tableMissing: true };
    }
    return mapResidentRowsToListItems(result.data);
  },

  async getByIdForResident(
    residentId: string,
    tenantId: string,
  ): Promise<ServiceResult<ResidentDetailLiveRow | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'care_records')
      .select(RESIDENT_DETAIL_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('record_type', 'resident')
      .eq('id', residentId)
      .maybeSingle();
    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return { ok: true, data: null, tableMissing: true };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    return { ok: true, data: (data as ResidentDetailLiveRow | null) ?? null };
  },

  async getDetailMapped(residentId: string, tenantId: string) {
    const result = await this.getByIdForResident(residentId, tenantId);
    if (!result.ok) return result;
    if (!result.data) {
      return { ok: false as const, error: 'Bewohner:in nicht gefunden.' };
    }
    return mapResidentRowToDetail(result.data);
  },
};

export type { ResidentDetailLiveRow, ResidentLiveRow };
