import type { RoleKey, ServiceResult } from '@/types';
import type { WfmTimeEvent, WfmTrafficLight, WfmWorkSession } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  fetchEmployeeEventsInRange,
  fetchSessionEvents,
  fetchTodaySession,
  listSessionsForDate,
  resolveEmployeeIdForUser,
  todayWorkDate,
} from './wfmWorkSessionRepository';

export type WfmRuleKey =
  | 'max_daily_hours'
  | 'min_rest_period'
  | 'break_requirement_6h'
  | 'break_requirement_9h';

export type WfmRuleSeverity = 'warning' | 'violation';

export type WfmRuleViolation = {
  id: string;
  tenantId: string;
  employeeId: string;
  ruleKey: WfmRuleKey;
  severity: WfmRuleSeverity;
  message: string;
  workDate: string;
  sessionId: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
};

const VIOLATIONS_TABLE = 'workforce_rule_violations';

const MAX_DAILY_MINUTES = 10 * 60;
const MIN_REST_MINUTES = 11 * 60;
const BREAK_6H_MINUTES = 6 * 60;
const BREAK_6H_REQUIRED = 30;
const BREAK_9H_MINUTES = 9 * 60;
const BREAK_9H_REQUIRED = 45;

const RULE_MESSAGES: Record<WfmRuleKey, string> = {
  max_daily_hours:
    'Arbeitszeit über 10 Stunden — ArbZG §3: Die werktägliche Arbeitszeit darf 8 Stunden nicht überschreiten (Ausnahme bis 10 h).',
  min_rest_period:
    'Ruhezeit unter 11 Stunden — ArbZG §5: Zwischen Arbeitsende und -beginn müssen mindestens 11 Stunden liegen.',
  break_requirement_6h:
    'Pausenregel bei 6+ Stunden — ArbZG §4: Nach mehr als 6 Stunden Arbeitszeit ist eine Pause von mindestens 30 Minuten erforderlich.',
  break_requirement_9h:
    'Pausenregel bei 9+ Stunden — ArbZG §4: Nach mehr als 9 Stunden Arbeitszeit sind mindestens 45 Minuten Pause erforderlich.',
};

type ViolationRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  rule_key: WfmRuleKey;
  severity: WfmRuleSeverity;
  message: string;
  work_date: string;
  session_id: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

const demoViolations = new Map<string, WfmRuleViolation>();

function mapRow(row: ViolationRow): WfmRuleViolation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    ruleKey: row.rule_key,
    severity: row.severity,
    message: row.message,
    workDate: row.work_date,
    sessionId: row.session_id,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
  };
}

