/**
 * ASSIST.WORKFLOW.2 — Persist a single assist_time_events row (Supabase source of truth).
 */
import type { ServiceResult } from '@/types';
import { recordTimeEvent } from '@/lib/assist/assistTrackingPersistenceService';
import { getServiceMode } from '@/lib/services/mode';
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

async function mirrorAssistEventToWfm(input: SaveVisitTimeEventInput): Promise<void> {
  if (!input.employeeId && !input.profileId) return;

  const { syncAssistTimeEventToWfm } = await import('@/lib/wfm/wfmAssistAdapter');
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const wfmUserId =
    input.profileId ??
    (input.recordedBy && input.recordedBy !== input.employeeId ? input.recordedBy : null);
  const syncResult = await syncAssistTimeEventToWfm(
    input.tenantId,
    input.employeeId ?? null,
    wfmUserId,
    input.visitId,
    input.eventType,
    occurredAt,
  );
  if (!syncResult.ok && process.env.NODE_ENV !== 'production') {
    console.warn('[saveVisitTimeEvent] WFM-Sync fehlgeschlagen:', syncResult.error);
  }
}

export async function saveVisitTimeEvent(
  input: SaveVisitTimeEventInput,
): Promise<ServiceResult<{ id: string }>> {
  if (getServiceMode() !== 'supabase') {
    await mirrorAssistEventToWfm(input);
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

  await mirrorAssistEventToWfm(input);

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
    await mirrorAssistEventToWfm(input);
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
  input: SaveVisitTimeEventInput,
  existingEvents: { eventType: string }[],
): Promise<ServiceResult<{ id: string; created: boolean }>> {
  if (hasOpenPauseSegment(existingEvents)) {
    return { ok: true, data: { id: 'existing', created: false } };
  }
  return ensureVisitTimeEvent({ ...input, eventType: 'pause_start' }, []);
}

/** Idempotent — writes pause_end only when an open pause exists. */
export async function ensureOpenPauseEndEvent(
  input: SaveVisitTimeEventInput,
  existingEvents: { eventType: string }[],
): Promise<ServiceResult<{ id: string; created: boolean }>> {
  if (!hasOpenPauseSegment(existingEvents)) {
    return { ok: true, data: { id: 'existing', created: false } };
  }
  return ensureVisitTimeEvent({ ...input, eventType: 'pause_end' }, []);
}
