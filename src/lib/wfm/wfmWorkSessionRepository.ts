import type { ServiceResult } from '@/types';
import type {
  WfmDisplayStatus,
  WfmEventSource,
  WfmEventType,
  WfmSessionStatus,
  WfmTimeEvent,
  WfmWorkMode,
  WfmWorkSession,
} from '@/types/modules/wfm';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

const SESSIONS_TABLE = 'workforce_work_sessions';
const EVENTS_TABLE = 'workforce_time_events';

type SessionRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  user_id: string | null;
  work_date: string;
  status: WfmSessionStatus;
  work_mode: WfmWorkMode;
  display_status: WfmDisplayStatus | null;
  started_at: string | null;
  ended_at: string | null;
  last_event_at: string | null;
  gross_minutes: number;
  net_minutes: number;
  pause_minutes: number;
  is_online: boolean;
  location_label?: string | null;
  current_visit_id?: string | null;
};

type EventRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  user_id: string | null;
  event_type: WfmEventType;
  work_mode: WfmWorkMode | null;
  source: WfmEventSource;
  occurred_at: string;
  session_id: string | null;
  note: string | null;
};

const demoSessions = new Map<string, WfmWorkSession>();
const demoEvents = new Map<string, WfmTimeEvent[]>();

function sessionKey(tenantId: string, employeeId: string, workDate: string): string {
  return `${tenantId}:${employeeId}:${workDate}`;
}

function mapSessionRow(row: SessionRow): WfmWorkSession {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    userId: row.user_id,
    workDate: row.work_date,
    status: row.status,
    workMode: row.work_mode,
    displayStatus: row.display_status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    lastEventAt: row.last_event_at,
    grossMinutes: row.gross_minutes,
    netMinutes: row.net_minutes,
    pauseMinutes: row.pause_minutes,
    isOnline: row.is_online,
    locationLabel: row.location_label ?? null,
    currentVisitId: row.current_visit_id ?? null,
  };
}

function mapEventRow(row: EventRow): WfmTimeEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    userId: row.user_id,
    eventType: row.event_type,
    workMode: row.work_mode,
    source: row.source,
    occurredAt: row.occurred_at,
    sessionId: row.session_id,
    note: row.note,
  };
}

export function resetWfmDemoStore(): void {
  demoSessions.clear();
  demoEvents.clear();
}

/** Local calendar date (YYYY-MM-DD) — matches German "heute" in Office Arbeitszeit. */
export function todayWorkDate(): string {
  return workDateFromDate(new Date());
}

export function workDateFromIso(iso: string): string {
  return workDateFromDate(new Date(iso));
}

function workDateFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchSessionForDate(
  tenantId: string,
  employeeId: string,
  workDate: string,
): Promise<ServiceResult<WfmWorkSession | null>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: demoSessions.get(sessionKey(tenantId, employeeId, workDate)) ?? null };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, SESSIONS_TABLE)
    .select(
      'id, tenant_id, employee_id, user_id, work_date, status, work_mode, display_status, started_at, ended_at, last_event_at, gross_minutes, net_minutes, pause_minutes, is_online',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('work_date', workDate)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: null };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapSessionRow(data as SessionRow) };
}

export async function fetchTodaySession(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<WfmWorkSession | null>> {
  return fetchSessionForDate(tenantId, employeeId, todayWorkDate());
}

export async function fetchSessionEvents(
  tenantId: string,
  sessionId: string,
): Promise<ServiceResult<WfmTimeEvent[]>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: demoEvents.get(sessionId) ?? [] };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, EVENTS_TABLE)
    .select(
      'id, tenant_id, employee_id, user_id, event_type, work_mode, source, occurred_at, session_id, note',
    )
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
    .order('occurred_at', { ascending: true });

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapEventRow(row as EventRow)) };
}

export async function insertWorkSession(
  input: Omit<WfmWorkSession, 'grossMinutes' | 'netMinutes' | 'pauseMinutes'>,
): Promise<ServiceResult<WfmWorkSession>> {
  const payload: Record<string, unknown> = {
    tenant_id: input.tenantId,
    employee_id: input.employeeId,
    user_id: input.userId,
    work_date: input.workDate,
    status: input.status,
    work_mode: input.workMode,
    display_status: input.displayStatus,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    last_event_at: input.lastEventAt,
    is_online: input.isOnline,
    gross_minutes: 0,
    net_minutes: 0,
    pause_minutes: 0,
  };
  if (input.currentVisitId) payload.current_visit_id = input.currentVisitId;

  if (getServiceMode() !== 'supabase') {
    const session: WfmWorkSession = {
      ...input,
      grossMinutes: 0,
      netMinutes: 0,
      pauseMinutes: 0,
    };
    demoSessions.set(sessionKey(input.tenantId, input.employeeId, input.workDate), session);
    demoEvents.set(input.id, []);
    return { ok: true, data: session };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, SESSIONS_TABLE)
    .insert({ id: input.id, ...payload })
    .select(
      'id, tenant_id, employee_id, user_id, work_date, status, work_mode, display_status, started_at, ended_at, last_event_at, gross_minutes, net_minutes, pause_minutes, is_online',
    )
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'Arbeitszeit-Tabellen (0190) noch nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapSessionRow(data as SessionRow) };
}

