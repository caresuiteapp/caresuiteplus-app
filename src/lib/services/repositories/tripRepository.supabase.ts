import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { TenantTableRow } from './createTenantTableRepository';
import {
  mapTripRowToDetail,
  TRIP_DETAIL_SELECT_COLUMNS,
  type TripDetailLiveRow,
} from '@/lib/assist/tripDetailMapper';
import {
  mapTripRowsToListItems,
  TRIP_LIVE_SELECT_COLUMNS,
  type TripLiveRow,
} from '@/lib/assist/tripListMapper';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP310 — Live Supabase Repository (trips) */
export const tripSupabaseRepository = {
  wpNumber: 310,
  table: 'trips',
  entityLabel: 'Fahrt',

  async list(tenantId: string): Promise<ServiceResult<TenantTableRow[]>> {
    const result = await this.listForTripLog(tenantId);
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

  async listForTripLog(tenantId: string): Promise<ServiceResult<TripLiveRow[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'trips')
      .select(TRIP_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return { ok: true, data: [], tableMissing: true };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    return { ok: true, data: (data ?? []) as unknown as TripLiveRow[] };
  },

  async listMapped(tenantId: string) {
    const result = await this.listForTripLog(tenantId);
    if (!result.ok) return result;
    const mapped = mapTripRowsToListItems(result.data);
    if (!mapped.ok) return mapped;
    if (result.tableMissing) {
      return { ...mapped, tableMissing: true };
    }
    return mapped;
  },

  async getByIdForTripLog(
    tripId: string,
    tenantId: string,
  ): Promise<ServiceResult<TripDetailLiveRow | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'trips')
      .select(TRIP_DETAIL_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', tripId)
      .maybeSingle();
    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return { ok: true, data: null, tableMissing: true };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    return { ok: true, data: (data as TripDetailLiveRow | null) ?? null };
  },

  async getDetailMapped(tripId: string, tenantId: string) {
    const result = await this.getByIdForTripLog(tripId, tenantId);
    if (!result.ok) return result;
    if (result.tableMissing) {
      return { ok: false as const, error: 'Fahrt nicht gefunden.' };
    }
    if (!result.data) {
      return { ok: false as const, error: 'Fahrt nicht gefunden.' };
    }
    return mapTripRowToDetail(result.data);
  },

  async completeTrip(
    tripId: string,
    tenantId: string,
    endAddress: string,
    distanceKm: number,
  ): Promise<ServiceResult<TripDetailLiveRow>> {
    const existing = await this.getByIdForTripLog(tripId, tenantId);
    if (!existing.ok) return existing;
    if (!existing.data) {
      return { ok: false, error: 'Fahrt nicht gefunden.' };
    }
    if (existing.data.ended_at || existing.data.status === 'abgeschlossen') {
      return { ok: false, error: 'Fahrt ist bereits abgeschlossen.' };
    }

    const trimmedEnd = endAddress.trim();
    if (!trimmedEnd) {
      return { ok: false, error: 'Zieladresse ist erforderlich.' };
    }
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      return { ok: false, error: 'Distanz muss eine gültige Zahl ≥ 0 sein.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const now = new Date().toISOString();
    const { data, error } = await fromUnknownTable(supabase, 'trips')
      .update({
        end_address: trimmedEnd,
        distance_km: distanceKm,
        ended_at: now,
        status: 'abgeschlossen',
        updated_at: now,
      } as Record<string, unknown>)
      .eq('tenant_id', tenantId)
      .eq('id', tripId)
      .is('ended_at', null)
      .select(TRIP_DETAIL_SELECT_COLUMNS)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) {
      return { ok: false, error: 'Fahrt konnte nicht abgeschlossen werden.' };
    }
    return { ok: true, data: data as TripDetailLiveRow };
  },

  async completeTripMapped(
    tripId: string,
    tenantId: string,
    endAddress: string,
    distanceKm: number,
  ) {
    const result = await this.completeTrip(tripId, tenantId, endAddress, distanceKm);
    if (!result.ok) return result;
    return mapTripRowToDetail(result.data);
  },
};

export type { TripDetailLiveRow, TripLiveRow };
