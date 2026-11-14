import type { CarePlanEvaluationListItem } from '@/types/modules/pflege';
import { woundUuid } from './woundCareDomain';

export function qualityWorklistId(value: unknown): string | null | undefined {
  return value === undefined ? undefined : woundUuid(value) ? value.toLowerCase() : null;
}

const fold = (value: string) => value.toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
export function qualityWorklistMatch(term: string, fields: readonly string[]) {
  const haystack = fold(fields.join(' '));
  return fold(term).trim().split(/\s+/).every(word => haystack.includes(word));
}

export const evaluationOutcomeLabels: Record<CarePlanEvaluationListItem['outcome'], string> = {
  effective: 'Wirksam', partly_effective: 'Teilweise wirksam', not_effective: 'Nicht wirksam',
  deteriorated: 'Verschlechterung dokumentiert', not_assessable: 'Nicht beurteilbar',
};
export const evaluationOutcomeText = (outcome: CarePlanEvaluationListItem['outcome']) => evaluationOutcomeLabels[outcome] ?? 'Ergebnis unklar';
export type EvaluationFilter = 'all' | 'update' | 'review';
const visitDate = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium' });
export function qualityWorklistDate(value: string | null) {
  if (!value) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? visitDate.format(instant) : null;
}

/** A historic due date stops being actionable once there is a newer evaluation on its plan. */
export function latestEvaluationIds(rows: readonly CarePlanEvaluationListItem[]) {
  const latest = new Map<string, CarePlanEvaluationListItem>();
  for (const row of rows) {
    const previous = latest.get(row.carePlanId);
    const date = Date.parse(row.evaluatedAt);
    if (!Number.isFinite(date)) continue;
    if (!previous || date > Date.parse(previous.evaluatedAt) || (date === Date.parse(previous.evaluatedAt) && row.id > previous.id)) latest.set(row.carePlanId, row);
  }
  return new Set(Array.from(latest.values(), row => row.id));
}
export function evaluationReviewReached(row: CarePlanEvaluationListItem, now: number) {
  const when = Date.parse(row.nextEvaluationAt ?? '');
  return Number.isFinite(when) && when <= now;
}
export function filterEvaluations(rows: readonly CarePlanEvaluationListItem[], filter: EvaluationFilter, search: string, now: number) {
  const latest = latestEvaluationIds(rows);
  return rows.filter(row => {
    if (filter === 'update' && (!latest.has(row.id) || row.requiresPlanUpdate !== true)) return false;
    if (filter === 'review' && (!latest.has(row.id) || !evaluationReviewReached(row, now))) return false;
    return qualityWorklistMatch(search, [row.clientName, row.planTitle, row.evaluatorName, evaluationOutcomeText(row.outcome)]);
  });
}
