import type { ServiceResult } from '@/types';

/** A planning write may succeed before a required projection or series member fails. */
export type VisitPlanningResult<T> = ServiceResult<T> & {
  persistedVisitId?: string;
};

export function visitPlanningFollowUpFailure<T>(id: string, cause: unknown): VisitPlanningResult<T> {
  const message = typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : 'Folgeschritt fehlgeschlagen.';
  return {
    ok: false,
    persistedVisitId: id,
    error: `Einsatz wurde gespeichert, aber noch nicht vollständig abgeglichen: ${message} Bitte den gespeicherten Einsatz prüfen, bevor Sie erneut speichern.`,
  };
}
