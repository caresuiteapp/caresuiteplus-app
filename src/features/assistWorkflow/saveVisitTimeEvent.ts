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
  metadata?: Record<string, unknown>;
};

export async function saveVisitTimeEvent(
  input: SaveVisitTimeEventInput,
): Promise<ServiceResult<{ id: string }>> {
  if (getServiceMode() !== 'supabase') {
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

  return recorded;
}

/** Idempotent backfill — skips when event type already exists for visit. */
export async function ensureVisitTimeEvent(
  input: SaveVisitTimeEventInput,
  existingEvents: Array<{ eventType: string }>,
): Promise<ServiceResult<{ id: string; created: boolean }>> {
  if (existingEvents.some((e) => e.eventType === input.eventType)) {
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
