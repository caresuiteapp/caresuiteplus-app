import type { AssistAssignmentTaskDraft } from '@/types/assistCatalog';
import type { ClientAssignmentProfileInput } from '@/types/modules/clientAssignmentProfile';

const MIN_PROFILE_DURATION_MINUTES = 15;
const MAX_PROFILE_DURATION_MINUTES = 720;

export function assignmentProfileEndAt(startAt: string, durationMinutes: number): string {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    throw new RangeError('Die Startzeit des Einsatzprofils ist ungültig.');
  }
  if (
    !Number.isInteger(durationMinutes)
    || durationMinutes < MIN_PROFILE_DURATION_MINUTES
    || durationMinutes > MAX_PROFILE_DURATION_MINUTES
  ) {
    throw new RangeError('Die Dauer des Einsatzprofils muss zwischen 15 und 720 Minuten liegen.');
  }
  return new Date(start.getTime() + durationMinutes * 60_000).toISOString();
}

/**
 * Aufgabenpakete liefern ausschließlich Aufgaben und deren Richtzeiten.
 * Die bereits festgelegte Gesamtdauer des Einsatzprofils bleibt die alleinige
 * Quelle für den Kalenderblock und darf hier niemals überschrieben werden.
 */
export function applyTaskPackageTasksToAssignmentProfile(
  current: ClientAssignmentProfileInput,
  packageId: string,
  taskDrafts: AssistAssignmentTaskDraft[],
): ClientAssignmentProfileInput {
  const copiedTaskDrafts = taskDrafts.map((task) => ({ ...task }));
  return {
    ...current,
    taskPackageId: packageId,
    taskDrafts: copiedTaskDrafts,
    taskTitles: copiedTaskDrafts.map((task) => task.title),
    durationMinutes: current.durationMinutes,
  };
}
