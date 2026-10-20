import type { TimeActivityEventType } from '@/types/modules/timeTracking';
import { findActiveWorkday, nextTimeTrackingId, saveActivityEvent } from './timeTrackingStore';

export type ActivityBridgeInput = {
  tenantId: string;
  userId: string;
  eventType: TimeActivityEventType;
  moduleKey?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  workdayId?: string | null;
};

let lastRecordedAt: string | null = null;

export function getLastActivityTimestamp(): string | null {
  return lastRecordedAt;
}

/** Records metadata-only activity signals — never content of inputs. */
export function recordTimeActivityEvent(input: ActivityBridgeInput): void {
  const workdayId =
    input.workdayId ?? findActiveWorkday(input.tenantId, input.userId)?.id ?? null;

  const now = new Date().toISOString();
  lastRecordedAt = now;

  saveActivityEvent({
    id: nextTimeTrackingId('ev'),
    tenantId: input.tenantId,
    workdayId,
    userId: input.userId,
    eventType: input.eventType,
    moduleKey: input.moduleKey ?? null,
    resourceId: input.resourceId ?? null,
    occurredAt: now,
    metadata: sanitizeMetadata(input.metadata ?? {}),
    createdAt: now,
  });
}

function sanitizeMetadata(
  metadata: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  const blocked = new Set(['content', 'text', 'body', 'value', 'input', 'password', 'screenshot']);
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.has(key.toLowerCase())) continue;
    if (typeof value === 'string' && value.length > 200) continue;
    clean[key] = value;
  }
  return clean;
}

export function recordNavigationActivity(
  tenantId: string,
  userId: string,
  route: string,
  moduleKey?: string,
): void {
  recordTimeActivityEvent({
    tenantId,
    userId,
    eventType: 'navigation',
    moduleKey: moduleKey ?? 'app',
    resourceId: route,
    metadata: { route },
  });
}

export function recordFormSaveActivity(
  tenantId: string,
  userId: string,
  formKey: string,
  moduleKey?: string,
): void {
  recordTimeActivityEvent({
    tenantId,
    userId,
    eventType: 'form_save',
    moduleKey: moduleKey ?? 'app',
    resourceId: formKey,
    metadata: { formKey },
  });
}

export function resetActivityBridgeState(): void {
  lastRecordedAt = null;
}
