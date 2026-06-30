import { resolveLiveVisitId } from '@/features/liveTracking/resolveLiveAssignment';
import { getServiceMode } from '@/lib/services/mode';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { isUuid } from '@/lib/validation/uuid';

/** Resolve assist_visits.id from visit or legacy assignment id — Supabase only. */
export async function resolveAssistVisitIdForPersistence(
  tenantId: string,
  assignmentOrVisitId: string,
): Promise<string | null> {
  if (getServiceMode() !== 'supabase' || !isUuid(resolveVisitMasterId(assignmentOrVisitId))) return null;
  return resolveLiveVisitId(tenantId, resolveVisitMasterId(assignmentOrVisitId));
}
