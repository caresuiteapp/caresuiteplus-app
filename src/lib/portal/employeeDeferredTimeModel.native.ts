// Generated native presentation from src/lib/portal/employeeDeferredTimeModel.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { PayrollDeferredTimeEntry } from '@/types/modules/payrollMonth';
import type { WfmOfficePlannedVisit, WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { joinOfficeTimekeepingData } from '@/lib/wfm/wfmOfficeDataJoinService';
import { applyReviewToEntry, type WfmTimeEntryReview } from '@/lib/wfm/wfmTimeReviewService';
import { officeReviewIdentity } from '@/lib/wfm/wfmOfficeReviewIntegrity';
import { payrollDeferredReason, type PayrollRow } from "../payroll/payrollOfficeReadModel.native.ts";
import { matchDeferredPayrollEntry, payrollTimeRegistry } from "../payroll/payrollTimeDeferral.native.ts";
export type EmployeeDeferredTime = {
    id: string;
    workDate: string;
    label: string;
    reason: PayrollDeferredTimeEntry['reason'];
    state: 'correction_needed' | 'awaiting_review' | 'office_required';
    entry: WfmOfficeTimeEntry | null;
    entryKind: 'session' | 'visit' | 'manual' | 'meeting';
    referenceId: string | null;
    sourceUpdatedAt: string | null;
    reviewUpdatedAt: string | null;
    visitRouteId: string | null;
    note: string | null;
};
export type EmployeeTimeSource = {
    id: string;
    legacyId?: string | null;
    updatedAt: string | null;
};
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
/** The same join and review overlays as Office, restricted to the signed-in employee. */
export function employeeDeferredTimes(input: {
    tenantId: string;
    employeeId: string;
    entries: WfmOfficeTimeEntry[];
    visits: WfmOfficePlannedVisit[];
    reviews: WfmTimeEntryReview[];
    statements: PayrollRow[];
    visitSources: EmployeeTimeSource[];
    sessionSources: EmployeeTimeSource[];
    now: number;
}): EmployeeDeferredTime[] {
    const { tenantId, employeeId, now } = input;
    const own = (entry: {
        tenantId: string;
        employeeId: string;
    }) => entry.tenantId === tenantId && entry.employeeId === employeeId;
    const visits = input.visits.filter(own), reviews = input.reviews.filter(own);
    const actual = input.entries.filter(own);
    for (const review of reviews) {
        if (!review.officeEntry)
            continue;
        const present = actual.some(entry => officeReviewIdentity(entry).referenceKey === review.referenceKey);
        const planned = visits.some(visit => visit.workDate === review.workDate && [visit.visitId, visit.assignmentId].includes(review.referenceId));
        if (review.entryKind === 'manual' || !present && !planned) {
            const index = actual.findIndex(entry => entry.id === review.officeEntry!.id);
            if (index < 0)
                actual.push(review.officeEntry);
            else
                actual[index] = review.officeEntry;
        }
    }
    const byReview = new Map(reviews.map(review => [review.referenceKey, review]));
    const entries = joinOfficeTimekeepingData(visits, actual, new Map()).map(entry => applyReviewToEntry(entry, byReview.get(officeReviewIdentity(entry).referenceKey)));
    const registry = payrollTimeRegistry(input.statements.filter(row => row.tenant_id === tenantId), employeeId);
    const tasks: EmployeeDeferredTime[] = [];
    for (const entry of entries) {
        const reason = payrollDeferredReason(entry, now);
        if (!reason)
            continue;
        const identity = officeReviewIdentity(entry), review = byReview.get(identity.referenceKey);
        const source = identity.entryKind === 'session' ? input.sessionSources.find(row => row.id === identity.referenceId)
            : identity.entryKind === 'manual' ? review ? { updatedAt: review.updatedAt ?? null } : undefined
                : input.visitSources.find(row => row.id === identity.referenceId)
                    ?? (() => { const candidates = input.visitSources.filter(row => row.legacyId === identity.referenceId); return candidates.length === 1 ? candidates[0] : undefined; })();
        const settled = [...registry.settled.values()].some(({ item }) => item.sourceEntryId === entry.id || matchDeferredPayrollEntry(item, [entry]) != null);
        const protectedEntry = settled || entry.exportStatus === 'exported' || ['exported', 'locked', 'superseded'].includes(review?.reviewStatus ?? entry.reviewStatus);
        const waiting = reason === 'unapproved' && entry.actualStartAt && entry.actualEndAt && entry.reviewStatus !== 'needs_clarification';
        const state = protectedEntry || !uuid.test(identity.referenceId) || !source || !source.updatedAt
            ? 'office_required' : waiting ? 'awaiting_review' : 'correction_needed';
        tasks.push({ id: entry.id, workDate: entry.workDate, label: entry.clientLabel || entry.assignmentTitle || 'Arbeitszeit', reason,
            state, entry, entryKind: identity.entryKind, referenceId: identity.referenceId,
            sourceUpdatedAt: source?.updatedAt ?? null, reviewUpdatedAt: review?.updatedAt ?? null,
            visitRouteId: identity.entryKind === 'visit' ? entry.assignmentId ?? entry.visitId : null,
            note: protectedEntry ? 'Die Verwaltung muss diese bereits abgerechnete oder gesperrte Zeit prüfen.'
                : state === 'office_required' ? 'Die Zeit konnte keiner bearbeitbaren Buchung eindeutig zugeordnet werden. Bitte die Verwaltung informieren.'
                    : review?.reviewNote ?? null });
    }
    // A missing source must remain visible; never claim that a deleted/ambiguous deferral is done.
    for (const item of registry.deferred.values()) {
        if (registry.settled.has(item.key) || matchDeferredPayrollEntry(item, entries))
            continue;
        tasks.push({ id: item.key, workDate: item.workDate, label: item.clientLabel || item.assignmentTitle,
            reason: item.reason, state: 'office_required', entry: null, entryKind: 'manual', referenceId: null,
            sourceUpdatedAt: null, reviewUpdatedAt: null, visitRouteId: null,
            note: 'Die ursprüngliche Buchung ist nicht mehr eindeutig verfügbar. Bitte die Verwaltung informieren.' });
    }
    return tasks.sort((a, b) => b.workDate.localeCompare(a.workDate) || a.label.localeCompare(b.label, 'de') || a.id.localeCompare(b.id));
}
export const EMPLOYEE_DEFERRED_REASON_LABELS: Record<EmployeeDeferredTime['reason'], string> = {
    missing: 'Zeiterfassung fehlt', incomplete: 'Abschluss fehlt oder ist ungültig',
    rejected: 'Zeitprüfung abgelehnt', unapproved: 'Freigabe durch die Verwaltung steht aus', deferred: 'Zur Nachbearbeitung zurückgestellt',
};
