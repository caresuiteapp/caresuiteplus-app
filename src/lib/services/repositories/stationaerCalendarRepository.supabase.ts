import type { ServiceResult, WorkflowStatus } from '@/types';
import type { StationaerCalendarSourceType } from '@/types/calendar';
import type {
  StationaerCalendarCreateInput,
  StationaerCalendarEntity,
  StationaerCalendarUpdateInput,
} from '@/types/modules/stationaerCalendar';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { STATIONAER_CALENDAR_SOURCE_TYPES } from '@/lib/calendar/calendarSourceRegistry';

const CALENDAR_RECORD_TYPES = STATIONAER_CALENDAR_SOURCE_TYPES;

const SELECT_COLUMNS = [
  'id',
  'tenant_id',
  'record_type',
  'title',
  'status',
  'notes',
  'starts_at',
  'ends_at',
  'related_resident_id',
  'related_ward_id',
  'related_employee_id',
  'room_name',
  'location_type',
  'location_name',
  'is_client_portal_visible',
  'is_employee_portal_visible',
  'is_relative_portal_visible',
  'updated_at',
].join(', ');

type CareRecordCalendarRow = {
  id: string;
  tenant_id: string;
  record_type: string;
  title: string;
  status: string;
  notes: string | null;
  starts_at: string | null;
  ends_at: string | null;
  related_resident_id: string | null;
  related_ward_id: string | null;
  related_employee_id: string | null;
  room_name: string | null;
  location_type: string | null;
  location_name: string | null;
  is_client_portal_visible: boolean | null;
  is_employee_portal_visible: boolean | null;
  is_relative_portal_visible: boolean | null;
  updated_at: string;
};

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapRow(row: CareRecordCalendarRow): StationaerCalendarEntity {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sourceType: row.record_type as StationaerCalendarSourceType,
    title: row.title,
    description: row.notes,
    startAt: row.starts_at ?? row.updated_at,
    endAt: row.ends_at ?? row.starts_at ?? row.updated_at,
    allDay: false,
    status: row.status as WorkflowStatus,
    relatedResidentId: row.related_resident_id,
    relatedWardId: row.related_ward_id,
    relatedEmployeeId: row.related_employee_id,
    room: row.room_name,
    locationType: row.location_type,
    locationName: row.location_name,
    isClientPortalVisible: row.is_client_portal_visible ?? false,
    isEmployeePortalVisible: row.is_employee_portal_visible ?? false,
    isRelativePortalVisible: row.is_relative_portal_visible ?? false,
    updatedAt: row.updated_at,
  };
}

function buildInsertPayload(
  tenantId: string,
  input: StationaerCalendarCreateInput,
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    record_type: input.sourceType,
    title: input.title.trim(),
    status: input.status ?? 'aktiv',
    notes: input.description?.trim() ?? null,
    starts_at: input.startAt,
    ends_at: input.endAt,
    related_resident_id: input.relatedResidentId ?? null,
    related_ward_id: input.relatedWardId ?? null,
    related_employee_id: input.relatedEmployeeId ?? null,
    room_name: input.room ?? null,
    location_type: input.locationType ?? null,
    location_name: input.locationName ?? null,
    is_client_portal_visible: input.isClientPortalVisible ?? false,
    is_employee_portal_visible: input.isEmployeePortalVisible ?? false,
    is_relative_portal_visible: input.isRelativePortalVisible ?? false,
  };
}

function buildUpdatePayload(input: StationaerCalendarUpdateInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.title != null) payload.title = input.title.trim();
  if (input.description !== undefined) payload.notes = input.description?.trim() ?? null;
  if (input.startAt != null) payload.starts_at = input.startAt;
  if (input.endAt != null) payload.ends_at = input.endAt;
  if (input.status != null) payload.status = input.status;
  if (input.relatedResidentId !== undefined) payload.related_resident_id = input.relatedResidentId;
  if (input.relatedWardId !== undefined) payload.related_ward_id = input.relatedWardId;
  if (input.relatedEmployeeId !== undefined) payload.related_employee_id = input.relatedEmployeeId;
  if (input.room !== undefined) payload.room_name = input.room;
  if (input.locationType !== undefined) payload.location_type = input.locationType;
  if (input.locationName !== undefined) payload.location_name = input.locationName;
  if (input.isClientPortalVisible !== undefined) {
    payload.is_client_portal_visible = input.isClientPortalVisible;
  }
  if (input.isEmployeePortalVisible !== undefined) {
    payload.is_employee_portal_visible = input.isEmployeePortalVisible;
  }
  if (input.isRelativePortalVisible !== undefined) {
    payload.is_relative_portal_visible = input.isRelativePortalVisible;
  }
  return payload;
}

export const stationaerCalendarSupabaseRepository = {
  async list(tenantId: string): Promise<ServiceResult<StationaerCalendarEntity[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'care_records')
      .select(SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .in('record_type', CALENDAR_RECORD_TYPES)
      .order('starts_at', { ascending: true });

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return { ok: true, data: [], tableMissing: true };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: (data ?? []).map((row) => mapRow(row as unknown as CareRecordCalendarRow)) };
  },

  async getById(
    tenantId: string,
    id: string,
  ): Promise<ServiceResult<StationaerCalendarEntity | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'care_records')
      .select(SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .in('record_type', CALENDAR_RECORD_TYPES)
      .maybeSingle();

    if (error) {
      if (isSupabaseMissingTableError(error)) return { ok: true, data: null, tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapRow(data as unknown as CareRecordCalendarRow) };
  },

  async create(
    tenantId: string,
    input: StationaerCalendarCreateInput,
  ): Promise<ServiceResult<StationaerCalendarEntity>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'care_records')
      .insert(buildInsertPayload(tenantId, input))
      .select(SELECT_COLUMNS)
      .single();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapRow(data as unknown as CareRecordCalendarRow) };
  },

  async update(
    tenantId: string,
    id: string,
    input: StationaerCalendarUpdateInput,
  ): Promise<ServiceResult<StationaerCalendarEntity>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'care_records')
      .update(buildUpdatePayload(input))
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .in('record_type', CALENDAR_RECORD_TYPES)
      .select(SELECT_COLUMNS)
      .single();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapRow(data as unknown as CareRecordCalendarRow) };
  },

  async archive(tenantId: string, id: string): Promise<ServiceResult<void>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { error } = await fromUnknownTable(supabase, 'care_records')
      .update({ status: 'archiviert' })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .in('record_type', CALENDAR_RECORD_TYPES);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: undefined };
  },

  async cancel(tenantId: string, id: string): Promise<ServiceResult<void>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { error } = await fromUnknownTable(supabase, 'care_records')
      .update({ status: 'cancelled' })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .in('record_type', CALENDAR_RECORD_TYPES);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: undefined };
  },
};