export async function updateWorkSession(
  sessionId: string,
  patch: Partial<
    Pick<
      WfmWorkSession,
      | 'status'
      | 'workMode'
      | 'displayStatus'
      | 'startedAt'
      | 'endedAt'
      | 'lastEventAt'
      | 'isOnline'
      | 'grossMinutes'
      | 'netMinutes'
      | 'pauseMinutes'
    >
  >,
): Promise<ServiceResult<WfmWorkSession>> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.workMode !== undefined) dbPatch.work_mode = patch.workMode;
  if (patch.displayStatus !== undefined) dbPatch.display_status = patch.displayStatus;
  if (patch.startedAt !== undefined) dbPatch.started_at = patch.startedAt;
  if (patch.endedAt !== undefined) dbPatch.ended_at = patch.endedAt;
  if (patch.lastEventAt !== undefined) dbPatch.last_event_at = patch.lastEventAt;
  if (patch.isOnline !== undefined) dbPatch.is_online = patch.isOnline;
  if (patch.grossMinutes !== undefined) dbPatch.gross_minutes = patch.grossMinutes;
  if (patch.netMinutes !== undefined) dbPatch.net_minutes = patch.netMinutes;
  if (patch.pauseMinutes !== undefined) dbPatch.pause_minutes = patch.pauseMinutes;

  if (getServiceMode() !== 'supabase') {
    for (const [key, session] of demoSessions.entries()) {
      if (session.id !== sessionId) continue;
      const updated: WfmWorkSession = { ...session, ...patch };
      demoSessions.set(key, updated);
      return { ok: true, data: updated };
    }
    return { ok: false, error: 'Arbeitssitzung nicht gefunden.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, SESSIONS_TABLE)
    .update(dbPatch)
    .eq('id', sessionId)
    .select(
      'id, tenant_id, employee_id, user_id, work_date, status, work_mode, display_status, started_at, ended_at, last_event_at, gross_minutes, net_minutes, pause_minutes, is_online',
    )
    .single();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapSessionRow(data as SessionRow) };
}

export async function hasAssistWfmEvent(
  tenantId: string,
  employeeId: string,
  eventType: WfmEventType,
  visitId: string,
): Promise<boolean> {
  if (getServiceMode() !== 'supabase') return false;

  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { data, error } = await fromUnknownTable(supabase, EVENTS_TABLE)
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('event_type', eventType)
    .eq('reference_type', 'visit')
    .eq('reference_id', visitId)
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function insertTimeEvent(
  input: Omit<WfmTimeEvent, 'occurredAt'> & {
    occurredAt?: string;
    referenceType?: 'visit' | 'assignment' | null;
    referenceId?: string | null;
  },
): Promise<ServiceResult<WfmTimeEvent>> {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const payload: Record<string, unknown> = {
    id: input.id,
    tenant_id: input.tenantId,
    employee_id: input.employeeId,
    user_id: input.userId,
    event_type: input.eventType,
    work_mode: input.workMode,
    source: input.source,
    occurred_at: occurredAt,
    session_id: input.sessionId,
    note: input.note,
  };
  if (input.referenceType) payload.reference_type = input.referenceType;
  if (input.referenceId) payload.reference_id = input.referenceId;

  if (getServiceMode() !== 'supabase') {
    const event: WfmTimeEvent = { ...input, occurredAt };
    const list = demoEvents.get(input.sessionId ?? '') ?? [];
    list.push(event);
    if (input.sessionId) demoEvents.set(input.sessionId, list);
    return { ok: true, data: event };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, EVENTS_TABLE)
    .insert(payload)
    .select(
      'id, tenant_id, employee_id, user_id, event_type, work_mode, source, occurred_at, session_id, note',
    )
    .single();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapEventRow(data as EventRow) };
}

/**
 * Resolve auth.users.id for workforce_work_sessions.user_id.
 * Never returns employees.id — FK targets auth.users only.
 */
