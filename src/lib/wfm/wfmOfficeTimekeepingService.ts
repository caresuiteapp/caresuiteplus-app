import type { RoleKey, ServiceResult } from '@/types';
import type {
  WfmOfficeCorrectionInput,
  WfmOfficeManualEntryInput,
  WfmOfficeMessage,
  WfmOfficeTimeEntry,
  WfmOfficeTimeEntryStatus,
  WfmOfficeTimeFilters,
  WfmOfficeTimeKpis,
  WfmOfficeTimeOverview,
  WfmOfficePeriodPreset,
  WfmDeviationPhase,
} from '@/types/modules/wfmOfficeTimekeeping';
import type { WfmTimeEvent, WfmWorkSession } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { enumerateWorkDates, resolveOfficeTimePeriod } from './wfmOfficeDateRange';
import { writeWfmOfficeAudit } from './wfmOfficeAuditService';
import {
  appendOfficeMessage,
  createEntryId,
  createMessageId,
  getEntryOverlay,
  getManualEntry,
  getVisitJustification,
  listManualEntries,
  listOfficeMessages,
  saveManualEntry,
  setEntryOverlay,
  setVisitJustification,
  updateOfficeMessageReview,
} from './wfmOfficeTimekeepingStore';
import {
  combineDeviationAmpel,
  evaluateVisitTimeDeviation,
  shouldAutoPendingReview,
  validateDeviationJustification,
} from './wfmVisitDeviationAmpelService';
import { listPendingWfmApprovals } from './wfmApprovalService';
import {
  fetchSessionEvents,
  listSessionsForDate,
  todayWorkDate,
} from './wfmWorkSessionRepository';
import { joinOfficeTimekeepingData } from './wfmOfficeDataJoinService';
import {
  fetchActiveEmployeeIds,
  listPlannedVisitsForPeriod,
} from './wfmOfficePlannedVisitRepository';
import { listWfmAbsencesForTeam } from './wfmAbsenceService';
import { isWfmAbsenceCoveringDate } from './wfmDisplayHelpers';
import {
  applyReviewToEntry,
  buildReferenceKeyFromEntry,
  ensurePendingReviewForEntry,
  getReviewByReferenceKey,
  isOpenReviewStatus,
  listReviewActionsForReviews,
  listReviewsForPeriod,
  mapDbReviewStatusToUi,
  mapUiReviewDecisionToDb,
  pickLatestReviewActions,
  resolveEntryKindFromOfficeEntry,
  resolveReferenceRawId,
  transitionReviewStatus,
  upsertReview,
  WFM_REVIEW_SYSTEM_ACTOR,
  type WfmTimeEntryReview,
  type WfmTimeReviewStatus,
} from './wfmTimeReviewService';

function mergeEntryReviewOverlay(
  entry: WfmOfficeTimeEntry,
  reviewMap: Map<string, WfmTimeEntryReview>,
  latestActionMap: Map<string, import('./wfmTimeReviewService').WfmTimeReviewAction>,
): WfmOfficeTimeEntry {
  // Older versions prematurely materialised pending reviews for future
  // assignments. An upcoming visit must remain planned and must never inflate
  // the open-review counter, even if such a stale review row still exists.
  if (entry.rowKind === 'planned_upcoming') {
    return {
      ...entry,
      status: 'open',
      reviewStatus: 'open',
      exportStatus: 'not_exported',
      flags: entry.flags.filter((flag) => flag !== 'missing_booking'),
    };
  }
  const overlay = getEntryOverlay(entry.id) ?? {};
  const referenceKey = buildReferenceKeyFromEntry(entry.tenantId, entry);
  const review = reviewMap.get(referenceKey);
  const latestAction = review ? latestActionMap.get(review.id) ?? null : null;
  const withReview = applyReviewToEntry(entry, review, latestAction);
  if (!review && overlay.reviewStatus) {
    return {
      ...withReview,
      ...overlay,
      id: entry.id,
      reviewStatus: overlay.reviewStatus ?? withReview.reviewStatus,
      status: overlay.status ?? overlay.reviewStatus ?? withReview.status,
    };
  }
  return {
    ...withReview,
    ...overlay,
    id: entry.id,
    reviewStatus: withReview.reviewStatus,
    status: withReview.status,
    exportStatus: withReview.exportStatus,
    reviewNote: withReview.reviewNote,
    reviewedAt: withReview.reviewedAt,
    reviewedBy: withReview.reviewedBy,
    lastReviewAction: withReview.lastReviewAction,
    lastReviewComment: withReview.lastReviewComment,
  };
}

