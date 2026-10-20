/**
 * Client portal — restricted visit live status (no GPS coordinates).
 * Reads assist_time_events only; never exposes location points.
 */

import type { AssistTimeEventType } from '@/types/assistExecutionPersistence';
import { resolveAssistVisitIdForPersistence } from '@/lib/assist/assistExecutionVisitResolver';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { getServiceMode } from '@/lib/services/mode';

const EVENT_LABELS: Partial<Record<AssistTimeEventType, string>> = {
  drive_start: 'Mitarbeitende:r ist unterwegs',
  arrive: 'Mitarbeitende:r ist angekommen',
  service_start: 'Einsatz läuft',
  service_end: 'Einsatz beendet',
  pause_start: 'Kurze Pause',
  pause_end: 'Einsatz fortgesetzt',
  depart: 'Abfahrt',
};

export type ClientPortalRestrictedLiveStatus = {
  visible: boolean;
  label: string | null;
  phase: AssistTimeEventType | null;
};

export async function fetchClientPortalRestrictedLiveStatus(
  tenantId: string,
  assignmentId: string,
): Promise<ClientPortalRestrictedLiveStatus> {
  if (getServiceMode() !== 'supabase') {
    return { visible: false, label: null, phase: null };
  }

  const visitId = await resolveAssistVisitIdForPersistence(tenantId, assignmentId);
  if (!visitId) return { visible: false, label: null, phase: null };

  const events = await fetchTimeEventsForVisit(tenantId, visitId, 20);
  if (!events.ok || events.data.length === 0) {
    return { visible: false, label: null, phase: null };
  }

  const latest = events.data[events.data.length - 1];
  const label = EVENT_LABELS[latest.eventType] ?? null;

  const terminal = new Set<AssistTimeEventType>(['service_end', 'depart', 'drive_end']);
  if (terminal.has(latest.eventType)) {
    return { visible: false, label: null, phase: null };
  }

  return {
    visible: Boolean(label),
    label,
    phase: latest.eventType,
  };
}
