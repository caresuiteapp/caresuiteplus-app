/**
 * ASSIST.WORKFLOW.2 — Persist a single assist_time_events row (Supabase source of truth).
 */
import type { ServiceResult } from '@/types';
import { recordTimeEvent } from '@/lib/assist/assistTrackingPersistenceService';
import { getServiceMode } from '@/lib/services/mode';
import { syncAssistTimeEventToWfmPortalSafe } from '@/lib/wfm/wfmAssistAdapter';
import { scheduleDeferredTask } from '@/lib/async/deferredTask';
import {
  assistWorkflowErrorFromSupabase,
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type VisitTimeEventType =
  | 'drive_start'
  | 'drive_end'
  | 'arrive'
  | 'service_start'
  | 'service_end'
  | 'pause_start'
  | 'pause_end'
  | 'depart';

export type SaveVisitTimeEventInput = {
  tenantId: string;
  visitId: string;
  sessionId?: string | null;
  eventType: VisitTimeEventType;
  occurredAt?: string;
  recordedBy?: string | null;
  employeeId?: string | null;
  profileId?: string | null;
  metadata?: Record<string, unknown>;
};

async function mirrorAssistEventToWfm(input: SaveVisitTimeEventInput): Promise<ServiceResult<void>> {
  if (!input.employeeId && !input.profileId) return { ok: true, data: undefined };

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const wfmUserId =
    input.profileId ??
    (input.recordedBy && input.recordedBy !== input.employeeId ? input.recordedBy : null);
  const syncResult = await syncAssistTimeEventToWfmPortalSafe(
    input.tenantId,
    input.employeeId ?? null,
    wfmUserId,
    input.visitId,
    input.eventType,
    occurredAt,
  );
  if (!syncResult.ok) {
    return {
      ok: false,
      error:
        syncResult.error ??
        'Zeitereignis wurde gespeichert, aber die Arbeitszeiterfassung konnte nicht aktualisiert werden.',
    };
  }
  return { ok: true, data: undefined };
}

function scheduleWfmMirror(input: SaveVisitTimeEventInput): void {
  scheduleDeferredTask(
    `assist-time-wfm:${input.tenantId}:${input.visitId}`,
    async () => {
      const mirrored = await mirrorAssistEventToWfm(input);
      if (!mirrored.ok) throw new Error(mirrored.error);
    },
  );
}

export async function saveVisitTimeEvent(
  input: SaveVisitTimeEventInput,
): Promise<ServiceResult<{ id: string }>> {
  if (getServiceMode() !== 'supabase') {
    scheduleWfmMirror(input);
    return { ok: true, data: { id: 'demo' } };
  }

  const recorded = await recordTimeEvent(
    input.tenantId,
    {
      visitId: input.visitId,
      sessionId: input.sessionId ?? null,
      eventType: input.eventType,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      metadata: input.metadata,
    },
    input.recordedBy ?? null,
  );

  if (!recorded.ok) {
    return assistWorkflowErrorToResult(
      assistWorkflowErrorFromSupabase(
        { message: recorded.error },
        {
          tenantId: input.tenantId,
          assistVisitId: input.visitId,
          operation: `saveVisitTimeEvent.${input.eventType}`,
        },
      ),
    );
  }

  // assist_time_events is the authoritative employee record. WFM is a
  // projection and must never hold a mobile button for tens of seconds.
  // The full-visit RPC is idempotent and is scheduled again by every later
  // event, so a temporary failure repairs itself automatically.
  scheduleWfmMirror(input);

  return recorded;
}

/** Idempotent backfill — skips when event type already exists for visit. */
export async function ensureVisitTimeEvent(
  input: SaveVisitTimeEventInput,
  existingEvents: { eventType: string; occurredAt?: string }[],
): Promise<ServiceResult<{ id: string; created: boolean }>> {
  const eventTime = (event: { occurredAt?: string }, index: number): number =>
    event.occurredAt ? new Date(event.occurredAt).getTime() : index;
  const latestIndex = (types: VisitTimeEventType[]): number =>
    existingEvents.reduce(
      (latest, event, index) =>
        types.includes(event.eventType as VisitTimeEventType) &&
        eventTime(event, index) > latest
          ? eventTime(event, index)
          : latest,
      Number.NEGATIVE_INFINITY,
    );

  const latestDriveStart = latestIndex(['drive_start']);
  const latestDriveEnd = latestIndex(['drive_end', 'arrive']);
  const latestServiceStart = latestIndex(['service_start']);
  const latestServiceEnd = latestIndex(['service_end']);

  const alreadyPersisted =
    input.eventType === 'drive_start'
      ? latestDriveStart > latestDriveEnd
      : input.eventType === 'arrive' || input.eventType === 'drive_end'
        ? latestDriveStart > Number.NEGATIVE_INFINITY && latestDriveEnd >= latestDriveStart
        : input.eventType === 'service_start'
          ? latestServiceStart > latestServiceEnd
          : input.eventType === 'service_end'
            ? latestServiceStart > Number.NEGATIVE_INFINITY &&
              latestServiceEnd >= latestServiceStart
            : existingEvents.some((event) => event.eventType === input.eventType);

  if (alreadyPersisted) {
    scheduleWfmMirror(input);
    return { ok: true, data: { id: 'existing', created: false } };
  }

  const saved = await saveVisitTimeEvent(input);
  if (!saved.ok) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('WORKFLOW_TIME_EVENT_FAILED', {
        tenantId: input.tenantId,
        assistVisitId: input.visitId,
        operation: `ensureVisitTimeEvent.${input.eventType}`,
      }, saved.error ?? 'Zeit-Event konnte nicht gespeichert werden.'),
    );
  }

  return { ok: true, data: { id: saved.data.id, created: true } };
}

/** True when pause_start count exceeds pause_end (open pause segment). */
export function hasOpenPauseSegment(events: { eventType: string }[]): boolean {
  const starts = events.filter((e) => e.eventType === 'pause_start').length;
  const ends = events.filter((e) => e.eventType === 'pause_end').length;
  return starts > ends;
}

/** Idempotent — writes pause_start only when no open pause exists. */
export async function ensureOpenPauseStartEvent(
  input: Omit<SaveVisitTimeEventInput, 'eventType'>,
  existingEvents: { eventType: string }[],
): Promise<ServiceResult<{ id: string; created: boolean }>> {
  if (hasOpenPauseSegment(existingEvents)) {
    return { ok: true, data: { id: 'existing', created: false } };
  }
  return ensureVisitTimeEvent({ ...input, eventType: 'pause_start' }, []);
}

/** Idempotent — writes pause_end only when an open pause exists. */
export async function ensureOpenPauseEndEvent(
  input: Omit<SaveVisitTimeEventInput, 'eventType'>,
  existingEvents: { eventType: string }[],
): Promise<ServiceResult<{ id: string; created: boolean }>> {
  if (!hasOpenPauseSegment(existingEvents)) {
    return { ok: true, data: { id: 'existing', created: false } };
  }
  return ensureVisitTimeEvent({ ...input, eventType: 'pause_end' }, []);
}