export async function resolveAuthUserIdForWfmSession(
  tenantId: string,
  employeeId: string,
  candidateUserId?: string | null,
): Promise<string | null> {
  if (candidateUserId && candidateUserId !== employeeId) {
    return candidateUserId;
  }

  if (getServiceMode() !== 'supabase') {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('profile_id')
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .maybeSingle();

  if (employeeError) return null;
  if (employee?.profile_id) return employee.profile_id;

  const { data: portalAccount, error: portalError } = await supabase
    .from('employee_portal_accounts')
    .select('auth_user_id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (portalError) return null;
  if (portalAccount?.auth_user_id) return String(portalAccount.auth_user_id);

  return null;
}

const WFM_EMPLOYEE_LINK_MISSING =
  'Ihr Portalzugang ist noch keinem Mitarbeiterprofil zugeordnet. Bitte wenden Sie sich an das Office.';

function isActiveEmployeePortalAccount(row: {
  status?: string | null;
  blocked_at?: string | null;
}): boolean {
  const status = row.status ?? '';
  if (status === 'archived' || status === 'blocked') return false;
  if (row.blocked_at) return false;
  return true;
}

export async function resolveEmployeeIdForUser(
  tenantId: string,
  userId: string,
  knownEmployeeId?: string | null,
): Promise<ServiceResult<string>> {
  if (getServiceMode() !== 'supabase') {
    if (knownEmployeeId) return { ok: true, data: knownEmployeeId };
    return { ok: true, data: `demo-employee-${userId}` };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  if (knownEmployeeId) {
    const { data: knownRow, error: knownError } = await supabase
      .from('employees')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', knownEmployeeId)
      .maybeSingle();

    if (knownError) return { ok: false, error: toGermanSupabaseError(knownError) };
    if (!knownRow?.id) return { ok: false, error: WFM_EMPLOYEE_LINK_MISSING };
    return { ok: true, data: knownEmployeeId };
  }

  const { data: businessEmployee, error: businessError } = await supabase
    .from('employees')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('profile_id', userId)
    .maybeSingle();

  if (businessError) return { ok: false, error: toGermanSupabaseError(businessError) };
  if (businessEmployee?.id) return { ok: true, data: businessEmployee.id };

  const { data: portalAccount, error: portalError } = await supabase
    .from('employee_portal_accounts')
    .select('employee_id, status, blocked_at')
    .eq('tenant_id', tenantId)
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (portalError) return { ok: false, error: toGermanSupabaseError(portalError) };
  if (portalAccount?.employee_id && isActiveEmployeePortalAccount(portalAccount)) {
    return { ok: true, data: String(portalAccount.employee_id) };
  }

  return { ok: false, error: WFM_EMPLOYEE_LINK_MISSING };
}

export async function listSessionsForDate(
  tenantId: string,
  workDate: string,
): Promise<ServiceResult<WfmWorkSession[]>> {
  if (getServiceMode() !== 'supabase') {
    const sessions: WfmWorkSession[] = [];
    for (const session of demoSessions.values()) {
      if (session.tenantId === tenantId && session.workDate === workDate) {
        sessions.push(session);
      }
    }
    return { ok: true, data: sessions };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, SESSIONS_TABLE)
    .select(
      'id, tenant_id, employee_id, user_id, work_date, status, work_mode, display_status, started_at, ended_at, last_event_at, gross_minutes, net_minutes, pause_minutes, is_online, location_label, current_visit_id',
    )
    .eq('tenant_id', tenantId)
    .eq('work_date', workDate)
    .order('last_event_at', { ascending: false, nullsFirst: false });

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapSessionRow(row as SessionRow)) };
}

export async function fetchEmployeeEventsInRange(
  tenantId: string,
  employeeId: string,
  fromIso: string,
  toIso: string,
): Promise<ServiceResult<WfmTimeEvent[]>> {
  if (getServiceMode() !== 'supabase') {
    const events: WfmTimeEvent[] = [];
    for (const list of demoEvents.values()) {
      for (const event of list) {
        if (
          event.tenantId === tenantId &&
          event.employeeId === employeeId &&
          event.occurredAt >= fromIso &&
          event.occurredAt <= toIso
        ) {
          events.push(event);
        }
      }
    }
    events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return { ok: true, data: events };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, EVENTS_TABLE)
    .select(
      'id, tenant_id, employee_id, user_id, event_type, work_mode, source, occurred_at, session_id, note',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .gte('occurred_at', fromIso)
    .lte('occurred_at', toIso)
    .order('occurred_at', { ascending: true });

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapEventRow(row as EventRow)) };
}

export async function updateWorkSessionLocation(
  sessionId: string,
  locationLabel: string | null,
  gpsStatus?: string | null,
): Promise<ServiceResult<WfmWorkSession>> {
  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    location_label: locationLabel,
  };
  if (gpsStatus !== undefined) dbPatch.gps_status = gpsStatus;

  if (getServiceMode() !== 'supabase') {
    for (const [key, session] of demoSessions.entries()) {
      if (session.id !== sessionId) continue;
      const updated = { ...session };
      demoSessions.set(key, updated);
      return { ok: true, data: updated };
    }
    return { ok: false, error: 'Arbeitssitzung nicht gefunden.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, SESSIONS_TABLE)
    .update(dbPatch)
    .eq('id', sessionId)
    .select(
      'id, tenant_id, employee_id, user_id, work_date, status, work_mode, display_status, started_at, ended_at, last_event_at, gross_minutes, net_minutes, pause_minutes, is_online',
    )
    .single();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapSessionRow(data as SessionRow) };
}
