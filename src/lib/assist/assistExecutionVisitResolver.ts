import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { getServiceMode } from '@/lib/services/mode';
import { isUuid } from '@/lib/validation/uuid';

/** Resolve assist_visits.id from visit or legacy assignment id — Supabase only. */
export async function resolveAssistVisitIdForPersistence(
  tenantId: string,
  assignmentOrVisitId: string,
): Promise<string | null> {
  if (getServiceMode() !== 'supabase' || !isUuid(assignmentOrVisitId)) return null;
  return visitSupabaseRepository.resolveVisitId(tenantId, assignmentOrVisitId);
}
