import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type WfmTravelRule = {
  id: string;
  tenantId: string;
  name: string;
  minGapMinutes: number;
  maxGapMinutes: number | null;
  countsAsWorkTime: boolean;
  roundToMinutes: number;
  mileageRateCents: number;
  priority: number;
  isActive: boolean;
  notes: string;
};

export type WfmMeetingEmployee = { id: string; name: string };
export type WfmTeamMeeting = {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  countsAsWorkTime: boolean;
  attendeeIds: string[];
  attendeeNames: string[];
};

type Row = Record<string, unknown>;
const unavailable = <T>(): ServiceResult<T> => ({ ok: false, error: 'Cloud ist nicht konfiguriert.' });
const schemaUnavailable = <T>(feature: string): ServiceResult<T> => ({
  ok: false,
  error: `${feature} ist noch nicht in der Datenbank aktiviert. Bitte die Arbeitszeit-Systemmigration 0262 ausführen.`,
});

function planningError<T>(error: Parameters<typeof toGermanSupabaseError>[0], feature: string): ServiceResult<T> {
  const message = error?.message ?? '';
  const schemaMissing = isSupabaseMissingTableError(error)
    || error?.code === '42P01'
    || error?.code === 'PGRST202'
    || message.includes('schema cache')
    || message.includes('complete_wfm_team_meeting');
  return schemaMissing
    ? schemaUnavailable<T>(feature)
    : { ok: false, error: toGermanSupabaseError(error) };
}

function travelRule(row: Row): WfmTravelRule {
  return {
    id: String(row.id), tenantId: String(row.tenant_id), name: String(row.name ?? ''),
    minGapMinutes: Number(row.min_gap_minutes ?? 0),
    maxGapMinutes: row.max_gap_minutes == null ? null : Number(row.max_gap_minutes),
    countsAsWorkTime: Boolean(row.counts_as_work_time), roundToMinutes: Number(row.round_to_minutes ?? 1),
    mileageRateCents: Number(row.mileage_rate_cents ?? 0), priority: Number(row.priority ?? 100),
    isActive: Boolean(row.is_active), notes: String(row.notes ?? ''),
  };
}

function meeting(row: Row): WfmTeamMeeting {
  const attendees = (row.workforce_team_meeting_attendees ?? []) as Row[];
  return {
    id: String(row.id), tenantId: String(row.tenant_id), title: String(row.title ?? ''),
    description: String(row.description ?? ''), location: String(row.location ?? ''),
    startsAt: String(row.starts_at), endsAt: String(row.ends_at),
    status: String(row.status) as WfmTeamMeeting['status'],
    countsAsWorkTime: Boolean(row.counts_as_work_time),
    attendeeIds: attendees.map((a) => String(a.employee_id)),
    attendeeNames: attendees.map((a) => {
      const employee = a.employees as Row | null;
      return [employee?.first_name, employee?.last_name].filter(Boolean).join(' ') || `MA ${String(a.employee_id).slice(0, 8)}`;
    }),
  };
}

export async function listWfmTravelRules(tenantId: string): Promise<ServiceResult<WfmTravelRule[]>> {
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  const { data, error } = await fromUnknownTable(supabase, 'workforce_travel_rules').select('*').eq('tenant_id', tenantId).order('priority').order('created_at');
  if (error) return planningError(error, 'Fahrzeitregeln');
  return { ok: true, data: ((data ?? []) as Row[]).map(travelRule) };
}

export async function saveWfmTravelRule(input: Omit<WfmTravelRule, 'id' | 'tenantId'> & { id?: string; tenantId: string; actorId?: string | null }): Promise<ServiceResult<WfmTravelRule>> {
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  if (!input.name.trim()) return { ok: false, error: 'Bezeichnung der Fahrzeitregel ist erforderlich.' };
  if (!Number.isFinite(input.minGapMinutes) || input.minGapMinutes < 0) return { ok: false, error: 'Die Mindestlücke muss mindestens 0 Minuten betragen.' };
  if (input.maxGapMinutes != null && (!Number.isFinite(input.maxGapMinutes) || input.maxGapMinutes < input.minGapMinutes)) return { ok: false, error: 'Die Maximallücke darf nicht kleiner als die Mindestlücke sein.' };
  if (![1, 5, 10, 15, 30].includes(input.roundToMinutes)) return { ok: false, error: 'Die Rundung muss 1, 5, 10, 15 oder 30 Minuten betragen.' };
  if (!Number.isFinite(input.mileageRateCents) || input.mileageRateCents < 0) return { ok: false, error: 'Die Kilometerpauschale darf nicht negativ sein.' };
  const payload = { tenant_id: input.tenantId, name: input.name.trim(), min_gap_minutes: input.minGapMinutes, max_gap_minutes: input.maxGapMinutes, counts_as_work_time: input.countsAsWorkTime, round_to_minutes: input.roundToMinutes, mileage_rate_cents: input.mileageRateCents, priority: input.priority, is_active: input.isActive, notes: input.notes.trim(), created_by: input.actorId ?? null, updated_at: new Date().toISOString() };
  const query = input.id
    ? fromUnknownTable(supabase, 'workforce_travel_rules').update(payload).eq('tenant_id', input.tenantId).eq('id', input.id)
    : fromUnknownTable(supabase, 'workforce_travel_rules').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error || !data) return error ? planningError(error, 'Fahrzeitregeln') : { ok: false, error: 'Fahrzeitregel konnte nicht gespeichert werden.' };
  return { ok: true, data: travelRule(data as Row) };
}

