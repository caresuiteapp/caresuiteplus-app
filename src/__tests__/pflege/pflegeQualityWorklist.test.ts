import { describe, expect, it } from 'vitest';
import { filterEvaluations, qualityWorklistId, qualityWorklistMatch } from '@/lib/pflege/pflegeQualityWorklist';
import type { CarePlanEvaluationListItem } from '@/types/modules/pflege';

const planA = '10000000-0000-0000-0000-0000000000aa';
const planB = '10000000-0000-0000-0000-0000000000bb';
const now = Date.parse('2026-11-14T12:00:00+01:00');
function evaluation(id: string, carePlanId: string, date: string, next: string | null, update: boolean): CarePlanEvaluationListItem {
  return { id, tenantId: 'tenant', clientId: 'client', clientName: 'Müller, Anna', carePlanId, planTitle: 'Pflegeplan', outcome: 'partly_effective', observedEffect: '', professionalConclusion: '', requiresPlanUpdate: update, evaluatedAt: date, nextEvaluationAt: next, evaluatorName: '' };
}

describe('evaluation and visit worklist filters', () => {
  it('never converts ambiguous or invalid scope to an unscoped read', () => {
    expect(qualityWorklistId(undefined)).toBeUndefined();
    expect(qualityWorklistId(planA.toUpperCase())).toBe(planA);
    for (const invalid of ['', '../pflege', [planA, planB], [planA], 123]) expect(qualityWorklistId(invalid)).toBeNull();
  });
  it('finds names and labels across accents and words', () => {
    expect(qualityWorklistMatch('muller WIRKSAM', ['Müller, Anna', 'Teilweise wirksam'])).toBe(true);
    expect(qualityWorklistMatch('muller abgesagt', ['Müller, Anna', 'Teilweise wirksam'])).toBe(false);
  });
  it('applies due and update filters only to the last documented evaluation of each plan', () => {
    const old = evaluation('001', planA, '2026-11-01T13:00:00+01:00', '2026-11-08T11:00:00+01:00', true);
    const updated = evaluation('002', planA, '2026-11-10T10:00:00+01:00', '2026-12-08T11:00:00+01:00', false);
    const due = evaluation('003', planB, '2026-11-10T08:00:00+01:00', '2026-11-14T11:00:00+01:00', true);
    expect(filterEvaluations([old, due, updated], 'review', 'muller', now).map(row => row.id)).toEqual(['003']);
    expect(filterEvaluations([old, due, updated], 'update', '', now).map(row => row.id)).toEqual(['003']);
    expect(filterEvaluations([old, due, updated], 'all', 'teilweise', now)).toHaveLength(3);
  });
});
