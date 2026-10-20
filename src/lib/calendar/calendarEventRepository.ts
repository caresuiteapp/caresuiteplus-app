import type { ServiceResult } from '@/types';
import type { CalendarEventRecord, GetCalendarEventsParams, PortalCalendarContext } from '@/types/calendar';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  CALENDAR_EVENT_SELECT_COLUMNS,
  mapCalendarEventRow,
} from '@/lib/calendar/calendarEventMapper';
import {
  filterCalendarRecords,
  filterCalendarRecordsByRange,
} from '@/lib/calendar/calendarFilters';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export type ListCalendarEventsQuery = Omit<GetCalendarEventsParams, 'actorRoleKey'>;

export const calendarEventRepository = {
  async list(params: ListCalendarEventsQuery): Promise<ServiceResult<CalendarEventRecord[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'calendar_events')
      .select(CALENDAR_EVENT_SELECT_COLUMNS)
      .eq('tenant_id', params.tenantId)
      .is('archived_at', null)
      .order('start_at', { ascending: true });

    if (params.rangeStart) {
      query = query.gte('end_at', params.rangeStart);
    }
    if (params.rangeEnd) {
      query = query.lte('start_at', params.rangeEnd);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        return { ok: true, data: [] };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const records = (data ?? []).map((row) => mapCalendarEventRow(row as never));
    const filtered = filterCalendarRecords(records, params.config);
    const ranged = filterCalendarRecordsByRange(filtered, params.rangeStart, params.rangeEnd);
    return { ok: true, data: ranged };
  },

  async listForPortal(
    tenantId: string,
    context: PortalCalendarContext,
    rangeStart?: string,
    rangeEnd?: string,
  ): Promise<ServiceResult<CalendarEventRecord[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'calendar_events')
      .select(CALENDAR_EVENT_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .is('archived_at', null)
      .order('start_at', { ascending: true });

    if (context.portalType === 'client' && context.clientId) {
      query = query
        .eq('related_client_id', context.clientId)
        .eq('is_client_portal_visible', true);
    } else if (context.portalType === 'resident' && context.clientId) {
      query = query
        .eq('related_client_id', context.clientId)
        .eq('is_client_portal_visible', true)
        .eq('module_key', 'stationaer');
    } else if (context.portalType === 'employee' && context.employeeId) {
      query = query
        .eq('related_employee_id', context.employeeId)
        .eq('is_employee_portal_visible', true);
    } else {
      return { ok: true, data: [] };
    }

    if (rangeStart) query = query.gte('end_at', rangeStart);
    if (rangeEnd) query = query.lte('start_at', rangeEnd);

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const records = (data ?? []).map((row) => mapCalendarEventRow(row as never));
    return { ok: true, data: records };
  },

  async upsert(record: Partial<CalendarEventRecord> & {
    tenantId: string;
    sourceType: string;
    sourceId: string;
    title: string;
    startAt: string;
    endAt: string;
  }): Promise<ServiceResult<CalendarEventRecord>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const payload = {
      tenant_id: record.tenantId,
      module_key: record.moduleKey ?? 'office',
      source_type: record.sourceType,
      source_id: record.sourceId,
      event_type: record.eventType ?? 'termin',
      title: record.title,
      description: record.description ?? null,
      internal_note: record.internalNote ?? null,
      public_note: record.publicNote ?? null,
      start_at: record.startAt,
      end_at: record.endAt,
      all_day: record.allDay ?? false,
      timezone: record.timezone ?? 'Europe/Berlin',
      status: record.status ?? 'aktiv',
      priority: record.priority ?? 'normal',
      location_type: record.locationType ?? null,
      location_name: record.locationName ?? null,
      address: record.address ?? null,
      room: record.room ?? null,
      related_client_id: record.relatedClientId ?? null,
      related_employee_id: record.relatedEmployeeId ?? null,
      related_ward_id: record.relatedWardId ?? null,
      related_case_id: record.relatedCaseId ?? null,
      related_document_id: record.relatedDocumentId ?? null,
      is_office_visible: record.isOfficeVisible ?? true,
      is_module_visible: record.isModuleVisible ?? true,
      is_client_portal_visible: record.isClientPortalVisible ?? false,
      is_employee_portal_visible: record.isEmployeePortalVisible ?? false,
      color_key: record.colorKey ?? record.moduleKey ?? 'office',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await fromUnknownTable(supabase, 'calendar_events')
      .upsert(payload, { onConflict: 'tenant_id,source_type,source_id' })
      .select(CALENDAR_EVENT_SELECT_COLUMNS)
      .single();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapCalendarEventRow(data as never) };
  },

  async archive(tenantId: string, eventId: string): Promise<ServiceResult<void>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { error } = await fromUnknownTable(supabase, 'calendar_events')
      .update({ archived_at: new Date().toISOString(), status: 'archiviert' })
      .eq('tenant_id', tenantId)
      .eq('id', eventId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: undefined };
  },

  async getBySource(
    tenantId: string,
    sourceType: string,
    sourceId: string,
  ): Promise<ServiceResult<CalendarEventRecord | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'calendar_events')
      .select(CALENDAR_EVENT_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: null };
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapCalendarEventRow(data as never) };
  },

  async archiveBySource(
    tenantId: string,
    sourceType: string,
    sourceId: string,
  ): Promise<ServiceResult<void>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { error } = await fromUnknownTable(supabase, 'calendar_events')
      .update({ archived_at: new Date().toISOString(), status: 'archiviert' })
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: undefined };
  },

  async updateStatusBySource(
    tenantId: string,
    sourceType: string,
    sourceId: string,
    status: string,
  ): Promise<ServiceResult<void>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { error } = await fromUnknownTable(supabase, 'calendar_events')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: undefined };
  },

  async listForEmployee(
    tenantId: string,
    employeeId: string,
    rangeStart?: string,
    rangeEnd?: string,
  ): Promise<ServiceResult<CalendarEventRecord[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'calendar_events')
      .select(CALENDAR_EVENT_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('related_employee_id', employeeId)
      .eq('is_employee_portal_visible', true)
      .is('archived_at', null)
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true });

    if (rangeStart) query = query.gte('end_at', rangeStart);
    if (rangeEnd) query = query.lte('start_at', rangeEnd);

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: (data ?? []).map((row) => mapCalendarEventRow(row as never)) };
  },

  async listForEmployeePortalTeam(
    tenantId: string,
    rangeStart?: string,
    rangeEnd?: string,
  ): Promise<ServiceResult<CalendarEventRecord[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'calendar_events')
      .select(CALENDAR_EVENT_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('is_employee_portal_visible', true)
      .is('archived_at', null)
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true });

    if (rangeStart) query = query.gte('end_at', rangeStart);
    if (rangeEnd) query = query.lte('start_at', rangeEnd);

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: (data ?? []).map((row) => mapCalendarEventRow(row as never)) };
  },

  async listForClient(
    tenantId: string,
    clientId: string,
    rangeStart?: string,
    rangeEnd?: string,
  ): Promise<ServiceResult<CalendarEventRecord[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'calendar_events')
      .select(CALENDAR_EVENT_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('related_client_id', clientId)
      .eq('is_client_portal_visible', true)
      .is('archived_at', null)
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true });

    if (rangeStart) query = query.gte('end_at', rangeStart);
    if (rangeEnd) query = query.lte('start_at', rangeEnd);

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: (data ?? []).map((row) => mapCalendarEventRow(row as never)) };
  },
};
