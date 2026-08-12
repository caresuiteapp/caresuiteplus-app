import type { ServiceResult } from '@/types';
import type { VitalReadingListItem, VitalReadingType } from '@/types/modules/pflege';
import { getVitalDefinition } from '@/lib/pflege/vitalCatalog';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

export type VitalClientConfiguration = {
  key: VitalReadingType;
  enabled: boolean;
  limits: Record<string, { min?: number; max?: number }>;
  schedule: Record<string, unknown>;
};

export type VitalClientOption = { id: string; name: string };

export type RecordVitalMeasurementInput = {
  clientId: string;
  type: VitalReadingType;
  values?: Record<string, number>;
  /** Compatibility for callers of the former single-value API. */
  value?: string;
  context?: Record<string, string>;
  note?: string;
  source?: 'manual' | 'device' | 'import';
};

type LiveVitalRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  client_name: string | null;
  vital_key: string;
  display_value: string;
  unit: string | null;
  values: Record<string, number> | null;
  context: Record<string, string> | null;
  note: string | null;
  measured_at: string;
  recorded_by: string | null;
  recorded_by_name: string | null;
  source: 'manual' | 'device' | 'import';
  flag_status: 'unrated' | 'within_configured_range' | 'outside_configured_range';
  created_at: string;
};

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapRow(row: LiveVitalRow): VitalReadingListItem {
  const definition = getVitalDefinition(row.vital_key);
  const alert = row.flag_status === 'outside_configured_range';
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    carePlanId: null,
    type: row.vital_key as VitalReadingType,
    value: row.display_value,
    unit: row.unit ?? '',
    measuredAt: row.measured_at,
    recordedById: row.recorded_by,
    recordedByName: row.recorded_by_name,
    source: row.source,
    context: row.context ?? {},
    note: row.note,
    flagStatus: row.flag_status,
    status: alert ? 'fehlerhaft' : 'aktiv',
    sensitivity: 'health',
    createdAt: row.created_at,
    updatedAt: row.created_at,
    visibility: 'team',
    clientName: row.client_name?.trim() || '—',
    typeLabel: definition?.label ?? row.vital_key,
    isDue: false,
    isAlert: alert,
  };
}

export const vitalSignSupabaseRepository = {
  table: 'vital_sign_measurements',
  view: 'v_vital_measurement_overview',

  async listActiveClients(tenantId: string): Promise<ServiceResult<VitalClientOption[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'clients')
      .select('id, first_name, last_name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('last_name', { ascending: true });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return {
      ok: true,
      data: ((data ?? []) as { id: string; first_name?: string; last_name?: string }[]).map((row) => ({
        id: row.id,
        name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Ohne Namen',
      })),
    };
  },

  async listMapped(tenantId: string): Promise<ServiceResult<VitalReadingListItem[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, this.view)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('measured_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: ((data ?? []) as LiveVitalRow[]).map(mapRow) };
  },

  async getDetailMapped(readingId: string, tenantId: string): Promise<ServiceResult<VitalReadingListItem>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, this.view)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', readingId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Vitalwert-Messung nicht gefunden.' };
    return { ok: true, data: mapRow(data as LiveVitalRow) };
  },

  async getClientConfiguration(clientId: string): Promise<ServiceResult<VitalClientConfiguration[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase.rpc('get_client_vital_sign_configuration' as never, {
      p_client_id: clientId,
    } as never);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return {
      ok: true,
      data: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        key: String(row.vital_key) as VitalReadingType,
        enabled: Boolean(row.enabled),
        limits: (row.limits ?? {}) as VitalClientConfiguration['limits'],
        schedule: (row.schedule ?? {}) as Record<string, unknown>,
      })),
    };
  },

  async setClientConfiguration(
    clientId: string,
    type: VitalReadingType,
    enabled: boolean,
    limits: VitalClientConfiguration['limits'] = {},
    schedule: Record<string, unknown> = {},
  ): Promise<ServiceResult<VitalClientConfiguration>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase.rpc('set_client_vital_sign_configuration' as never, {
      p_client_id: clientId,
      p_vital_key: type,
      p_enabled: enabled,
      p_limits: limits,
      p_schedule: schedule,
    } as never);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const row = data as unknown as Record<string, unknown>;
    return { ok: true, data: { key: type, enabled: Boolean(row.enabled), limits, schedule } };
  },

  async create(input: RecordVitalMeasurementInput): Promise<ServiceResult<VitalReadingListItem>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const legacyNumber = input.value == null ? Number.NaN : Number(input.value.replace(',', '.'));
    const values = input.values ?? (Number.isFinite(legacyNumber) ? { value: legacyNumber } : {});
    const { data, error } = await supabase.rpc('record_vital_sign_measurement' as never, {
      p_client_id: input.clientId,
      p_vital_key: input.type,
      p_values: values,
      p_context: input.context ?? {},
      p_note: input.note?.trim() || null,
      p_source: input.source ?? 'manual',
    } as never);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const measurementId = String((data as unknown as { id?: string })?.id ?? '');
    if (!measurementId) return { ok: false, error: 'Die Messung wurde nicht bestätigt.' };
    return this.getDetailMapped(measurementId, String((data as unknown as { tenant_id?: string }).tenant_id ?? ''));
  },
};