async function resolveReviewContextForEntry(
  tenantId: string,
  entryId: string,
  entry?: WfmOfficeTimeEntry | null,
): Promise<{
  employeeId: string;
  workDate: string;
  entryKind?: 'session' | 'visit' | 'manual' | 'meeting';
  rawReferenceId?: string;
}> {
  if (entry && entry.id === entryId && entry.tenantId === tenantId) {
    return {
      employeeId: entry.employeeId,
      workDate: entry.workDate,
      entryKind: resolveEntryKindFromOfficeEntry(entry),
      rawReferenceId: resolveReferenceRawId(entry) ?? entry.id,
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

type EmployeeProfile = { id: string; name: string };

async function fetchEmployeeProfiles(
  tenantId: string,
  employeeIds: string[],
): Promise<Map<string, EmployeeProfile>> {
  const map = new Map<string, EmployeeProfile>();
  if (employeeIds.length === 0) return map;

  if (getServiceMode() !== 'supabase') {
    for (const id of employeeIds) {
      map.set(id, { id, name: `Mitarbeiter ${id.slice(-4)}` });
    }
    return map;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return map;

  const { data } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .in('id', employeeIds);

  for (const row of data ?? []) {
    const r = row as { id: string; first_name: string | null; last_name: string | null };
    const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
    map.set(r.id, { id: r.id, name: name || `Mitarbeitende ${r.id.slice(0, 8)}` });
  }
  return map;
}

function resolveWorkKind(session: WfmWorkSession | null): WfmOfficeTimeEntry['workKind'] {
  if (!session) return 'sonstige';
  if (session.status === 'on_visit' || session.workMode === 'field') return 'einsatz';
  if (session.status === 'homeoffice' || session.displayStatus === 'homeoffice') return 'homeoffice';
  if (session.status === 'office' || session.displayStatus === 'buero') return 'buero';
  if (session.status === 'driving') return 'fahrt';
  if (session.status === 'paused') return 'pause';
  return 'sonstige';
}

function minutesBetween(startIso: string | null, endIso: string | null): number {
  if (!startIso || !endIso) return 0;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.round(ms / 60_000);
}

function buildVisitEntryFromEvents(
  tenantId: string,
  employeeId: string,
  employeeName: string,
  workDate: string,
  visitId: string,
  events: WfmTimeEvent[],
  session: WfmWorkSession | null,
  overlay: Partial<WfmOfficeTimeEntry>,
): WfmOfficeTimeEntry {
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

  const grossMinutes =
    overlay.grossMinutes ??
    (actualStartAt && actualEndAt ? minutesBetween(actualStartAt, actualEndAt) : session?.grossMinutes ?? 0);
  const pauseMinutes = overlay.pauseMinutes ?? session?.pauseMinutes ?? 0;
  const netMinutes = overlay.netMinutes ?? Math.max(0, grossMinutes - pauseMinutes);

  const startAmpel =
    plannedStartAt && actualStartAt && !startEval.noPlannedTime ? startEval.ampel : null;
  const endAmpel = plannedEndAt && actualEndAt && !endEval.noPlannedTime ? endEval.ampel : null;
  const overallAmpel = combineDeviationAmpel(startAmpel, endAmpel);

  const entryId = overlay.id ?? `visit:${visitId}:${workDate}`;
  const status =
    overlay.status ??
    (shouldAutoPendingReview(startAmpel, endAmpel) ? 'pending_review' : 'open');

  const openMessages = listOfficeMessages(tenantId).some(
    (m) => m.visitId === visitId && m.reviewStatus === 'pending_review',
  );

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

function buildSessionEntry(
  tenantId: string,
  employeeId: string,
  employeeName: string,
  session: WfmWorkSession,
  overlay: Partial<WfmOfficeTimeEntry>,
): WfmOfficeTimeEntry {
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

async function buildEntriesForDate(
  tenantId: string,
  workDate: string,
  profiles: Map<string, EmployeeProfile>,
): Promise<WfmOfficeTimeEntry[]> {
  const sessionsResult = await listSessionsForDate(tenantId, workDate);
  if (!sessionsResult.ok) return [];

  const entries: WfmOfficeTimeEntry[] = [];
  const visitIdsHandled = new Set<string>();

  for (const session of sessionsResult.data) {
    const profile = profiles.get(session.employeeId) ?? {
      id: session.employeeId,
      name: `Mitarbeitende ${session.employeeId.slice(0, 8)}`,
    };
    const eventsResult = await fetchSessionEvents(tenantId, session.id);
    const events = eventsResult.ok ? eventsResult.data : [];

    const visitStartEvents = events.filter((e) => e.eventType === 'visit_started');
    for (const startEvent of visitStartEvents) {
      const visitId = startEvent.referenceId ?? session.currentVisitId ?? `evt-${startEvent.id}`;
      if (visitIdsHandled.has(`${session.employeeId}:${visitId}`)) continue;
      visitIdsHandled.add(`${session.employeeId}:${visitId}`);
      const related = events.filter(
        (e) =>
          (e.referenceId ?? session.currentVisitId) === visitId &&
          (e.eventType === 'visit_started' ||
            e.eventType === 'visit_ended' ||
            e.eventType === 'visit_arrived'),
      );
      const overlay = getEntryOverlay(`visit:${visitId}:${workDate}`) ?? {};
      entries.push(
        buildVisitEntryFromEvents(
          tenantId,
          session.employeeId,
          profile.name,
          workDate,
          visitId,
          related,
          session,
          overlay,
        ),
      );
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
    if (manual.workDate === workDate) entries.push(manual);
  }

  return entries;
}

function computeKpis(
  entries: WfmOfficeTimeEntry[],
  openRequestsCount: number,
  plannedVisitCount: number,
  absentEmployeeIds: Set<string>,
): WfmOfficeTimeKpis {
  const today = todayWorkDate();
  const todayEntries = entries.filter((e) => e.workDate === today);
  const activeEmployees = new Set(entries.map((e) => e.employeeId)).size;
  const employeesWithTime = new Set(
    entries.filter((e) => e.actualStartAt).map((e) => e.employeeId),
  ).size;
  const employeesPlanned = new Set(
    entries.filter((e) => e.plannedStartAt || e.plannedEndAt || e.rowKind === 'planned_missing_actual').map(
      (e) => e.employeeId,
    ),
  ).size;

  const sumNet = (filter: (e: WfmOfficeTimeEntry) => boolean) =>
    entries.filter(filter).reduce((acc, e) => acc + e.netMinutes, 0);

  const missingBookings = entries.filter(
    (e) => e.rowKind === 'planned_missing_actual' || e.flags.includes('missing_booking'),
  ).length;
  const unplannedBookings = entries.filter(
    (e) => e.rowKind === 'unplanned_actual' || e.flags.includes('unplanned'),
  ).length;
  const recordedVisits = entries.filter((e) => e.actualStartAt && e.workKind === 'einsatz').length;

  return {
    totalHours: Math.round((sumNet(() => true) / 60) * 10) / 10,
    visitHours: Math.round((sumNet((e) => e.workKind === 'einsatz') / 60) * 10) / 10,
    pauseMinutes: entries.reduce((acc, e) => acc + e.pauseMinutes, 0),
    travelMinutes: entries.reduce((acc, e) => acc + (e.travelMinutes ?? 0), 0),
    officeMinutes: sumNet((e) => e.workKind === 'buero'),
    homeofficeMinutes: sumNet((e) => e.workKind === 'homeoffice'),
    activeEmployees,
    pendingReviewCount: entries.filter((e) => isOpenReviewStatus(e.reviewStatus)).length,
    openOfficeMessages: entries.filter((e) => e.hasOpenOfficeMessage).length,
    correctionCount: entries.filter((e) => e.source === 'correction' || e.workKind === 'korrektur').length,
    missingBookings,
    planningDeviations: entries.filter(
      (e) => e.overallAmpel === 'yellow' || e.overallAmpel === 'red' || e.overallAmpel === 'blue',
    ).length,
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
  if (!filters) return entries;
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
    result = result.filter((e) => isOpenReviewStatus(e.reviewStatus));
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

export async function getWfmOfficeTimeOverview(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  options?: {
    preset?: WfmOfficePeriodPreset;
    fromDate?: string | null;
    toDate?: string | null;
    filters?: Partial<WfmOfficeTimeFilters>;
  },
): Promise<ServiceResult<WfmOfficeTimeOverview>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const period = resolveOfficeTimePeriod(
    options?.preset ?? 'today',
    options?.fromDate,
    options?.toDate,
  );
  const dates = enumerateWorkDates(period.fromDate, period.toDate);

  const plannedResult = await listPlannedVisitsForPeriod(tenantId, period.fromDate, period.toDate);
  const plannedVisits = plannedResult.ok ? plannedResult.data : [];

  const allActualEntries: WfmOfficeTimeEntry[] = [];
  const employeeIdSet = new Set<string>();

  for (const workDate of dates) {
    const dayEntries = await buildEntriesForDate(tenantId, workDate, new Map());
    for (const e of dayEntries) {
      employeeIdSet.add(e.employeeId);
      allActualEntries.push(e);
    }
  }

  for (const planned of plannedVisits) {
    employeeIdSet.add(planned.employeeId);
  }

  const activeEmployeesResult = await fetchActiveEmployeeIds(tenantId);
  if (activeEmployeesResult.ok) {
    for (const id of activeEmployeesResult.data) employeeIdSet.add(id);
  }

  const profiles = await fetchEmployeeProfiles(tenantId, [...employeeIdSet]);
  const employeeNames = new Map([...profiles.entries()].map(([id, p]) => [id, p.name]));

  const enrichedActual = allActualEntries.map((e) => ({
    ...e,
    employeeName: profiles.get(e.employeeId)?.name ?? e.employeeName,
  }));

  const joined = joinOfficeTimekeepingData(plannedVisits, enrichedActual, employeeNames);

  for (const entry of joined) {
    if (entry.flags.includes('auto_booked_from_assignment_actual')) {
      const referenceKey = buildReferenceKeyFromEntry(tenantId, entry);
      const existing = await getReviewByReferenceKey(tenantId, referenceKey);
      if (!existing.ok || existing.data?.reviewStatus !== 'approved') {
        await transitionReviewStatus(tenantId, WFM_REVIEW_SYSTEM_ACTOR, {
          entryId: entry.id,
          employeeId: entry.employeeId,
          workDate: entry.workDate,
          entryKind: resolveEntryKindFromOfficeEntry(entry),
          rawReferenceId: resolveReferenceRawId(entry) ?? entry.id,
          nextStatus: 'approved',
          reviewNote: 'Automatisch aus vollständigem Einsatz-Ist innerhalb der 5-Minuten-Toleranz gebucht.',
          officeComment: 'Automatische Arbeitszeitbuchung aus Einsatz-Ist.',
          actorId: WFM_REVIEW_SYSTEM_ACTOR,
          actionComment: 'Automatische Freigabe: vollständige grüne Einsatz-Ist-Zeiten.',
        });
      }
      continue;
    }
    await ensurePendingReviewForEntry(tenantId, WFM_REVIEW_SYSTEM_ACTOR, entry);
  }

  const reviewsResult = await listReviewsForPeriod(tenantId, period.fromDate, period.toDate);
  const reviewMap = new Map<string, WfmTimeEntryReview>();
  if (reviewsResult.ok) {
    for (const review of reviewsResult.data) {
      reviewMap.set(review.referenceKey, review);
    }
  }

  const actionsResult = await listReviewActionsForReviews(
    tenantId,
    [...reviewMap.values()].map((review) => review.id),
  );
  const latestActionMap = actionsResult.ok
    ? pickLatestReviewActions(actionsResult.data)
    : new Map();

  const joinedWithReviews = joined.map((entry) =>
    mergeEntryReviewOverlay(entry, reviewMap, latestActionMap),
  );

  const absencesResult = await listWfmAbsencesForTeam(tenantId, actorRoleKey);
  const absentEmployeeIds = new Set<string>();
  if (absencesResult.ok) {
    for (const absence of absencesResult.data) {
      for (const workDate of dates) {
        if (isWfmAbsenceCoveringDate(absence, workDate)) {
          absentEmployeeIds.add(absence.employeeId);
          employeeIdSet.add(absence.employeeId);
        }
      }
    }
  }

  for (const id of employeeIdSet) {
    if (!profiles.has(id)) {
      profiles.set(id, { id, name: `Mitarbeitende ${id.slice(0, 8)}` });
    }
  }

  const approvals = await listPendingWfmApprovals(tenantId, actorRoleKey);
  const openRequestsCount = approvals.ok
    ? approvals.data.filter((a) => a.approvalType === 'vacation' || a.approvalType === 'absence').length
    : 0;

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
    if (dateCmp !== 0) return dateCmp;
    return (b.plannedStartAt ?? b.actualStartAt ?? '').localeCompare(
      a.plannedStartAt ?? a.actualStartAt ?? '',
    );
  });

  return {
    ok: true,
    data: {
      period,
      kpis: computeKpis(
        filtered,
        openRequestsCount,
        visiblePlannedVisits.length,
        visibleAbsentEmployeeIds,
      ),
      entries: filtered,
      employees: visibleEmployees,
    },
  };
}

export async function adoptWfmAssignmentActualToBooking(
  tenantId: string,
  actorId: string,
  actorRoleKey: RoleKey | null,
  entryId: string,
  reason: string,
): Promise<ServiceResult<WfmOfficeTimeEntry>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.correct');
  if (denied) return denied;
  if (!reason.trim()) {
    return { ok: false, error: 'Übernahme aus Einsatz ohne Begründung ist nicht erlaubt.' };
  }

  const overview = await getWfmOfficeTimeOverview(tenantId, actorRoleKey, { preset: 'last_30_days' });
  if (!overview.ok) return overview;
  const entry = overview.data.entries.find((e) => e.id === entryId);
  if (!entry) return { ok: false, error: 'Eintrag nicht gefunden.' };

  const display = (await import('./wfmOfficeTimeDisplayResolver')).resolveWfmOfficeTimeDisplay(entry);
  if (!display.hasAssignmentActual) {
    return { ok: false, error: 'Kein Einsatz-Ist für diesen Eintrag vorhanden.' };
  }
  if (entry.exportStatus === 'exported') {
    return {
      ok: false,
      error: 'Exportierter Eintrag — Übernahme nur über P2.3 Re-Export-Flow.',
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

export async function applyWfmOfficeTimeCorrection(
  tenantId: string,
  actorId: string,
  actorRoleKey: RoleKey | null,
  input: WfmOfficeCorrectionInput,
  entryContext?: WfmOfficeTimeEntry | null,
): Promise<ServiceResult<WfmOfficeTimeEntry>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.correct');
  if (denied) return denied;

  if (!input.reason.trim()) {
    return { ok: false, error: 'Korrektur ohne Begründung ist nicht erlaubt.' };
  }

  const overlay = getEntryOverlay(input.entryId) ?? {};
  const existing = getManualEntry(input.entryId);
  const currentStatus = overlay.reviewStatus ?? existing?.reviewStatus ?? 'open';

  if (TERMINAL_STATUSES.has(currentStatus)) {
    return {
      ok: false,
      error: 'Exportierte oder gesperrte Einträge können nur mit besonderer Korrektur geändert werden.',
    };
  }

  if (input.actualStartAt && input.actualEndAt) {
    if (new Date(input.actualEndAt) <= new Date(input.actualStartAt)) {
      return { ok: false, error: 'Endzeit muss nach Startzeit liegen.' };
    }
  }

  const patch: Partial<WfmOfficeTimeEntry> = {
    ...overlay,
    source: 'correction',
    workKind: input.workKind ?? overlay.workKind,
  };
  if (input.actualStartAt !== undefined) patch.actualStartAt = input.actualStartAt;
  if (input.actualEndAt !== undefined) patch.actualEndAt = input.actualEndAt;
  if (input.pauseMinutes !== undefined) patch.pauseMinutes = input.pauseMinutes ?? 0;
  setEntryOverlay(input.entryId, patch);

  const reviewCtx = await resolveReviewContextForEntry(tenantId, input.entryId, entryContext);
  const nextReviewStatus: WfmTimeReviewStatus = input.status
    ? (input.status as WfmTimeReviewStatus)
    : 'corrected';
  const reviewResult = await transitionReviewStatus(tenantId, actorId, {
    entryId: input.entryId,
    employeeId: existing?.employeeId ?? reviewCtx.employeeId,
    workDate: existing?.workDate ?? reviewCtx.workDate,
    entryKind: reviewCtx.entryKind,
    rawReferenceId: reviewCtx.rawReferenceId,
    nextStatus: nextReviewStatus,
    reviewNote: input.reason,
    officeComment: input.reason,
    actorId,
    actionComment: input.reason,
  });
  if (!reviewResult.ok) return reviewResult;

  await writeWfmOfficeAudit(tenantId, actorRoleKey, {
    entityType: 'wfm_office_time_entry',
    entityId: input.entryId,
    action: 'correction',
    actorId,
    summary: `Office-Korrektur für Eintrag ${input.entryId}`,
    reason: input.reason,
    source: 'office',
    field: 'multiple',
    metadata: { patch },
  });

  const overview = await getWfmOfficeTimeOverview(tenantId, actorRoleKey, { preset: 'last_30_days' });
  const entry = overview.ok ? overview.data.entries.find((e) => e.id === input.entryId) : null;
  if (entry) return { ok: true, data: { ...entry, ...patch, id: input.entryId } as WfmOfficeTimeEntry };

  return {
    ok: true,
    data: {
      id: input.entryId,
      tenantId,
      employeeId: existing?.employeeId ?? 'unknown',
      employeeName: existing?.employeeName ?? '—',
      workDate: existing?.workDate ?? todayWorkDate(),
      assignmentId: null,
      visitId: null,
      clientLabel: null,
      plannedStartAt: null,
      plannedEndAt: null,
      actualStartAt: patch.actualStartAt ?? null,
      actualEndAt: patch.actualEndAt ?? null,
      startDeviationMinutes: null,
      endDeviationMinutes: null,
      startAmpel: null,
      endAmpel: null,
      overallAmpel: null,
      startJustification: null,
      endJustification: null,
      startJustificationAt: null,
      endJustificationAt: null,
      pauseMinutes: patch.pauseMinutes ?? 0,
      grossMinutes: 0,
      netMinutes: 0,
      travelMinutes: null,
      workKind: patch.workKind ?? 'korrektur',
      status: 'corrected',
      source: 'correction',
      reviewStatus: 'corrected',
      exportStatus: 'not_exported',
      sessionId: null,
      officeComment: null,
      hasOpenOfficeMessage: false,
      flags: [],
    },
  };
}

export async function createWfmOfficeManualEntry(
  tenantId: string,
  actorId: string,
  actorRoleKey: RoleKey | null,
  input: WfmOfficeManualEntryInput,
): Promise<ServiceResult<WfmOfficeTimeEntry>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.correct');
  if (denied) return denied;

  if (!input.reason.trim()) {
    return { ok: false, error: 'Nachtrag ohne Begründung ist nicht erlaubt.' };
  }
  if (new Date(input.actualEndAt) <= new Date(input.actualStartAt)) {
    return { ok: false, error: 'Endzeit muss nach Startzeit liegen.' };
  }

  const profiles = await fetchEmployeeProfiles(tenantId, [input.employeeId]);
  const profile = profiles.get(input.employeeId);
  const grossMinutes = minutesBetween(input.actualStartAt, input.actualEndAt);
  const netMinutes = Math.max(0, grossMinutes - input.pauseMinutes);
  const id = createEntryId();

  const entry: WfmOfficeTimeEntry = {
    id,
    tenantId,
    employeeId: input.employeeId,
    employeeName: profile?.name ?? `Mitarbeitende ${input.employeeId.slice(0, 8)}`,
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

  saveManualEntry(entry);

  const reviewResult = await upsertReview(tenantId, actorId, {
    entryId: id,
    employeeId: input.employeeId,
    workDate: input.workDate,
    entryKind: 'manual',
    nextStatus: 'pending_review',
    reviewNote: input.reason,
    officeComment: input.reason,
    actorId,
    actionComment: 'Synthetic manual entry pending review',
  });
  if (!reviewResult.ok) return reviewResult;

  await writeWfmOfficeAudit(tenantId, actorRoleKey, {
    entityType: 'wfm_office_time_entry',
    entityId: id,
    action: 'manual_addition',
    actorId,
    summary: `Office-Nachtrag für ${entry.employeeName} am ${input.workDate}`,
    reason: input.reason,
    source: 'office',
  });

  return { ok: true, data: entry };
}

export async function reviewWfmOfficeTimeEntry(
  tenantId: string,
  actorId: string,
  actorRoleKey: RoleKey | null,
  entryId: string,
  decision: 'approved' | 'rejected' | 'exported' | 'locked' | 'open' | 'needs_clarification',
  reviewNote?: string,
  entryContext?: WfmOfficeTimeEntry | null,
): Promise<ServiceResult<WfmOfficeTimeEntry>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.correct');
  if (denied) return denied;

  if (decision === 'rejected' && !reviewNote?.trim()) {
    return { ok: false, error: 'Ablehnung ohne Grund ist nicht erlaubt.' };
  }
  if (decision === 'needs_clarification' && !reviewNote?.trim()) {
    return { ok: false, error: 'Rückfrage ohne Nachricht ist nicht erlaubt.' };
  }

  const overlay = getEntryOverlay(entryId) ?? {};
  const existing = getManualEntry(entryId);
  const reviewCtx = await resolveReviewContextForEntry(tenantId, entryId, entryContext);
  const currentStatus =
    overlay.reviewStatus ?? existing?.reviewStatus ?? ('open' as WfmOfficeTimeEntryStatus);

  if (TERMINAL_STATUSES.has(currentStatus) && decision !== 'open') {
    return { ok: false, error: 'Exportierter oder gesperrter Eintrag — Warnung: besondere Korrektur nötig.' };
  }

  const nextStatus = mapUiReviewDecisionToDb(decision);
  const reviewResult = await transitionReviewStatus(tenantId, actorId, {
    entryId,
    employeeId: existing?.employeeId ?? reviewCtx.employeeId,
    workDate: existing?.workDate ?? reviewCtx.workDate,
    entryKind: reviewCtx.entryKind,
    rawReferenceId: reviewCtx.rawReferenceId,
    nextStatus,
    reviewNote: reviewNote ?? null,
    officeComment: reviewNote ?? null,
    actorId,
    actionComment: reviewNote ?? null,
  });
  if (!reviewResult.ok) return reviewResult;

  const uiStatus = mapDbReviewStatusToUi(reviewResult.data.reviewStatus);
  const exportStatus =
    decision === 'exported'
      ? 'exported'
      : decision === 'approved'
        ? 'export_ready'
        : overlay.exportStatus ?? existing?.exportStatus ?? 'not_exported';

  const patch: Partial<WfmOfficeTimeEntry> = {
    ...overlay,
    reviewStatus: uiStatus,
    status: uiStatus,
    exportStatus,
    officeComment: reviewNote ?? overlay.officeComment ?? null,
  };
  if (decision === 'exported') {
    setEntryOverlay(entryId, { exportStatus: 'exported' });
  }
  if (existing) saveManualEntry({ ...existing, ...patch, id: entryId });

  await writeWfmOfficeAudit(tenantId, actorRoleKey, {
    entityType: 'wfm_office_time_entry',
    entityId: entryId,
    action: `review_${decision}`,
    actorId,
    summary: `Prüfstatus ${uiStatus} für Eintrag ${entryId}`,
    reason: reviewNote ?? null,
    source: 'office',
  });

  const merged: WfmOfficeTimeEntry = {
    ...(existing ?? {
      id: entryId,
      tenantId,
      employeeId: reviewCtx.employeeId,
      employeeName: '—',
      workDate: reviewCtx.workDate,
      assignmentId: null,
      visitId: null,
      clientLabel: null,
      plannedStartAt: null,
      plannedEndAt: null,
      actualStartAt: null,
      actualEndAt: null,
      startDeviationMinutes: null,
      endDeviationMinutes: null,
      startAmpel: null,
      endAmpel: null,
      overallAmpel: null,
      startJustification: null,
      endJustification: null,
      startJustificationAt: null,
      endJustificationAt: null,
      pauseMinutes: 0,
      grossMinutes: 0,
      netMinutes: 0,
      travelMinutes: null,
      workKind: 'sonstige',
      status: uiStatus,
      source: 'office',
      reviewStatus: uiStatus,
      exportStatus: 'not_exported',
      sessionId: null,
      officeComment: null,
      hasOpenOfficeMessage: false,
      flags: [],
    }),
    ...patch,
    id: entryId,
    reviewStatus: uiStatus,
    status: uiStatus,
    exportStatus,
  };

  return { ok: true, data: merged };
}

export async function submitVisitDeviationJustification(
  tenantId: string,
  employeeId: string,
  actorId: string,
  input: {
    visitId: string;
    assignmentId?: string | null;
    clientLabel?: string | null;
    phase: WfmDeviationPhase;
    plannedAt: string;
    actualAt: string;
    justification: string;
    entryId?: string | null;
  },
): Promise<ServiceResult<{ allowed: boolean; message?: WfmOfficeMessage }>> {
  const validationError = validateDeviationJustification(input.justification);
  if (validationError) return { ok: false, error: validationError };

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
  } else {
    patch.endJustification = input.justification.trim();
    patch.endAmpel = evaluation.ampel;
    patch.actualEndAt = input.actualAt;
  }
  setEntryOverlay(entryId, patch);

  if (evaluation.ampel === 'red' || evaluation.ampel === 'blue') {
    const workDate = workDateFromIso(input.actualAt);
    await upsertReview(tenantId, actorId, {
      entryId,
      employeeId,
      workDate,
      entryKind: 'visit',
      nextStatus: 'pending_review',
      reviewNote: input.justification.trim(),
      actorId,
      actionComment: 'Deviation justification submitted',
    });
  }

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

  await writeWfmOfficeAudit(tenantId, null, {
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

  return { ok: true, data: { allowed: true, message } };
}

export function checkVisitDeviationGate(
  tenantId: string,
  employeeId: string,
  visitId: string,
  phase: WfmDeviationPhase,
  plannedAt: string | null | undefined,
  actualAt: string | null | undefined,
): { blocked: boolean; evaluation: ReturnType<typeof evaluateVisitTimeDeviation>; needsJustification: boolean } {
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

export async function getWfmOfficeExportWarnings(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  preset: WfmOfficePeriodPreset,
  fromDate?: string,
  toDate?: string,
): Promise<ServiceResult<{ warnings: string[]; approvedCount: number; totalCount: number }>> {
  const warnings: string[] = [];
  const period = resolveOfficeTimePeriod(preset, fromDate, toDate);
  const manualPending = listManualEntries(tenantId).filter(
    (e) =>
      e.workDate >= period.fromDate &&
      e.workDate <= period.toDate &&
      (e.reviewStatus === 'pending_review' || e.reviewStatus === 'open'),
  );
  if (manualPending.length) {
    warnings.push(`${manualPending.length} offene/ungeprüfte Nachträge im Zeitraum.`);
  }

  const overview = await getWfmOfficeTimeOverview(tenantId, actorRoleKey, { preset, fromDate, toDate });
  if (!overview.ok) return overview;

  const pending = overview.data.entries.filter((e) => isOpenReviewStatus(e.reviewStatus));
  const rotBlau = overview.data.entries.filter(
    (e) => (e.overallAmpel === 'red' || e.overallAmpel === 'blue') && e.reviewStatus !== 'approved',
  );
  if (pending.length) warnings.push(`${pending.length} offene/ungeprüfte Einträge im Zeitraum.`);
  if (rotBlau.length) warnings.push(`${rotBlau.length} Rot/Blau-Abweichungen noch nicht freigegeben.`);

  const approvedCount = overview.data.entries.filter((e) => e.reviewStatus === 'approved').length;
  return {
    ok: true,
    data: {
      warnings,
      approvedCount,
      totalCount: overview.data.entries.length + manualPending.length,
    },
  };
}

export { updateOfficeMessageReview, listOfficeMessages };
