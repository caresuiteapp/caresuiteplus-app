import type { RoleKey, ServiceResult } from '@/types';
import type {
  AmpelEvaluation,
  StartWorkdayInput,
  SwitchActivityInput,
  TimeEntry,
  TimeWorkday,
  TrafficLight,
} from '@/types/modules/timeTracking';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { writeTimeAuditLog } from './timeTrackingAuditService';
import { ensureTimeTrackingSettings } from './timeTrackingSettingsService';
import {
  clearActiveSession,
  findActiveWorkday,
  findWorkdayByDate,
  getActiveSession,
  getEntry,
  getWorkday,
  listActivityEvents,
  listEntriesForWorkday,
  listInactivityChecks,
  listWarnings,
  listWorkdays,
  nextTimeTrackingId,
  saveEntry,
  saveWorkday,
  setActiveSession,
} from './timeTrackingStore';
import { recordTimeActivityEvent } from './timeTrackingActivityBridge';
import { evaluateTrafficLight } from './timeTrackingAmpelService';
import { detectMultiTabConflict, registerActiveSession } from './timeTrackingMultiTabService';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000));
}

function closeEntry(entry: TimeEntry, endedAt: string): TimeEntry {
  const pauseMinutes =
    entry.pauseStartedAt && entry.status === 'paused'
      ? minutesBetween(entry.pauseStartedAt, endedAt)
      : 0;
  const gross =
    entry.startedAt && !entry.isUnclear
      ? minutesBetween(entry.startedAt, endedAt) - pauseMinutes
      : entry.netMinutes ?? 0;
  return {
    ...entry,
    status: 'closed',
    endedAt,
    pauseStartedAt: null,
    netMinutes: Math.max(0, gross),
    updatedAt: endedAt,
  };
}

export function getCurrentWorkdayStatus(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
): ServiceResult<{ workday: TimeWorkday | null; entries: TimeEntry[]; multiTabConflict: boolean }> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const workday = findActiveWorkday(tenantId, userId) ?? findWorkdayByDate(tenantId, userId, todayDate());
  const entries = workday ? listEntriesForWorkday(workday.id) : [];
  const sessionCheck = detectMultiTabConflict(tenantId, userId, getActiveSession(tenantId, userId));

  return {
    ok: true,
    data: {
      workday,
      entries,
      multiTabConflict: sessionCheck.conflict,
    },
  };
}

export function startWorkday(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  input: StartWorkdayInput,
): ServiceResult<{ workday: TimeWorkday; entry: TimeEntry }> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.start');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const settingsResult = ensureTimeTrackingSettings(tenantId, actorRoleKey);
  if (!settingsResult.ok) return settingsResult;
  const settings = settingsResult.data;

  if (!settings.moduleEnabled) {
    return { ok: false, error: 'Arbeitszeitmodul ist für diesen Mandanten deaktiviert.' };
  }

  const existing = findActiveWorkday(tenantId, userId);
  if (existing) {
    return { ok: false, error: 'Es läuft bereits ein Arbeitstag. Bitte zuerst abschließen oder fortsetzen.' };
  }

  if (settings.requirePrivacyConsent && !input.privacyConsentAccepted) {
    return { ok: false, error: 'Bitte bestätigen Sie die Datenschutzhinweise zur Aktivitätserfassung.' };
  }

  const sessionId = input.sessionId ?? nextTimeTrackingId('sess');
  const tabConflict = registerActiveSession(tenantId, userId, sessionId);
  if (tabConflict.conflict) {
    return { ok: false, error: 'Arbeitszeit wird bereits in einem anderen Tab erfasst.' };
  }

  const now = new Date().toISOString();
  const workDate = todayDate();
  let workday = findWorkdayByDate(tenantId, userId, workDate);
  if (!workday) {
    workday = {
      id: nextTimeTrackingId('wd'),
      tenantId,
      userId,
      employeeId: null,
      workDate,
      status: 'active',
      startedAt: now,
      endedAt: null,
      privacyConsentAt: input.privacyConsentAccepted ? now : null,
      activeSessionId: sessionId,
      closureNote: null,
      trafficLight: null,
      createdAt: now,
      updatedAt: now,
    };
  } else {
    workday = {
      ...workday,
      status: 'active',
      startedAt: workday.startedAt ?? now,
      activeSessionId: sessionId,
      privacyConsentAt: workday.privacyConsentAt ?? (input.privacyConsentAccepted ? now : null),
      updatedAt: now,
    };
  }
  saveWorkday(workday);
  setActiveSession(tenantId, userId, sessionId);

  const entry: TimeEntry = {
    id: nextTimeTrackingId('te'),
    tenantId,
    workdayId: workday.id,
    userId,
    activityTypeId: input.activityTypeId,
    organizationId: input.organizationId ?? null,
    costCenterId: input.costCenterId ?? null,
    projectId: input.projectId ?? null,
    blockIndex: listEntriesForWorkday(workday.id).length + 1,
    status: 'active',
    startedAt: now,
    endedAt: null,
    pauseStartedAt: null,
    netMinutes: null,
    note: null,
    isUnclear: false,
    createdAt: now,
    updatedAt: now,
  };
  saveEntry(entry);

  recordTimeActivityEvent({
    tenantId,
    userId,
    workdayId: workday.id,
    eventType: 'workday_start',
    moduleKey: 'time_tracking',
    resourceId: workday.id,
  });

  writeTimeAuditLog({
    tenantId,
    workdayId: workday.id,
    entityType: 'time_workday',
    entityId: workday.id,
    action: 'start',
    actorId: userId,
    summary: 'Arbeitstag gestartet',
  });

  return { ok: true, data: { workday, entry } };
}

