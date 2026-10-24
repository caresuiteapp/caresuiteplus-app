// Generated native presentation from src/lib/wfm/wfmOfficeTimekeepingService.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { berlinDateKey } from '@/lib/employeeLogbook/employeeLogbookDate';
import { notifyWfmOfficeDataChanged } from './wfmOfficeDataChanged';
import { recalculateOfficeEntry, validateOfficeTimeValues, applyStoredOfficeEntry } from "./wfmOfficeStoredEntry.native.ts";
import { enrichOfficeTimeEntryDisplay } from './wfmOfficeTimeDisplayResolver';
import type { RoleKey, ServiceResult } from '@/types';
import type { WfmOfficeCorrectionInput, WfmOfficeManualEntryInput, WfmOfficeMessage, WfmOfficeTimeEntry, WfmOfficeTimeEntryStatus, WfmOfficeTimeFilters, WfmOfficeTimeKpis, WfmOfficeTimeOverview, WfmOfficePeriodPreset, WfmDeviationPhase, } from '@/types/modules/wfmOfficeTimekeeping';
import type { WfmTimeEvent, WfmWorkSession } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from "../supabase/client.ts";
import { enumerateWorkDates, resolveOfficeTimePeriod } from './wfmOfficeDateRange';
import { writeWfmOfficeAudit } from './wfmOfficeAuditService';
import { appendOfficeMessage, createMessageId, getEntryOverlay, getManualEntry, getVisitJustification, listManualEntries, listOfficeMessages, saveManualEntry, setEntryOverlay, setVisitJustification, updateOfficeMessageReview, } from './wfmOfficeTimekeepingStore';
import { combineDeviationAmpel, evaluateVisitTimeDeviation, shouldAutoPendingReview, validateDeviationJustification, } from './wfmVisitDeviationAmpelService';
import { readOfficeSessions as listSessionsForDate, readOfficeEvents as fetchSessionEvents, readOfficeReviews as listReviewsForPeriod, readOfficeReviewActions as listReviewActionsForReviews, readOfficeEmployees, readOfficeAbsences, readOfficePendingRequestCount, mapOfficeReviewRow } from "./wfmOfficeTimekeepingReads.native.ts";
import { canApproveWfmOfficeTimeEntry } from './wfmOfficeTimeApproval';
import { resolveWfmOfficeTimeDisplay } from './wfmOfficeTimeDisplayResolver';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { todayWorkDate, } from './wfmWorkSessionRepository';
import { joinOfficeTimekeepingData } from './wfmOfficeDataJoinService';
import { fetchActiveEmployeeIds, listPlannedVisitsForPeriod, } from "./wfmOfficePlannedVisitRepository.native.ts";
import { scheduleDeferredTask } from '@/lib/async/deferredTask';
import { isOfficeAccountOpenReview } from './wfmOfficeAccountTotals';
import { applyReviewToEntry as applyReviewToEntryBase, isOpenReviewStatus, mapDbReviewStatusToUi, mapUiReviewDecisionToDb, getReviewByReferenceKey, pickLatestReviewActions, transitionReviewStatus, upsertReview, type WfmTimeEntryReview, } from './wfmTimeReviewService';
import { officeReviewIdentity, confirmedOfficeReview, officeVisitPauseMinutes } from './wfmOfficeReviewIntegrity';
function buildReferenceKeyFromEntry(_tenantId: string, entry: WfmOfficeTimeEntry): string { return officeReviewIdentity(entry).referenceKey; }
function applyReviewToEntry(...args: Parameters<typeof applyReviewToEntryBase>): WfmOfficeTimeEntry {
    return applyStoredOfficeEntry(applyReviewToEntryBase(...args), args[1]?.officeEntry);
}
function mergeEntryReviewOverlay(entry: WfmOfficeTimeEntry, reviewMap: Map<string, WfmTimeEntryReview>, latestActionMap: Map<string, import('./wfmTimeReviewService').WfmTimeReviewAction>): WfmOfficeTimeEntry {
    const overlay = getEntryOverlay(entry.id) ?? {};
    const referenceKey = buildReferenceKeyFromEntry(entry.tenantId, entry);
    const review = reviewMap.get(referenceKey);
    if (entry.rowKind === 'planned_upcoming' && !review?.officeEntry) {
        return { ...entry, status: 'open', reviewStatus: 'open', exportStatus: 'not_exported',
            flags: entry.flags.filter(flag => flag !== 'missing_booking') };
    }
    const latestAction = review ? latestActionMap.get(review.id) ?? null : null;
    return enrichOfficeTimeEntryDisplay(applyReviewToEntry({ ...entry, ...overlay }, review, latestAction));
}
async function resolveReviewContextForEntry(tenantId: string, entryId: string, entry?: WfmOfficeTimeEntry | null): Promise<{
    employeeId: string;
    workDate: string;
    entryKind?: 'session' | 'visit' | 'manual' | 'meeting';
    rawReferenceId?: string;
}> {
    if (entry && entry.id === entryId && entry.tenantId === tenantId) {
        return {
            employeeId: entry.employeeId,
            workDate: entry.workDate,
            entryKind: officeReviewIdentity(entry).entryKind,
            rawReferenceId: officeReviewIdentity(entry).rawReferenceId,
        };
    }
    const manual = getManualEntry(entryId);
    if (manual) {
        return {
            employeeId: manual.employeeId,
            workDate: manual.workDate,
            entryKind: 'manual',
            rawReferenceId: manual.id,
        };
    }
    const overlay = getEntryOverlay(entryId);
    const parsed = entryId.startsWith('visit:')
        ? ({ entryKind: 'visit' as const, workDate: entryId.split(':')[2] ?? overlay?.workDate ?? todayWorkDate() })
        : entryId.startsWith('session:')
            ? ({ entryKind: 'session' as const, workDate: overlay?.workDate ?? todayWorkDate() })
            : ({ entryKind: 'manual' as const, workDate: overlay?.workDate ?? todayWorkDate() });
    return {
        employeeId: overlay?.employeeId ?? '00000000-0000-4000-8000-000000000001',
        workDate: parsed.workDate,
        entryKind: parsed.entryKind,
        rawReferenceId: parsed.entryKind === 'visit'
            ? entryId.split(':')[1] ?? entryId
            : entryId.replace(/^session:/, ''),
    };
}
const TERMINAL_STATUSES = new Set<WfmOfficeTimeEntryStatus>(['exported', 'locked']);
type EmployeeProfile = {
    id: string;
    name: string;
};
async function fetchEmployeeProfiles(tenantId: string, employeeIds: string[]): Promise<ServiceResult<Map<string, EmployeeProfile>>> {
    const profiles = new Map<string, EmployeeProfile>();
    if (!employeeIds.length)
        return { ok: true, data: profiles };
    if (getServiceMode() !== 'supabase') {
        for (const id of employeeIds)
            profiles.set(id, { id, name: `Mitarbeiter ${id.slice(-4)}` });
        return { ok: true, data: profiles };
    }
    const result = await readOfficeEmployees(tenantId);
    if (!result.ok)
        return result;
    for (const row of result.data) {
        const id = String(row.id);
        if (employeeIds.length && !employeeIds.includes(id))
            continue;
        const name = [row.first_name, row.last_name].filter(value => typeof value === 'string' && value.trim()).join(' ').trim();
        profiles.set(id, { id, name: name || 'Mitarbeitende ohne Namensangabe' });
    }
    if (employeeIds.some(id => !profiles.has(id)))
        return { ok: false, error: 'Mindestens eine Buchung ist keinem erreichbaren Mitarbeiterprofil zugeordnet. Bitte die Zuordnung prüfen.' };
    return { ok: true, data: profiles };
}
function resolveWorkKind(session: WfmWorkSession | null): WfmOfficeTimeEntry['workKind'] {
    if (!session)
        return 'sonstige';
    if (session.status === 'on_visit' || session.workMode === 'field')
        return 'einsatz';
    if (session.status === 'homeoffice' || session.displayStatus === 'homeoffice' || session.workMode === 'homeoffice')
        return 'homeoffice';
    if (session.status === 'office' || session.displayStatus === 'buero' || session.workMode === 'office')
        return 'buero';
    if (session.status === 'driving')
        return 'fahrt';
    if (session.status === 'paused')
        return 'pause';
    return 'sonstige';
}
function minutesBetween(startIso: string | null, endIso: string | null): number {
    if (!startIso || !endIso)
        return 0;
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (Number.isNaN(ms) || ms <= 0)
        return 0;
    return Math.round(ms / 60000);
}
function buildVisitEntryFromEvents(tenantId: string, employeeId: string, employeeName: string, workDate: string, visitId: string, events: WfmTimeEvent[], session: WfmWorkSession | null, overlay: Partial<WfmOfficeTimeEntry>, sessionEvents: WfmTimeEvent[]): WfmOfficeTimeEntry {
    const started = events.find((e) => e.eventType === 'visit_started');
    const ended = events.find((e) => e.eventType === 'visit_ended');
    const actualStartAt = overlay.actualStartAt ?? started?.occurredAt ?? null;
    const actualEndAt = overlay.actualEndAt ?? ended?.occurredAt ?? null;
    const plannedStartAt = overlay.plannedStartAt ?? null;
    const plannedEndAt = overlay.plannedEndAt ?? null;
    const startEval = evaluateVisitTimeDeviation(plannedStartAt, actualStartAt, 'start');
    const endEval = evaluateVisitTimeDeviation(plannedEndAt, actualEndAt, 'end');
    const just = getVisitJustification(tenantId, visitId, employeeId);
    const startJustification = overlay.startJustification ?? just?.start?.text ?? null;
    const endJustification = overlay.endJustification ?? just?.end?.text ?? null;
    const grossMinutes = overlay.grossMinutes ??
        (actualStartAt && actualEndAt ? minutesBetween(actualStartAt, actualEndAt) : 0);
    const pauseMinutes = overlay.pauseMinutes ?? officeVisitPauseMinutes(sessionEvents, actualStartAt, actualEndAt);
    const netMinutes = overlay.netMinutes ?? Math.max(0, grossMinutes - pauseMinutes);
    const startAmpel = plannedStartAt && actualStartAt && !startEval.noPlannedTime ? startEval.ampel : null;
    const endAmpel = plannedEndAt && actualEndAt && !endEval.noPlannedTime ? endEval.ampel : null;
    const overallAmpel = combineDeviationAmpel(startAmpel, endAmpel);
    const entryId = overlay.id ?? `visit:${visitId}:${workDate}`;
    const status = overlay.status ??
        (shouldAutoPendingReview(startAmpel, endAmpel) ? 'pending_review' : 'open');
    const openMessages = listOfficeMessages(tenantId).some((m) => m.visitId === visitId && m.reviewStatus === 'pending_review');
    return {
        id: entryId,
        tenantId,
        employeeId,
        employeeName,
        workDate,
        assignmentId: overlay.assignmentId ?? null,
        visitId,
        clientLabel: overlay.clientLabel ?? null,
        plannedStartAt,
        plannedEndAt,
        actualStartAt,
        actualEndAt,
        startDeviationMinutes: startEval.noPlannedTime ? null : startEval.deviationMinutes,
        endDeviationMinutes: endEval.noPlannedTime ? null : endEval.deviationMinutes,
        startAmpel,
        endAmpel,
        overallAmpel,
        startJustification,
        endJustification,
        startJustificationAt: just?.start?.submittedAt ?? null,
        endJustificationAt: just?.end?.submittedAt ?? null,
        pauseMinutes,
        grossMinutes,
        netMinutes,
        travelMinutes: overlay.travelMinutes ?? null,
        workKind: overlay.workKind ?? 'einsatz',
        status,
        source: overlay.source ?? 'portal',
        reviewStatus: overlay.reviewStatus ?? status,
        exportStatus: overlay.exportStatus ?? (status === 'approved' ? 'export_ready' : 'not_exported'),
        sessionId: session?.id ?? null,
        officeComment: overlay.officeComment ?? null,
        hasOpenOfficeMessage: openMessages,
        flags: overlay.flags ?? [],
    };
}
function buildSessionEntry(tenantId: string, employeeId: string, employeeName: string, session: WfmWorkSession, overlay: Partial<WfmOfficeTimeEntry>): WfmOfficeTimeEntry {
    const entryId = overlay.id ?? `session:${session.id}`;
    const status = overlay.status ?? 'open';
    return {
        id: entryId,
        tenantId,
        employeeId,
        employeeName,
        workDate: session.workDate,
        assignmentId: null,
        visitId: session.currentVisitId ?? null,
        clientLabel: null,
        plannedStartAt: overlay.plannedStartAt ?? null,
        plannedEndAt: overlay.plannedEndAt ?? null,
        actualStartAt: overlay.actualStartAt ?? session.startedAt,
        actualEndAt: overlay.actualEndAt ?? session.endedAt,
        startDeviationMinutes: null,
        endDeviationMinutes: null,
        startAmpel: null,
        endAmpel: null,
        overallAmpel: null,
        startJustification: null,
        endJustification: null,
        startJustificationAt: null,
        endJustificationAt: null,
        pauseMinutes: overlay.pauseMinutes ?? session.pauseMinutes,
        grossMinutes: overlay.grossMinutes ?? session.grossMinutes,
        netMinutes: overlay.netMinutes ?? session.netMinutes,
        travelMinutes: null,
        workKind: overlay.workKind ?? resolveWorkKind(session),
        status,
        source: overlay.source ?? 'portal',
        reviewStatus: overlay.reviewStatus ?? status,
        exportStatus: overlay.exportStatus ?? (status === 'approved' ? 'export_ready' : 'not_exported'),
        sessionId: session.id,
        officeComment: overlay.officeComment ?? null,
        hasOpenOfficeMessage: false,
        flags: overlay.flags ?? [],
    };
}
async function buildEntriesForDate(tenantId: string, workDate: string, profiles: Map<string, EmployeeProfile>): Promise<WfmOfficeTimeEntry[]> {
    const sessionsResult = await listSessionsForDate(tenantId, workDate);
    if (!sessionsResult.ok)
        throw new Error(sessionsResult.error);
    const entries: WfmOfficeTimeEntry[] = [];
    const visitIdsHandled = new Set<string>();
    for (const session of sessionsResult.data) {
        const profile = profiles.get(session.employeeId) ?? {
            id: session.employeeId,
            name: `Mitarbeitende ${session.employeeId.slice(0, 8)}`,
        };
        const eventsResult = await fetchSessionEvents(tenantId, session.id);
        if (!eventsResult.ok)
            throw new Error(eventsResult.error);
        const events = eventsResult.data;
        const visitStartEvents = events.filter((e) => e.eventType === 'visit_started');
        for (const startEvent of visitStartEvents) {
            const visitId = startEvent.referenceId ?? session.currentVisitId ?? `evt-${startEvent.id}`;
            if (visitIdsHandled.has(`${session.employeeId}:${visitId}`))
                continue;
            visitIdsHandled.add(`${session.employeeId}:${visitId}`);
            const related = events.filter((e) => (e.referenceId ?? session.currentVisitId) === visitId &&
                (e.eventType === 'visit_started' ||
                    e.eventType === 'visit_ended' ||
                    e.eventType === 'visit_arrived'));
            const overlay = getEntryOverlay(`visit:${visitId}:${workDate}`) ?? {};
            entries.push(buildVisitEntryFromEvents(tenantId, session.employeeId, profile.name, workDate, visitId, related, session, overlay, events));
        }
        const hasVisitEntry = visitStartEvents.length > 0;
        if (!hasVisitEntry) {
            const overlay = getEntryOverlay(`session:${session.id}`) ?? {};
            if (session.startedAt || overlay.id) {
                entries.push(buildSessionEntry(tenantId, session.employeeId, profile.name, session, overlay));
            }
        }
    }
    for (const manual of listManualEntries(tenantId)) {
        if (manual.workDate === workDate)
            entries.push(manual);
    }
    return entries;
}
function computeKpis(entries: WfmOfficeTimeEntry[], openRequestsCount: number, plannedVisitCount: number, absentEmployeeIds: Set<string>): WfmOfficeTimeKpis {
    const today = todayWorkDate();
    const todayEntries = entries.filter((e) => e.workDate === today);
    const activeEmployees = new Set(entries.map((e) => e.employeeId)).size;
    const employeesWithTime = new Set(entries.filter((e) => e.actualStartAt).map((e) => e.employeeId)).size;
    const employeesPlanned = new Set(entries.filter((e) => e.plannedStartAt || e.plannedEndAt || e.rowKind === 'planned_missing_actual').map((e) => e.employeeId)).size;
    const sumNet = (filter: (e: WfmOfficeTimeEntry) => boolean) => entries.filter(filter).reduce((acc, e) => acc + e.netMinutes, 0);
    const missingBookings = entries.filter((e) => e.rowKind === 'planned_missing_actual' || e.flags.includes('missing_booking')).length;
    const unplannedBookings = entries.filter((e) => e.rowKind === 'unplanned_actual' || e.flags.includes('unplanned')).length;
    const recordedVisits = entries.filter((e) => e.actualStartAt && e.workKind === 'einsatz').length;
    return {
        totalHours: Math.round((sumNet(() => true) / 60) * 10) / 10,
        visitHours: Math.round((sumNet((e) => e.workKind === 'einsatz') / 60) * 10) / 10,
        pauseMinutes: entries.reduce((acc, e) => acc + e.pauseMinutes, 0),
        travelMinutes: entries.reduce((acc, e) => acc + (e.travelMinutes ?? 0), 0),
        officeMinutes: sumNet((e) => e.workKind === 'buero'),
        homeofficeMinutes: sumNet((e) => e.workKind === 'homeoffice'),
        activeEmployees,
        pendingReviewCount: entries.filter(isOfficeAccountOpenReview).length,
        openOfficeMessages: entries.filter((e) => e.hasOpenOfficeMessage).length,
        correctionCount: entries.filter((e) => e.source === 'correction' || e.workKind === 'korrektur').length,
        missingBookings,
        planningDeviations: entries.filter((e) => e.overallAmpel === 'yellow' || e.overallAmpel === 'red' || e.overallAmpel === 'blue').length,
        exportReadyCount: entries.filter((e) => e.exportStatus === 'export_ready').length,
        exportedCount: entries.filter((e) => e.exportStatus === 'exported').length,
        capturedToday: todayEntries.filter((e) => e.actualStartAt).length,
        activeCount: todayEntries.filter((e) => e.actualStartAt && !e.actualEndAt).length,
        onPauseCount: todayEntries.filter((e) => e.workKind === 'pause').length,
        onVisitCount: todayEntries.filter((e) => e.workKind === 'einsatz' && !e.actualEndAt).length,
        inOfficeCount: todayEntries.filter((e) => e.workKind === 'buero').length,
        homeofficeCount: todayEntries.filter((e) => e.workKind === 'homeoffice').length,
        openRequestsCount,
        plannedVisits: plannedVisitCount,
        recordedVisits,
        unplannedBookings,
        employeesWithTime,
        employeesPlanned,
        employeesAbsent: absentEmployeeIds.size,
    };
}
function applyFilters(entries: WfmOfficeTimeEntry[], filters?: Partial<WfmOfficeTimeFilters>): WfmOfficeTimeEntry[] {
    if (!filters)
        return entries;
    let result = entries;
    if (filters.employeeIds?.length) {
        result = result.filter((e) => filters.employeeIds!.includes(e.employeeId));
    }
    if (filters.statuses?.length) {
        result = result.filter((e) => filters.statuses!.includes(e.reviewStatus));
    }
    if (filters.sources?.length) {
        result = result.filter((e) => filters.sources!.includes(e.source));
    }
    if (filters.workKinds?.length) {
        result = result.filter((e) => filters.workKinds!.includes(e.workKind));
    }
    if (filters.startAmpel?.length) {
        result = result.filter((e) => e.startAmpel && filters.startAmpel!.includes(e.startAmpel));
    }
    if (filters.endAmpel?.length) {
        result = result.filter((e) => e.endAmpel && filters.endAmpel!.includes(e.endAmpel));
    }
    if (filters.overallAmpel?.length) {
        result = result.filter((e) => e.overallAmpel && filters.overallAmpel!.includes(e.overallAmpel));
    }
    if (filters.onlyDeviations) {
        result = result.filter((e) => e.overallAmpel && e.overallAmpel !== 'green');
    }
    if (filters.onlyPendingReview) {
        result = result.filter(isOfficeAccountOpenReview);
    }
    if (filters.onlyOfficeMessages) {
        result = result.filter((e) => e.hasOpenOfficeMessage);
    }
    if (filters.onlyExportReady) {
        result = result.filter((e) => e.exportStatus === 'export_ready');
    }
    if (filters.onlyExported) {
        result = result.filter((e) => e.exportStatus === 'exported');
    }
    if (filters.onlyIncomplete) {
        result = result.filter((e) => !e.actualStartAt || !e.actualEndAt);
    }
    if (filters.onlyRotBlau) {
        result = result.filter((e) => e.overallAmpel === 'red' || e.overallAmpel === 'blue');
    }
    return result;
}
export async function getWfmOfficeTimeOverview(tenantId: string, actorRoleKey: RoleKey | null, options?: {
    preset?: WfmOfficePeriodPreset;
    fromDate?: string | null;
    toDate?: string | null;
    filters?: Partial<WfmOfficeTimeFilters>;
}): Promise<ServiceResult<WfmOfficeTimeOverview>> {
    const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
    if (denied)
        return denied;
    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock)
        return tenantBlock;
    if (options?.preset === 'custom' && [options.fromDate, options.toDate].some(value => value != null && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value))) {
        return { ok: false, error: 'Bitte einen gültigen Zeitraum auswählen.' };
    }
    const period = resolveOfficeTimePeriod(options?.preset ?? 'today', options?.fromDate, options?.toDate);
    if (Date.parse(period.toDate) - Date.parse(period.fromDate) > 366 * 86400000)
        return { ok: false, error: 'Bitte einen Zeitraum von höchstens einem Jahr wählen.' };
    const dates = enumerateWorkDates(period.fromDate, period.toDate);
    const plannedResult = await listPlannedVisitsForPeriod(tenantId, period.fromDate, period.toDate);
    if (!plannedResult.ok)
        return plannedResult;
    const plannedVisits = plannedResult.data;
    const reviewsResult = await listReviewsForPeriod(tenantId, period.fromDate, period.toDate);
    if (!reviewsResult.ok)
        return reviewsResult;
    const allActualEntries: WfmOfficeTimeEntry[] = [];
    const employeeIdSet = new Set<string>();
    try {
        for (let index = 0; index < dates.length; index += 4) {
            const days = await Promise.all(dates.slice(index, index + 4).map(date => buildEntriesForDate(tenantId, date, new Map())));
            for (const entry of days.flat()) {
                employeeIdSet.add(entry.employeeId);
                allActualEntries.push(entry);
            }
        }
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : 'Die Zeitbuchungen konnten nicht vollständig geladen werden.' };
    }
    for (const review of reviewsResult.data) {
        if (!review.officeEntry)
            continue;
        const alreadyPresent = allActualEntries.some(entry => buildReferenceKeyFromEntry(tenantId, entry) === review.referenceKey);
        const hasPlan = plannedVisits.some(visit => visit.employeeId === review.employeeId && visit.workDate === review.workDate && (visit.assignmentId === review.referenceId || visit.visitId === review.referenceId));
        if (review.entryKind !== 'manual' && (alreadyPresent || hasPlan))
            continue;
        employeeIdSet.add(review.employeeId);
        const index = allActualEntries.findIndex(entry => entry.id === review.officeEntry!.id);
        if (index < 0)
            allActualEntries.push(review.officeEntry);
        else
            allActualEntries[index] = review.officeEntry;
    }
    for (const planned of plannedVisits) {
        employeeIdSet.add(planned.employeeId);
    }
    const activeEmployeesResult = await fetchActiveEmployeeIds(tenantId);
    if (!activeEmployeesResult.ok)
        return activeEmployeesResult;
    for (const id of activeEmployeesResult.data)
        employeeIdSet.add(id);
    const absencesResult = await readOfficeAbsences(tenantId, actorRoleKey, period.fromDate, period.toDate);
    if (!absencesResult.ok)
        return absencesResult;
    const absentEmployeeIds = new Set<string>();
    for (const absence of absencesResult.data) {
        if (dates.some(workDate => {
            if (!['approved', 'active', 'completed'].includes(absence.status))
                return false;
            const start = absence.allDay ? absence.startsAt.slice(0, 10) : berlinDateKey(absence.startsAt);
            const end = absence.allDay ? absence.endsAt.slice(0, 10) : berlinDateKey(new Date(Math.max(Date.parse(absence.startsAt), Date.parse(absence.endsAt) - 1)));
            return start <= workDate && end >= workDate;
        })) {
            absentEmployeeIds.add(absence.employeeId);
            employeeIdSet.add(absence.employeeId);
        }
    }
    const profilesResult = await fetchEmployeeProfiles(tenantId, [...employeeIdSet]);
    if (!profilesResult.ok)
        return profilesResult;
    const profiles = profilesResult.data;
    const employeeNames = new Map([...profiles.entries()].map(([id, p]) => [id, p.name]));
    const enrichedActual = allActualEntries.map((e) => ({
        ...e,
        employeeName: profiles.get(e.employeeId)?.name ?? e.employeeName,
    }));
    const joined = joinOfficeTimekeepingData(plannedVisits, enrichedActual, employeeNames);
    const reviewMap = new Map<string, WfmTimeEntryReview>();
    if (reviewsResult.ok) {
        for (const review of reviewsResult.data) {
            reviewMap.set(review.referenceKey, review);
        }
    }
    const actionsResult = await listReviewActionsForReviews(tenantId, [...reviewMap.values()].map((review) => review.id));
    if (!actionsResult.ok)
        return actionsResult;
    const latestActionMap = pickLatestReviewActions(actionsResult.data);
    const joinedWithReviews = joined.map((entry) => mergeEntryReviewOverlay(entry, reviewMap, latestActionMap));
    const approvals = await readOfficePendingRequestCount(tenantId, actorRoleKey, options?.filters?.employeeIds);
    if (!approvals.ok)
        return approvals;
    const openRequestsCount = approvals.data;
    const filtered = applyFilters(joinedWithReviews, options?.filters);
    const selectedEmployeeIds = options?.filters?.employeeIds?.length
        ? new Set(options.filters.employeeIds)
        : null;
    const visibleEmployees = [...profiles.values()]
        .filter((profile) => !selectedEmployeeIds || selectedEmployeeIds.has(profile.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const visiblePlannedVisits = selectedEmployeeIds
        ? plannedVisits.filter((visit) => selectedEmployeeIds.has(visit.employeeId))
        : plannedVisits;
    const visibleAbsentEmployeeIds = selectedEmployeeIds
        ? new Set([...absentEmployeeIds].filter((id) => selectedEmployeeIds.has(id)))
        : absentEmployeeIds;
    filtered.sort((a, b) => {
        const dateCmp = b.workDate.localeCompare(a.workDate);
        if (dateCmp !== 0)
            return dateCmp;
        return (b.plannedStartAt ?? b.actualStartAt ?? '').localeCompare(a.plannedStartAt ?? a.actualStartAt ?? '');
    });
    return {
        ok: true,
        data: {
            period,
            kpis: computeKpis(filtered, openRequestsCount, visiblePlannedVisits.length, visibleAbsentEmployeeIds),
            entries: filtered,
            employees: visibleEmployees,
        },
    };
}
export async function adoptWfmAssignmentActualToBooking(tenantId: string, actorId: string, actorRoleKey: RoleKey | null, entryId: string, reason: string, entryContext?: WfmOfficeTimeEntry | null): Promise<ServiceResult<WfmOfficeTimeEntry>> {
    const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.correct');
    if (denied)
        return denied;
    if (!reason.trim()) {
        return { ok: false, error: 'Übernahme aus Einsatz ohne Begründung ist nicht erlaubt.' };
    }
    const overview = entryContext ? { ok: true as const, data: { entries: [entryContext] } }
        : await getWfmOfficeTimeOverview(tenantId, actorRoleKey, { preset: 'last_30_days' });
    if (!overview.ok)
        return overview;
    const entry = overview.data.entries.find((e) => e.id === entryId);
    if (!entry)
        return { ok: false, error: 'Eintrag nicht gefunden.' };
    const display = (await import('./wfmOfficeTimeDisplayResolver')).resolveWfmOfficeTimeDisplay(entry);
    if (!display.hasAssignmentActual) {
        return { ok: false, error: 'Kein Einsatz-Ist für diesen Eintrag vorhanden.' };
    }
    if (entry.exportStatus === 'exported') {
        return {
            ok: false,
            error: 'Diese Buchung wurde bereits exportiert. Bitte den gesonderten Korrekturablauf verwenden.',
        };
    }
    return applyWfmOfficeTimeCorrection(tenantId, actorId, actorRoleKey, {
        entryId,
        reason,
        actualStartAt: display.assignmentActualStart,
        actualEndAt: display.assignmentActualEnd,
        status: 'pending_review',
    }, entry);
}
export async function applyWfmOfficeTimeCorrection(tenantId: string, actorId: string, actorRoleKey: RoleKey | null, input: WfmOfficeCorrectionInput, entryContext?: WfmOfficeTimeEntry | null): Promise<ServiceResult<WfmOfficeTimeEntry>> {
    const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.correct');
    if (denied)
        return denied;
    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock)
        return tenantBlock;
    if (!actorId.trim())
        return { ok: false, error: 'Bitte erneut anmelden.' };
    if (!input.reason.trim())
        return { ok: false, error: 'Korrektur ohne Begründung ist nicht erlaubt.' };
    const existing = entryContext ?? getManualEntry(input.entryId);
    if (!existing || existing.id !== input.entryId || existing.tenantId !== tenantId) {
        return { ok: false, error: 'Bitte die Buchung im gewünschten Zeitraum erneut öffnen.' };
    }
    if (existing.exportStatus === 'exported' || TERMINAL_STATUSES.has(existing.reviewStatus) || existing.canEdit === false) {
        return { ok: false, error: 'Exportierte oder gesperrte Buchungen benötigen den gesonderten Korrekturablauf.' };
    }
    const edited = { ...existing, source: 'correction' as const, officeComment: input.reason.trim(),
        actualStartAt: input.actualStartAt === undefined ? existing.actualStartAt : input.actualStartAt,
        actualEndAt: input.actualEndAt === undefined ? existing.actualEndAt : input.actualEndAt,
        pauseMinutes: input.pauseMinutes ?? existing.pauseMinutes, workKind: input.workKind ?? existing.workKind };
    const invalid = validateOfficeTimeValues(edited.actualStartAt, edited.actualEndAt, edited.pauseMinutes);
    if (invalid)
        return { ok: false, error: invalid };
    if (Date.parse(edited.actualEndAt ?? '') > Date.now())
        return { ok: false, error: 'Zukünftige Arbeitszeit kann noch nicht als abgeschlossen gespeichert werden.' };
    if (berlinDateKey(edited.actualStartAt!) !== existing.workDate)
        return { ok: false, error: 'Der Beginn muss am ausgewählten Arbeitstag liegen (Europe/Berlin).' };
    const snapshot = recalculateOfficeEntry(edited);
    const reviewCtx = await resolveReviewContextForEntry(tenantId, input.entryId, existing);
    const result = await transitionReviewStatus(tenantId, actorId, {
        entryId: input.entryId, employeeId: reviewCtx.employeeId, workDate: reviewCtx.workDate,
        entryKind: reviewCtx.entryKind, rawReferenceId: reviewCtx.rawReferenceId,
        nextStatus: 'corrected', reviewNote: input.reason.trim(), officeComment: input.reason.trim(),
        actorId, actionComment: input.reason.trim(), officeEntry: snapshot,
        expectedUpdatedAt: existing.officeRevision ?? null,
    });
    if (!result.ok)
        return result;
    if (!confirmedOfficeReview(result.data, existing, 'corrected', snapshot))
        return { ok: false, error: 'Der Server hat die Korrektur nicht eindeutig bestätigt. Bitte erneut laden.' };
    const saved = recalculateOfficeEntry(applyReviewToEntry(snapshot, result.data));
    if (getServiceMode() !== 'supabase') {
        if (getManualEntry(input.entryId))
            saveManualEntry(saved);
        await writeWfmOfficeAudit(tenantId, actorRoleKey, { entityType: 'wfm_office_time_entry', entityId: input.entryId,
            action: 'correction', actorId, summary: 'Arbeitszeitkorrektur gespeichert', reason: input.reason, metadata: { patch: saved } });
    }
    notifyWfmOfficeDataChanged(tenantId);
    return { ok: true, data: saved };
}
export async function createWfmOfficeManualEntry(tenantId: string, actorId: string, actorRoleKey: RoleKey | null, input: WfmOfficeManualEntryInput): Promise<ServiceResult<WfmOfficeTimeEntry>> {
    const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.correct');
    if (denied)
        return denied;
    if (!actorId.trim())
        return { ok: false, error: 'Bitte erneut anmelden.' };
    if (!input.reason.trim()) {
        return { ok: false, error: 'Nachtrag ohne Begründung ist nicht erlaubt.' };
    }
    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock)
        return tenantBlock;
    const invalid = validateOfficeTimeValues(input.actualStartAt, input.actualEndAt, input.pauseMinutes);
    if (invalid)
        return { ok: false, error: invalid };
    if (Date.parse(input.actualEndAt) > Date.now())
        return { ok: false, error: 'Zukünftige Arbeitszeit kann noch nicht als abgeschlossen gespeichert werden.' };
    if (berlinDateKey(input.actualStartAt) !== input.workDate)
        return { ok: false, error: 'Der Beginn muss am ausgewählten Arbeitstag liegen (Europe/Berlin).' };
    const profiles = await fetchEmployeeProfiles(tenantId, [input.employeeId]);
    if (!profiles.ok)
        return profiles;
    const profile = profiles.data.get(input.employeeId);
    if (!profile)
        return { ok: false, error: 'Das Mitarbeiterprofil ist nicht verfügbar.' };
    const grossMinutes = minutesBetween(input.actualStartAt, input.actualEndAt);
    const netMinutes = Math.max(0, grossMinutes - input.pauseMinutes);
    const id = input.entryId ?? crypto.randomUUID();
    const entry: WfmOfficeTimeEntry = {
        id,
        tenantId,
        employeeId: input.employeeId,
        employeeName: profile.name,
        workDate: input.workDate,
        assignmentId: input.assignmentId ?? null,
        visitId: null,
        clientLabel: null,
        plannedStartAt: null,
        plannedEndAt: null,
        actualStartAt: input.actualStartAt,
        actualEndAt: input.actualEndAt,
        startDeviationMinutes: null,
        endDeviationMinutes: null,
        startAmpel: null,
        endAmpel: null,
        overallAmpel: null,
        startJustification: null,
        endJustification: null,
        startJustificationAt: null,
        endJustificationAt: null,
        pauseMinutes: input.pauseMinutes,
        grossMinutes,
        netMinutes,
        travelMinutes: null,
        workKind: input.workKind === 'nachtrag' ? 'nachtrag' : input.workKind,
        status: 'pending_review',
        source: 'manual_addition',
        reviewStatus: 'pending_review',
        exportStatus: 'not_exported',
        sessionId: null,
        officeComment: input.reason,
        hasOpenOfficeMessage: false,
        flags: [],
    };
    const reviewResult = await upsertReview(tenantId, actorId, {
        entryId: id,
        employeeId: input.employeeId,
        workDate: input.workDate,
        entryKind: 'manual',
        nextStatus: 'pending_review',
        reviewNote: input.reason,
        officeComment: input.reason,
        actorId,
        actionComment: input.reason, officeEntry: entry, expectedUpdatedAt: null,
    });
    if (!reviewResult.ok)
        return reviewResult;
    if (!confirmedOfficeReview(reviewResult.data, entry, 'pending_review', entry))
        return { ok: false, error: 'Der Server hat den Nachtrag nicht eindeutig bestätigt. Bitte erneut laden.' };
    const saved = recalculateOfficeEntry(applyReviewToEntry(entry, reviewResult.data));
    if (getServiceMode() !== 'supabase') {
        saveManualEntry(saved);
        await writeWfmOfficeAudit(tenantId, actorRoleKey, { entityType: 'wfm_office_time_entry', entityId: id,
            action: 'manual_addition', actorId, summary: `Office-Nachtrag für ${saved.employeeName} am ${saved.workDate}`, reason: input.reason, source: 'office' });
    }
    notifyWfmOfficeDataChanged(tenantId);
    return { ok: true, data: saved };
}
export async function reviewWfmOfficeTimeEntry(tenantId: string, actorId: string, actorRoleKey: RoleKey | null, entryId: string, decision: 'approved' | 'rejected' | 'exported' | 'locked' | 'open' | 'needs_clarification', reviewNote?: string, entryContext?: WfmOfficeTimeEntry | null): Promise<ServiceResult<WfmOfficeTimeEntry>> {
    const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.correct');
    if (denied)
        return denied;
    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock)
        return tenantBlock;
    const existing = entryContext ?? getManualEntry(entryId);
    if (!existing || existing.id !== entryId || existing.tenantId !== tenantId || !existing.employeeId || !actorId) {
        return { ok: false, error: 'Bitte die Buchung im gewünschten Zeitraum erneut öffnen.' };
    }
    if (decision === 'exported')
        return { ok: false, error: 'Bitte Buchungen über den geprüften Exportablauf exportieren.' };
    if (['rejected', 'needs_clarification'].includes(decision) && !reviewNote?.trim()) {
        return { ok: false, error: decision === 'rejected' ? 'Ablehnung ohne Grund ist nicht erlaubt.' : 'Rückfrage ohne Nachricht ist nicht erlaubt.' };
    }
    if (TERMINAL_STATUSES.has(existing.reviewStatus) || existing.exportStatus === 'exported') {
        return { ok: false, error: 'Exportierte oder gesperrte Buchungen benötigen den gesonderten Korrekturablauf.' };
    }
    if (decision === 'approved' && !canApproveWfmOfficeTimeEntry(existing)) {
        return { ok: false, error: 'Nur offene Buchungen mit vollständig erfasster und abgeschlossener Arbeitszeit können genehmigt werden.' };
    }
    const display = resolveWfmOfficeTimeDisplay(existing);
    const actualSnapshot = { ...existing, actualStartAt: display.displayStart, actualEndAt: display.displayEnd,
        source: display.bookingStatus === 'assignment_only' ? 'correction' as const : existing.source,
        rowKind: existing.rowKind === 'planned_missing_actual' ? 'planned_with_actual' as const : existing.rowKind };
    const snapshot = decision === 'approved'
        ? display.bookingStatus === 'assignment_only' || existing.source === 'correction' || existing.source === 'manual_addition'
            ? recalculateOfficeEntry(actualSnapshot) : actualSnapshot
        : undefined;
    if (snapshot) {
        const invalid = validateOfficeTimeValues(snapshot.actualStartAt, snapshot.actualEndAt, snapshot.pauseMinutes);
        if (invalid)
            return { ok: false, error: invalid };
    }
    const reviewCtx = await resolveReviewContextForEntry(tenantId, entryId, existing);
    const ctx = officeReviewIdentity(existing);
    let review: WfmTimeEntryReview;
    if (getServiceMode() === 'supabase') {
        const client = getSupabaseClient();
        if (!client)
            return { ok: false, error: 'Keine Datenbankverbindung. Die Prüfung wurde nicht gespeichert.' };
        const { officeRevision: _revision, ...stored } = snapshot ?? existing;
        const result = await (client as unknown as {
            rpc: (name: string, args: Record<string, unknown>) => {
                single: () => Promise<{
                    data: unknown;
                    error: import('@supabase/supabase-js').PostgrestError | null;
                }>;
            };
        }).rpc('wfm_review_office_time_entry', {
            p_tenant_id: tenantId, p_employee_id: ctx.employeeId, p_work_date: ctx.workDate,
            p_entry_kind: ctx.entryKind, p_reference_id: ctx.referenceId, p_reference_key: ctx.referenceKey,
            p_review_status: decision, p_review_note: reviewNote?.trim() || null,
            p_expected_updated_at: existing.officeRevision ?? null, p_office_entry: snapshot ? stored : null,
        }).single();
        if (result.error || !result.data)
            return { ok: false, error: result.error?.code === '40001'
                    ? 'Die Buchung wurde inzwischen geändert. Bitte neu öffnen und erneut prüfen.'
                    : result.error?.code === 'PGRST202' || result.error?.code === '42883'
                        ? 'Die sichere Arbeitszeitprüfung ist noch nicht verfügbar. Bitte später erneut versuchen.'
                        : result.error ? toGermanSupabaseError(result.error) : 'Der Server hat die Prüfung nicht bestätigt.' };
        review = mapOfficeReviewRow(result.data as Record<string, unknown>);
    }
    else {
        const current = await getReviewByReferenceKey(tenantId, ctx.referenceKey);
        if (!current.ok)
            return current;
        if ((current.data?.updatedAt ?? null) !== (existing.officeRevision ?? null)) {
            return { ok: false, error: 'Die Buchung wurde inzwischen geändert. Bitte neu öffnen und erneut prüfen.' };
        }
        const result = await transitionReviewStatus(tenantId, actorId, {
            entryId, ...reviewCtx, nextStatus: mapUiReviewDecisionToDb(decision), reviewNote: reviewNote?.trim() || null,
            officeComment: reviewNote?.trim() || existing.officeComment, actorId, actionComment: reviewNote?.trim() || null,
            officeEntry: snapshot, expectedUpdatedAt: existing.officeRevision ?? null,
        });
        if (!result.ok)
            return result;
        review = result.data;
    }
    if (!confirmedOfficeReview(review, existing, decision, snapshot)) {
        return { ok: false, error: 'Der Server hat die Prüfung nicht eindeutig bestätigt. Bitte die Buchung erneut laden.' };
    }
    const saved = enrichOfficeTimeEntryDisplay(applyReviewToEntry(snapshot ?? existing, review));
    if (getServiceMode() !== 'supabase' && getManualEntry(entryId))
        saveManualEntry(saved);
    notifyWfmOfficeDataChanged(tenantId);
    return { ok: true, data: saved };
}
export async function submitVisitDeviationJustification(tenantId: string, employeeId: string, actorId: string, input: {
    visitId: string;
    assignmentId?: string | null;
    clientLabel?: string | null;
    phase: WfmDeviationPhase;
    plannedAt: string;
    actualAt: string;
    justification: string;
    entryId?: string | null;
}): Promise<ServiceResult<{
    allowed: boolean;
    message?: WfmOfficeMessage;
}>> {
    const validationError = validateDeviationJustification(input.justification);
    if (validationError)
        return { ok: false, error: validationError };
    const evaluation = evaluateVisitTimeDeviation(input.plannedAt, input.actualAt, input.phase);
    if (!evaluation.requiresJustification) {
        return { ok: true, data: { allowed: true } };
    }
    const now = new Date().toISOString();
    setVisitJustification(tenantId, input.visitId, employeeId, input.phase, {
        text: input.justification.trim(),
        submittedAt: now,
        ampel: evaluation.ampel,
        deviationMinutes: evaluation.deviationMinutes,
        direction: evaluation.direction,
    });
    const entryId = input.entryId ?? `visit:${input.visitId}:${workDateFromIso(input.actualAt)}`;
    const patch: Partial<WfmOfficeTimeEntry> = {
        plannedStartAt: input.phase === 'start' ? input.plannedAt : undefined,
        plannedEndAt: input.phase === 'end' ? input.plannedAt : undefined,
        reviewStatus: evaluation.ampel === 'red' || evaluation.ampel === 'blue' ? 'pending_review' : undefined,
    };
    if (input.phase === 'start') {
        patch.startJustification = input.justification.trim();
        patch.startAmpel = evaluation.ampel;
        patch.actualStartAt = input.actualAt;
    }
    else {
        patch.endJustification = input.justification.trim();
        patch.endAmpel = evaluation.ampel;
        patch.actualEndAt = input.actualAt;
    }
    setEntryOverlay(entryId, patch);
    let message: WfmOfficeMessage | undefined;
    if (evaluation.ampel === 'red' || evaluation.ampel === 'blue') {
        message = {
            id: createMessageId(),
            tenantId,
            employeeId,
            assignmentId: input.assignmentId ?? null,
            visitId: input.visitId,
            clientLabel: input.clientLabel ?? null,
            phase: input.phase,
            plannedAt: input.plannedAt,
            actualAt: input.actualAt,
            deviationMinutes: evaluation.deviationMinutes,
            direction: evaluation.direction,
            ampel: evaluation.ampel,
            justification: input.justification.trim(),
            justificationAt: now,
            reviewStatus: 'pending_review',
            entryId,
            createdAt: now,
        };
        appendOfficeMessage(tenantId, message);
    }
    // The validated justification immediately authorises the employee action.
    // Administration review/audit are durable projections and must not keep the
    // workflow button spinning. They are coalesced and retried by later events.
    scheduleDeferredTask(`wfm-deviation:${tenantId}:${input.visitId}:${input.phase}`, async () => {
        if (evaluation.ampel === 'red' || evaluation.ampel === 'blue') {
            const workDate = workDateFromIso(input.actualAt);
            const reviewed = await upsertReview(tenantId, actorId, {
                entryId,
                employeeId,
                workDate,
                entryKind: 'visit',
                nextStatus: 'pending_review',
                reviewNote: input.justification.trim(),
                actorId,
                actionComment: 'Deviation justification submitted',
            });
            if (!reviewed.ok)
                throw new Error(reviewed.error);
        }
        const audited = await writeWfmOfficeAudit(tenantId, null, {
            entityType: 'wfm_visit_deviation',
            entityId: input.visitId,
            action: `deviation_${input.phase}`,
            actorId,
            summary: `${input.phase === 'start' ? 'Start' : 'Ende'}-Abweichung: ${evaluation.deviationMinutes} Min. (${evaluation.ampel})`,
            reason: input.justification.trim(),
            source: 'portal',
            metadata: {
                plannedAt: input.plannedAt,
                actualAt: input.actualAt,
                deviationMinutes: evaluation.deviationMinutes,
                direction: evaluation.direction,
                ampel: evaluation.ampel,
            },
        });
        if (!audited.ok)
            throw new Error(audited.error);
    });
    return { ok: true, data: { allowed: true, message } };
}
export function checkVisitDeviationGate(tenantId: string, employeeId: string, visitId: string, phase: WfmDeviationPhase, plannedAt: string | null | undefined, actualAt: string | null | undefined): {
    blocked: boolean;
    evaluation: ReturnType<typeof evaluateVisitTimeDeviation>;
    needsJustification: boolean;
} {
    const evaluation = evaluateVisitTimeDeviation(plannedAt, actualAt, phase);
    if (!evaluation.requiresJustification) {
        return { blocked: false, evaluation, needsJustification: false };
    }
    const just = getVisitJustification(tenantId, visitId, employeeId);
    const hasJustification = phase === 'start' ? Boolean(just?.start?.text) : Boolean(just?.end?.text);
    return {
        blocked: !hasJustification,
        evaluation,
        needsJustification: true,
    };
}
function workDateFromIso(iso: string): string {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
export async function getWfmOfficeExportWarnings(tenantId: string, actorRoleKey: RoleKey | null, preset: WfmOfficePeriodPreset, fromDate?: string, toDate?: string): Promise<ServiceResult<{
    warnings: string[];
    approvedCount: number;
    totalCount: number;
}>> {
    const warnings: string[] = [];
    const period = resolveOfficeTimePeriod(preset, fromDate, toDate);
    const manualPending = listManualEntries(tenantId).filter((e) => e.workDate >= period.fromDate &&
        e.workDate <= period.toDate &&
        (e.reviewStatus === 'pending_review' || e.reviewStatus === 'open'));
    if (manualPending.length) {
        warnings.push(`${manualPending.length} offene/ungeprüfte Nachträge im Zeitraum.`);
    }
    const overview = await getWfmOfficeTimeOverview(tenantId, actorRoleKey, { preset, fromDate, toDate });
    if (!overview.ok)
        return overview;
    const pending = overview.data.entries.filter(isOfficeAccountOpenReview);
    const rotBlau = overview.data.entries.filter((e) => (e.overallAmpel === 'red' || e.overallAmpel === 'blue') && e.reviewStatus !== 'approved');
    if (pending.length)
        warnings.push(`${pending.length} offene/ungeprüfte Einträge im Zeitraum.`);
    if (rotBlau.length)
        warnings.push(`${rotBlau.length} Rot/Blau-Abweichungen noch nicht freigegeben.`);
    const approvedCount = overview.data.entries.filter((e) => e.reviewStatus === 'approved').length;
    return {
        ok: true,
        data: {
            warnings,
            approvedCount,
            totalCount: overview.data.entries.length,
        },
    };
}
export { updateOfficeMessageReview, listOfficeMessages };
