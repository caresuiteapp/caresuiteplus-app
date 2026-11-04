// Generated native presentation from src/lib/portal/employeeDeferredTimeService.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey, ServiceResult } from '@/types';
import type { WfmTimeEvent } from '@/types/modules/wfm';
import type { WfmOfficePlannedVisit } from '@/types/modules/wfmOfficeTimekeeping';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { readAllOfficeAccountRows } from '@/lib/wfm/wfmOfficeAccountTotals';
import { mapEventRow, mapSessionRow } from '@/lib/wfm/wfmWorkSessionRepository';
import { buildOfficeEntriesFromSessions } from "../wfm/wfmOfficeTimekeepingService.native.ts";
import { mapOfficeReviewRow } from "../wfm/wfmOfficeTimekeepingReads.native.ts";
import { listPlannedVisitsForPeriod } from "../wfm/wfmOfficePlannedVisitRepository.native.ts";
import { payrollBerlinDay, isPayrollDate } from "../payroll/payrollOfficeReadModel.native.ts";
import { employeeDeferredTimes, type EmployeeDeferredTime } from "./employeeDeferredTimeModel.native.ts";
type Row = Record<string, unknown>;
export async function loadEmployeeDeferredTimes(tenantId: string, employeeId: string, role: RoleKey | null): Promise<ServiceResult<EmployeeDeferredTime[]>> {
    const denied = enforcePermission<EmployeeDeferredTime[]>(role, 'time.tracking.own.view');
    if (denied)
        return denied;
    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock)
        return tenantBlock;
    if (!employeeId || role !== 'employee_portal')
        return { ok: false, error: 'Bitte mit dem zugeordneten Mitarbeitendenkonto anmelden.' };
    const db = getSupabaseClient();
    if (getServiceMode() !== 'supabase' || !db)
        return { ok: false, error: 'Zurückgestellte Zeiten benötigen eine Verbindung zum Server.' };
    const now = Date.now(), today = payrollBerlinDay(now);
    const scoped = (table: string, columns = '*') => fromUnknownTable(db, table).select(columns).eq('tenant_id', tenantId).eq('employee_id', employeeId);
    try {
        const results = await Promise.all([
            readAllOfficeAccountRows((from, to) => scoped('workforce_work_sessions').lte('work_date', today).order('id').range(from, to)),
            readAllOfficeAccountRows((from, to) => scoped('workforce_time_events').lte('occurred_at', new Date(now).toISOString()).order('occurred_at').order('id').range(from, to)),
            readAllOfficeAccountRows((from, to) => scoped('workforce_time_entry_reviews').lte('work_date', today).order('id').range(from, to)),
            readAllOfficeAccountRows((from, to) => scoped('payroll_month_statements', 'id,tenant_id,employee_id,period_year,period_month,version,status,deferred_time_entries:snapshot_json->deferredTimeEntries,catch_up_time_entries:snapshot_json->catchUpTimeEntries').order('id').range(from, to)),
            readAllOfficeAccountRows((from, to) => scoped('assist_visits', 'id,tenant_id,employee_id,legacy_assignment_id,assignment_date,updated_at').lte('assignment_date', today).order('id').range(from, to)),
        ]);
        for (const result of results) {
            if (result.error)
                throw result.error;
            if (result.data.some(row => row.tenant_id !== tenantId || row.employee_id !== employeeId))
                throw new Error('Die Zuordnung der Zeitdaten stimmt nicht überein. Bitte erneut anmelden.');
        }
        const [sessionRows, eventRows, reviewRows, statementRows, visitRows] = results.map(result => result.data);
        const sessions = sessionRows.map(row => mapSessionRow(row as Parameters<typeof mapSessionRow>[0]));
        const eventsBySession = new Map<string, WfmTimeEvent[]>();
        for (const row of eventRows) {
            const event = mapEventRow(row as Parameters<typeof mapEventRow>[0]);
            if (!event.sessionId)
                continue;
            const events = eventsBySession.get(event.sessionId) ?? [];
            events.push(event);
            eventsBySession.set(event.sessionId, events);
        }
        const dates = [...new Set(sessions.map(session => session.workDate))];
        const entries = dates.flatMap(day => buildOfficeEntriesFromSessions(tenantId, day, sessions.filter(session => session.workDate === day), eventsBySession));
        const earliest = [...dates, ...reviewRows.map(row => String(row.work_date)), ...visitRows.map(row => String(row.assignment_date))].filter(isPayrollDate).sort()[0];
        const visits: WfmOfficePlannedVisit[] = [];
        // All historical work remains reachable. Each existing Office reader request stays within its one-year bound.
        if (earliest)
            for (let year = Number(earliest.slice(0, 4)); year <= Number(today.slice(0, 4)); year++) {
                const first = `${year}-01-01` < earliest ? earliest : `${year}-01-01`;
                const last = `${year}-12-31` > today ? today : `${year}-12-31`;
                const result = await listPlannedVisitsForPeriod(tenantId, first, last, { employeeId });
                if (!result.ok)
                    return result;
                visits.push(...result.data);
            }
        return { ok: true, data: employeeDeferredTimes({ tenantId, employeeId, now, entries, visits,
                reviews: reviewRows.map(mapOfficeReviewRow), statements: statementRows,
                visitSources: visitRows.map(row => ({ id: String(row.id), legacyId: typeof row.legacy_assignment_id === 'string' ? row.legacy_assignment_id : null, updatedAt: String(row.updated_at) })),
                sessionSources: sessionRows.map(row => ({ id: String(row.id), updatedAt: String(row.updated_at) })),
            }) };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : toGermanSupabaseError(error as Parameters<typeof toGermanSupabaseError>[0]) };
    }
}
export async function submitEmployeeDeferredTime(input: {
    task: EmployeeDeferredTime;
    startedAt: string;
    endedAt: string;
    pauseMinutes: number;
    reason: string;
}): Promise<ServiceResult<{
    reviewId: string;
}>> {
    if (input.task.state !== 'correction_needed' || !input.task.entry || !input.task.referenceId)
        return { ok: false, error: 'Diese Zeit kann derzeit nicht selbst korrigiert werden. Bitte erneut laden.' };
    const db = getSupabaseClient();
    if (!db)
        return { ok: false, error: 'Keine Verbindung zum Server.' };
    try {
        const rpc = db as unknown as {
            rpc: (name: string, values: Row) => Promise<{
                data: Row | null;
                error: {
                    message: string;
                } | null;
            }>;
        };
        const { data, error } = await rpc.rpc('employee_portal_submit_time_correction', {
            p_work_date: input.task.workDate, p_entry_kind: input.task.entryKind, p_reference_id: input.task.referenceId,
            p_entry_id: input.task.entry.id, p_started_at: input.startedAt, p_ended_at: input.endedAt,
            p_pause_minutes: input.pauseMinutes, p_reason: input.reason.trim(),
            p_expected_review_updated_at: input.task.reviewUpdatedAt, p_expected_source_updated_at: input.task.sourceUpdatedAt,
        });
        if (error)
            return { ok: false, error: error.message.includes('employee_portal_submit_time_correction') ? 'Zeitkorrekturen sind auf dem Server noch nicht verfügbar. Bitte die Verwaltung informieren.' : error.message };
        if (data?.ok !== true || data.review_status !== 'pending_review' || data.entry_id !== input.task.entry.id || typeof data.review_id !== 'string' || !data.updated_at)
            return { ok: false, error: 'Der Server hat die Korrektur nicht eindeutig bestätigt. Bitte vor einem erneuten Versuch aktualisieren.' };
        return { ok: true, data: { reviewId: data.review_id } };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Die Korrektur konnte nicht gespeichert werden.' };
    }
}