export function pauseWorkday(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
): ServiceResult<TimeWorkday> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.pause');
  if (denied) return denied;

  const workday = findActiveWorkday(tenantId, userId);
  if (!workday || workday.status !== 'active') {
    return { ok: false, error: 'Kein aktiver Arbeitstag zum Pausieren.' };
  }

  const now = new Date().toISOString();
  const activeEntry = listEntriesForWorkday(workday.id).find((e) => e.status === 'active');
  if (activeEntry) {
    saveEntry({ ...activeEntry, status: 'paused', pauseStartedAt: now, updatedAt: now });
  }

  const updated: TimeWorkday = { ...workday, status: 'paused', updatedAt: now };
  saveWorkday(updated);

  recordTimeActivityEvent({
    tenantId,
    userId,
    workdayId: workday.id,
    eventType: 'workday_pause',
    moduleKey: 'time_tracking',
    resourceId: workday.id,
  });

  writeTimeAuditLog({
    tenantId,
    workdayId: workday.id,
    entityType: 'time_workday',
    entityId: workday.id,
    action: 'pause',
    actorId: userId,
    summary: 'Arbeitstag pausiert',
  });

  return { ok: true, data: updated };
}

export function resumeWorkday(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
): ServiceResult<TimeWorkday> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.resume');
  if (denied) return denied;

  const workday = findActiveWorkday(tenantId, userId);
  if (!workday || workday.status !== 'paused') {
    return { ok: false, error: 'Kein pausierter Arbeitstag zum Fortsetzen.' };
  }

  const now = new Date().toISOString();
  const pausedEntry = listEntriesForWorkday(workday.id).find((e) => e.status === 'paused');
  if (pausedEntry) {
    saveEntry({ ...pausedEntry, status: 'active', pauseStartedAt: null, updatedAt: now });
  }

  const updated: TimeWorkday = { ...workday, status: 'active', updatedAt: now };
  saveWorkday(updated);

  recordTimeActivityEvent({
    tenantId,
    userId,
    workdayId: workday.id,
    eventType: 'workday_resume',
    moduleKey: 'time_tracking',
    resourceId: workday.id,
  });

  writeTimeAuditLog({
    tenantId,
    workdayId: workday.id,
    entityType: 'time_workday',
    entityId: workday.id,
    action: 'resume',
    actorId: userId,
    summary: 'Arbeitstag fortgesetzt',
  });

  return { ok: true, data: updated };
}

export function switchActivity(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  input: SwitchActivityInput,
): ServiceResult<{ workday: TimeWorkday; entry: TimeEntry }> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.switch');
  if (denied) return denied;

  const workday = findActiveWorkday(tenantId, userId);
  if (!workday) {
    return { ok: false, error: 'Kein laufender Arbeitstag für Tätigkeitswechsel.' };
  }

  const now = new Date().toISOString();
  const entries = listEntriesForWorkday(workday.id);
  const current = entries.find((e) => e.status === 'active' || e.status === 'paused');
  if (current) {
    saveEntry(closeEntry(current, now));
  }

  const newEntry: TimeEntry = {
    id: nextTimeTrackingId('te'),
    tenantId,
    workdayId: workday.id,
    userId,
    activityTypeId: input.activityTypeId,
    organizationId: input.organizationId ?? null,
    costCenterId: input.costCenterId ?? null,
    projectId: input.projectId ?? null,
    blockIndex: entries.length + 1,
    status: 'active',
    startedAt: now,
    endedAt: null,
    pauseStartedAt: null,
    netMinutes: null,
    note: input.note ?? null,
    isUnclear: false,
    createdAt: now,
    updatedAt: now,
  };
  saveEntry(newEntry);

  const updatedWorkday: TimeWorkday = { ...workday, status: 'active', updatedAt: now };
  saveWorkday(updatedWorkday);

  recordTimeActivityEvent({
    tenantId,
    userId,
    workdayId: workday.id,
    eventType: 'activity_switch',
    moduleKey: 'time_tracking',
    resourceId: newEntry.id,
    metadata: { activityTypeId: input.activityTypeId },
  });

  writeTimeAuditLog({
    tenantId,
    workdayId: workday.id,
    entityType: 'time_entry',
    entityId: newEntry.id,
    action: 'switch',
    actorId: userId,
    summary: 'Tätigkeit / Zuordnung gewechselt',
  });

  return { ok: true, data: { workday: updatedWorkday, entry: newEntry } };
}