export async function listWfmActiveEmployees(tenantId: string): Promise<ServiceResult<WfmMeetingEmployee[]>> {
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  // employees.status is the live Supabase enum `employee_status`; UI catalog
  // values such as `aktiv` must never be sent to this column.
  const { data, error } = await fromUnknownTable(supabase, 'employees').select('id, first_name, last_name').eq('tenant_id', tenantId).eq('status', 'active').order('last_name');
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map((r) => ({ id: String(r.id), name: [r.first_name, r.last_name].filter(Boolean).join(' ') || `MA ${String(r.id).slice(0, 8)}` })) };
}

export async function listWfmMeetingEmployees(tenantId: string): Promise<ServiceResult<WfmMeetingEmployee[]>> {
  return listWfmActiveEmployees(tenantId);
}

export async function listWfmTeamMeetings(tenantId: string): Promise<ServiceResult<WfmTeamMeeting[]>> {
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  const { data, error } = await fromUnknownTable(supabase, 'workforce_team_meetings').select('*, workforce_team_meeting_attendees(employee_id, attendance_status, employees(first_name, last_name))').eq('tenant_id', tenantId).order('starts_at', { ascending: false }).limit(100);
  if (error) return planningError(error, 'Team-Meetings');
  return { ok: true, data: ((data ?? []) as Row[]).map(meeting) };
}

export async function createWfmTeamMeeting(input: { tenantId: string; title: string; description: string; location: string; startsAt: string; endsAt: string; countsAsWorkTime: boolean; attendeeIds: string[]; actorId?: string | null }): Promise<ServiceResult<WfmTeamMeeting>> {
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  if (!input.title.trim()) return { ok: false, error: 'Titel des Meetings ist erforderlich.' };
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { ok: false, error: 'Datum, Beginn oder Ende ist ungültig.' };
  if (endsAt <= startsAt) return { ok: false, error: 'Das Ende muss nach dem Beginn liegen.' };
  const attendeeIds = [...new Set(input.attendeeIds.filter(Boolean))];
  if (input.countsAsWorkTime && attendeeIds.length === 0) return { ok: false, error: 'Für eine Arbeitszeitbuchung muss mindestens eine teilnehmende Person ausgewählt werden.' };
  const meetingId = globalThis.crypto?.randomUUID?.() ?? `meeting-${Date.now()}`;
  const { error } = await fromUnknownTable(supabase, 'workforce_team_meetings').insert({ id: meetingId, tenant_id: input.tenantId, title: input.title.trim(), description: input.description.trim(), location: input.location.trim(), starts_at: input.startsAt, ends_at: input.endsAt, counts_as_work_time: input.countsAsWorkTime, created_by: input.actorId ?? null });
  if (error) return planningError(error, 'Team-Meetings');
  if (attendeeIds.length) {
    const { error: attendeeError } = await fromUnknownTable(supabase, 'workforce_team_meeting_attendees').insert(attendeeIds.map((employeeId) => ({ tenant_id: input.tenantId, meeting_id: meetingId, employee_id: employeeId })));
    if (attendeeError) {
      await fromUnknownTable(supabase, 'workforce_team_meetings').delete().eq('tenant_id', input.tenantId).eq('id', meetingId);
      return planningError(attendeeError, 'Team-Meetings');
    }
  }
  const result = await listWfmTeamMeetings(input.tenantId);
  if (!result.ok) return result;
  const created = result.data.find((item) => item.id === meetingId);
  return created ? { ok: true, data: created } : { ok: false, error: 'Team-Meeting konnte nicht geladen werden.' };
}

export async function setWfmTeamMeetingStatus(tenantId: string, meetingId: string, status: WfmTeamMeeting['status'], actorId?: string | null): Promise<ServiceResult<true>> {
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  if (status === 'completed') {
    const { error } = await supabase.rpc('complete_wfm_team_meeting' as never, {
      p_tenant_id: tenantId,
      p_meeting_id: meetingId,
      p_actor_id: actorId ?? null,
    } as never);
    return error
      ? planningError(error, 'Team-Meetings')
      : { ok: true, data: true };
  }
  const { data: meetingRow, error: loadError } = await fromUnknownTable(supabase, 'workforce_team_meetings').select('*').eq('tenant_id', tenantId).eq('id', meetingId).single();
  if (loadError || !meetingRow) return loadError ? planningError(loadError, 'Team-Meetings') : { ok: false, error: 'Meeting nicht gefunden.' };
  const { error } = await fromUnknownTable(supabase, 'workforce_team_meetings').update({ status, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', meetingId);
  if (error) return planningError(error, 'Team-Meetings');
  return { ok: true, data: true };
}
