import type { RoleKey, ServiceResult } from '@/types';
import type { CorrectionRequestStatus, TimeCorrectionRequest, TimeEntry } from '@/types/modules/timeTracking';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { writeTimeAuditLog } from './timeTrackingAuditService';
import {
  getEntry,
  getWorkday,
  listCorrections,
  listEntriesForWorkday,
  nextTimeTrackingId,
  saveCorrection,
  saveEntry,
} from './timeTrackingStore';

export function requestTimeCorrection(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  input: {
    workdayId: string;
    timeEntryId?: string | null;
    reason: string;
    proposedStartedAt?: string | null;
    proposedEndedAt?: string | null;
    proposedActivityTypeId?: string | null;
  },
): ServiceResult<TimeCorrectionRequest> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;

  const workday = getWorkday(input.workdayId);
  if (!workday || workday.tenantId !== tenantId) {
    return { ok: false, error: 'Arbeitstag nicht gefunden.' };
  }

  const now = new Date().toISOString();
  const correction: TimeCorrectionRequest = {
    id: nextTimeTrackingId('cr'),
    tenantId,
    workdayId: input.workdayId,
    timeEntryId: input.timeEntryId ?? null,
    requestedBy: userId,
    status: 'pending',
    reason: input.reason,
    proposedStartedAt: input.proposedStartedAt ?? null,
    proposedEndedAt: input.proposedEndedAt ?? null,
    proposedActivityTypeId: input.proposedActivityTypeId ?? null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    counterEntryId: null,
    createdAt: now,
    updatedAt: now,
  };
  saveCorrection(correction);

  writeTimeAuditLog({
    tenantId,
    workdayId: input.workdayId,
    entityType: 'time_correction_request',
    entityId: correction.id,
    action: 'request',
    actorId: userId,
    summary: 'Korrekturanfrage eingereicht',
  });

  return { ok: true, data: correction };
}

export function reviewTimeCorrection(
  tenantId: string,
  reviewerId: string,
  actorRoleKey: RoleKey | null,
  correctionId: string,
  decision: 'approved' | 'rejected',
  reviewNote?: string,
): ServiceResult<TimeCorrectionRequest> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.correct');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const correction = listCorrections(tenantId).find((c) => c.id === correctionId);
  if (!correction) {
    return { ok: false, error: 'Korrekturanfrage nicht gefunden.' };
  }

  const now = new Date().toISOString();
  let counterEntryId = correction.counterEntryId;

  if (decision === 'approved' && correction.timeEntryId) {
    const original = getEntry(correction.timeEntryId);
    if (original) {
      const counterEntry = createCounterBooking(original, correction, now);
      saveEntry(counterEntry);
      counterEntryId = counterEntry.id;

      writeTimeAuditLog({
        tenantId,
        workdayId: correction.workdayId,
        entityType: 'time_entry',
        entityId: counterEntry.id,
        action: 'counter_booking',
        actorId: reviewerId,
        summary: 'Gegenbuchung für Korrektur erstellt (Original unverändert)',
        metadata: { originalEntryId: original.id },
      });
    }
  }

  const updated: TimeCorrectionRequest = {
    ...correction,
    status: decision as CorrectionRequestStatus,
    reviewedBy: reviewerId,
    reviewedAt: now,
    reviewNote: reviewNote ?? null,
    counterEntryId,
    updatedAt: now,
  };
  saveCorrection(updated);

  writeTimeAuditLog({
    tenantId,
    workdayId: correction.workdayId,
    entityType: 'time_correction_request',
    entityId: correction.id,
    action: decision,
    actorId: reviewerId,
    summary: decision === 'approved' ? 'Korrektur genehmigt' : 'Korrektur abgelehnt',
  });

  return { ok: true, data: updated };
}

/** Gegenbuchung — negates/adjusts without overwriting the original entry. */
function createCounterBooking(
  original: TimeEntry,
  correction: TimeCorrectionRequest,
  now: string,
): TimeEntry {
  const entries = listEntriesForWorkday(original.workdayId);
  return {
    id: nextTimeTrackingId('te'),
    tenantId: original.tenantId,
    workdayId: original.workdayId,
    userId: original.userId,
    activityTypeId: correction.proposedActivityTypeId ?? original.activityTypeId,
    organizationId: original.organizationId,
    costCenterId: original.costCenterId,
    projectId: original.projectId,
    blockIndex: entries.length + 1,
    status: 'closed',
    startedAt: correction.proposedStartedAt ?? original.startedAt,
    endedAt: correction.proposedEndedAt ?? original.endedAt ?? now,
    pauseStartedAt: null,
    netMinutes: 0,
    note: `Gegenbuchung zu ${original.id}: ${correction.reason}`,
    isUnclear: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function listTimeCorrectionRequests(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  status?: CorrectionRequestStatus,
): ServiceResult<TimeCorrectionRequest[]> {
  const deniedView = enforcePermission(actorRoleKey, 'time.tracking.admin.view');
  const deniedOwn = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (deniedView && deniedOwn) return deniedView;
  return { ok: true, data: listCorrections(tenantId, status) };
}