export function closeWorkday(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  closureNote?: string,
): ServiceResult<{ workday: TimeWorkday; ampel: AmpelEvaluation }> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.close');
  if (denied) return denied;

  const workday = findActiveWorkday(tenantId, userId) ?? findWorkdayByDate(tenantId, userId, todayDate());
  if (!workday) {
    return { ok: false, error: 'Kein Arbeitstag zum Abschließen.' };
  }

  const now = new Date().toISOString();
  for (const entry of listEntriesForWorkday(workday.id)) {
    if (entry.status === 'active' || entry.status === 'paused') {
      saveEntry(closeEntry(entry, now));
    }
  }

  const ampel = evaluateTrafficLight({
    workdayId: workday.id,
    tenantId,
    activityEvents: listActivityEvents(workday.id),
    inactivityChecks: listInactivityChecks(workday.id),
    entries: listEntriesForWorkday(workday.id),
    warnings: listWarnings(workday.id),
  });

  const updated: TimeWorkday = {
    ...workday,
    status: 'closed',
    endedAt: now,
    closureNote: closureNote ?? null,
    trafficLight: ampel.trafficLight,
    activeSessionId: null,
    updatedAt: now,
  };
  saveWorkday(updated);
  clearActiveSession(tenantId, userId);

  recordTimeActivityEvent({
    tenantId,
    userId,
    workdayId: workday.id,
    eventType: 'workday_close',
    moduleKey: 'time_tracking',
    resourceId: workday.id,
  });

  writeTimeAuditLog({
    tenantId,
    workdayId: workday.id,
    entityType: 'time_workday',
    entityId: workday.id,
    action: 'close',
    actorId: userId,
    summary: 'Arbeitstag abgeschlossen',
    metadata: { trafficLight: ampel.trafficLight },
  });

  return { ok: true, data: { workday: updated, ampel } };
}

export function listTeamWorkdays(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): ServiceResult<TimeWorkday[]> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
  if (denied) return denied;
  return { ok: true, data: listWorkdays(tenantId) };
}

export function markEntryUnclear(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  entryId: string,
): ServiceResult<TimeEntry> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;

  const entry = getEntry(entryId);
  if (!entry || entry.tenantId !== tenantId || entry.userId !== userId) {
    return { ok: false, error: 'Zeitblock nicht gefunden.' };
  }

  const updated: TimeEntry = { ...entry, isUnclear: true, updatedAt: new Date().toISOString() };
  saveEntry(updated);
  return { ok: true, data: updated };
}

export function getWorkdayById(
  tenantId: string,
  workdayId: string,
  actorRoleKey: RoleKey | null,
  actorUserId: string,
): ServiceResult<{ workday: TimeWorkday; entries: TimeEntry[] }> {
  const workday = getWorkday(workdayId);
  if (!workday || workday.tenantId !== tenantId) {
    return { ok: false, error: 'Arbeitstag nicht gefunden.' };
  }

  const isOwn = workday.userId === actorUserId;
  if (!isOwn) {
    const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
    if (denied) return denied;
  } else {
    const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
    if (denied) return denied;
  }

  return {
    ok: true,
    data: { workday, entries: listEntriesForWorkday(workdayId) },
  };
}

export function computeDayTrafficLight(workdayId: string, tenantId: string): TrafficLight {
  return evaluateTrafficLight({
    workdayId,
    tenantId,
    activityEvents: listActivityEvents(workdayId),
    inactivityChecks: listInactivityChecks(workdayId),
    entries: listEntriesForWorkday(workdayId),
    warnings: listWarnings(workdayId),
  }).trafficLight;
}