function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return '00000000-0000-4000-8000-000000000000'.replace(/0/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

function computePauseMinutesFromEvents(events: WfmTimeEvent[]): number {
  let total = 0;
  let pauseStart: number | null = null;
  for (const event of events) {
    const ts = Date.parse(event.occurredAt);
    if (event.eventType === 'pause_start') {
      pauseStart = ts;
    } else if (event.eventType === 'pause_end' && pauseStart != null) {
      total += Math.max(0, Math.round((ts - pauseStart) / 60000));
      pauseStart = null;
    }
  }
  if (pauseStart != null) {
    total += Math.max(0, Math.round((Date.now() - pauseStart) / 60000));
  }
  return total;
}

export type WfmRuleEvaluationInput = {
  session: WfmWorkSession | null;
  events: WfmTimeEvent[];
  previousDayEndedAt?: string | null;
};

export type WfmRuleEvaluationResult = {
  violations: Array<Omit<WfmRuleViolation, 'id' | 'tenantId' | 'employeeId' | 'acknowledgedAt' | 'createdAt'>>;
  trafficLight: WfmTrafficLight;
};

export function evaluateArbzgRules(input: WfmRuleEvaluationInput): WfmRuleEvaluationResult {
  const violations: WfmRuleEvaluationResult['violations'] = [];
  const session = input.session;
  const workDate = session?.workDate ?? todayWorkDate();

  const grossMinutes = session?.grossMinutes ?? 0;
  const pauseFromSession = session?.pauseMinutes ?? 0;
  const pauseFromEvents = computePauseMinutesFromEvents(input.events);
  const pauseMinutes = Math.max(pauseFromSession, pauseFromEvents);
  const netMinutes = session?.netMinutes ?? Math.max(0, grossMinutes - pauseMinutes);

  if (netMinutes > MAX_DAILY_MINUTES) {
    violations.push({
      ruleKey: 'max_daily_hours',
      severity: netMinutes > MAX_DAILY_MINUTES + 60 ? 'violation' : 'warning',
      message: RULE_MESSAGES.max_daily_hours,
      workDate,
      sessionId: session?.id ?? null,
    });
  }

  if (netMinutes > BREAK_6H_MINUTES && pauseMinutes < BREAK_6H_REQUIRED) {
    violations.push({
      ruleKey: 'break_requirement_6h',
      severity: 'warning',
      message: RULE_MESSAGES.break_requirement_6h,
      workDate,
      sessionId: session?.id ?? null,
    });
  }

  if (netMinutes > BREAK_9H_MINUTES && pauseMinutes < BREAK_9H_REQUIRED) {
    violations.push({
      ruleKey: 'break_requirement_9h',
      severity: 'violation',
      message: RULE_MESSAGES.break_requirement_9h,
      workDate,
      sessionId: session?.id ?? null,
    });
  }

  if (input.previousDayEndedAt && session?.startedAt) {
    const restMinutes = Math.round(
      (Date.parse(session.startedAt) - Date.parse(input.previousDayEndedAt)) / 60000,
    );
    if (restMinutes < MIN_REST_MINUTES) {
      violations.push({
        ruleKey: 'min_rest_period',
        severity: restMinutes < MIN_REST_MINUTES - 60 ? 'violation' : 'warning',
        message: `${RULE_MESSAGES.min_rest_period} (aktuell: ${Math.round(restMinutes / 60)} h).`,
        workDate,
        sessionId: session.id,
      });
    }
  }

  let trafficLight: WfmTrafficLight = 'green';
  if (violations.some((v) => v.severity === 'violation')) {
    trafficLight = 'red';
  } else if (violations.length > 0) {
    trafficLight = 'yellow';
  }

  return { violations, trafficLight };
}

export function resetWfmRuleDemoStore(): void {
  demoViolations.clear();
}

async function persistViolations(
  tenantId: string,
  employeeId: string,
  violations: WfmRuleEvaluationResult['violations'],
): Promise<void> {
  if (violations.length === 0) return;

  const rows = violations.map((v) => ({
    id: newUuid(),
    tenant_id: tenantId,
    employee_id: employeeId,
    rule_key: v.ruleKey,
    severity: v.severity,
    message: v.message,
    work_date: v.workDate,
    session_id: v.sessionId,
  }));

  if (getServiceMode() !== 'supabase') {
    for (const row of rows) {
      const violation: WfmRuleViolation = {
        id: row.id,
        tenantId,
        employeeId,
        ruleKey: row.rule_key,
        severity: row.severity,
        message: row.message,
        workDate: row.work_date,
        sessionId: row.session_id,
        acknowledgedAt: null,
        createdAt: new Date().toISOString(),
      };
      demoViolations.set(violation.id, violation);
    }
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await fromUnknownTable(supabase, VIOLATIONS_TABLE).insert(rows);
  if (error && !isSupabaseMissingTableError(error)) {
    console.warn('[wfmRuleEngine] Violations persist failed:', error.message);
  }
}

async function fetchPreviousDayEnd(
  tenantId: string,
  employeeId: string,
  workDate: string,
): Promise<string | null> {
  const prev = new Date(workDate);
  prev.setDate(prev.getDate() - 1);
  const prevDate = prev.toISOString().slice(0, 10);
  const sessionsResult = await listSessionsForDate(tenantId, prevDate);
  if (!sessionsResult.ok) return null;
  const prevSession = sessionsResult.data.find((s) => s.employeeId === employeeId);
  return prevSession?.endedAt ?? null;
}

export async function evaluateAndStoreArbzgForToday(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  options?: { employeeId?: string | null },
): Promise<ServiceResult<WfmRuleEvaluationResult>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;
  const employeeId = employeeResult.data;

  const sessionResult = await fetchTodaySession(tenantId, employeeId);
  if (!sessionResult.ok) return sessionResult;

  let events: WfmTimeEvent[] = [];
  if (sessionResult.data) {
    const eventsResult = await fetchSessionEvents(tenantId, sessionResult.data.id);
    if (eventsResult.ok) events = eventsResult.data;
  }

  const previousDayEndedAt = await fetchPreviousDayEnd(
    tenantId,
    employeeId,
    sessionResult.data?.workDate ?? todayWorkDate(),
  );

  const result = evaluateArbzgRules({
    session: sessionResult.data,
    events,
    previousDayEndedAt,
  });

  await persistViolations(tenantId, employeeId, result.violations);

  return { ok: true, data: result };
}

export async function listWfmRuleViolationsForDate(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  workDate: string,
  options?: { employeeId?: string | null },
): Promise<ServiceResult<WfmRuleViolation[]>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() !== 'supabase') {
    const filtered = [...demoViolations.values()].filter(
      (v) =>
        v.tenantId === tenantId &&
        v.workDate === workDate &&
        (!options?.employeeId || v.employeeId === options.employeeId),
    );
    return { ok: true, data: filtered };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  let query = fromUnknownTable(supabase, VIOLATIONS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('work_date', workDate)
    .order('created_at', { ascending: false });

  if (options?.employeeId) {
    query = query.eq('employee_id', options.employeeId);
  }

  const { data, error } = await query;
  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data as ViolationRow[]).map(mapRow) };
}

export async function listWfmTeamRuleViolationsToday(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<WfmRuleViolation[]>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const workDate = todayWorkDate();

  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: [...demoViolations.values()].filter(
        (v) => v.tenantId === tenantId && v.workDate === workDate,
      ),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, VIOLATIONS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('work_date', workDate)
    .order('created_at', { ascending: false });

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      const sessionsResult = await listSessionsForDate(tenantId, workDate);
      if (!sessionsResult.ok) return sessionsResult;
      const allViolations: WfmRuleViolation[] = [];
      for (const session of sessionsResult.data) {
        const eventsResult = await fetchSessionEvents(tenantId, session.id);
        const events = eventsResult.ok ? eventsResult.data : [];
        const prevEnd = await fetchPreviousDayEnd(tenantId, session.employeeId, workDate);
        const evalResult = evaluateArbzgRules({ session, events, previousDayEndedAt: prevEnd });
        for (const v of evalResult.violations) {
          allViolations.push({
            id: `${session.employeeId}-${v.ruleKey}`,
            tenantId,
            employeeId: session.employeeId,
            ruleKey: v.ruleKey,
            severity: v.severity,
            message: v.message,
            workDate: v.workDate,
            sessionId: v.sessionId,
            acknowledgedAt: null,
            createdAt: new Date().toISOString(),
          });
        }
      }
      return { ok: true, data: allViolations };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data as ViolationRow[]).map(mapRow) };
}

export async function fetchEmployeeEventsForRuleCheck(
  tenantId: string,
  employeeId: string,
  from: string,
  to: string,
): Promise<ServiceResult<WfmTimeEvent[]>> {
  return fetchEmployeeEventsInRange(tenantId, employeeId, from, to);
}
