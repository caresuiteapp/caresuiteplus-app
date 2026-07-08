/**
 * Resolves assignment execution timestamps from assignments row fields.
 * Prefers actual_start_at/actual_end_at; falls back to lifecycle timestamps.
 */
export type AssignmentActualSource = {
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  arrived_at?: string | null;
  finished_at?: string | null;
  on_the_way_at?: string | null;
};

export function resolveAssignmentActualTimes(source: AssignmentActualSource): {
  startAt: string | null;
  endAt: string | null;
} {
  const startAt = source.actual_start_at ?? source.arrived_at ?? source.on_the_way_at ?? null;
  const endAt = source.actual_end_at ?? source.finished_at ?? null;
  return { startAt, endAt };
}
