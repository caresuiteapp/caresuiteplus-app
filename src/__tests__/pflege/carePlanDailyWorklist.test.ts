import { describe, expect, it } from 'vitest';
import { addCalendarDays, canReviewMeasure, groupVisibleMeasures, measureMatchesWork, measureWorkFilter, planMatchesWork, planWorkFilter, sameMeasureReviewFrame, storedCalendarDay } from '@/lib/pflege/carePlanDailyWorklist';
import type { CareMeasureLiveItem, CarePlanListItem } from '@/types/modules/pflege';

const id = (tail: string) => `10000000-0000-0000-0000-${tail.padStart(12, '0')}`;
const day = '2026-11-14';
const plan: CarePlanListItem = {
  id: id('1'), tenantId: id('2'), title: 'Pflegeplan', validFrom: '2026-11-01', validUntil: day, status: 'aktiv',
  clientId: id('3'), updatedAt: '2026-11-12T09:30:00Z', clientName: 'Testperson', careLevel: null, alertCount: 1,
};
const measure: CareMeasureLiveItem = {
  id: id('4'), carePlanId: plan.id, clientId: plan.clientId, clientName: plan.clientName, planTitle: plan.title,
  planStatus: 'active', title: 'Testmaßnahme', intervention: 'Text', frequency: '', responsibleRole: '', status: 'active',
  nextEvaluationAt: day, overdue: false, updatedAt: plan.updatedAt,
};
describe('Pflegeplanung und Maßnahmen: Arbeitslisten aus gespeicherten Terminen', () => {
  it('accepts real calendar dates only and evaluates month and DST boundaries by calendar day', () => {
    expect(storedCalendarDay('2026-02-29')).toBeNull();
    expect(storedCalendarDay('2026-11-14T00:00:00Z')).toBeNull();
    expect(addCalendarDays('2026-10-25', 7)).toBe('2026-11-01');
  });
  it('distinguishes plans that end today, within a week or ended in the past without changing their status', () => {
    expect(planMatchesWork(plan, 'ending', day)).toBe(true);
    expect(planMatchesWork(plan, 'ended', day)).toBe(false);
    expect(planMatchesWork({ ...plan, validUntil: '2026-11-21' }, 'ending', day)).toBe(true);
    expect(planMatchesWork({ ...plan, validUntil: '2026-11-22' }, 'ending', day)).toBe(false);
    expect(planMatchesWork({ ...plan, validUntil: '2026-11-13' }, 'ended', day)).toBe(true);
    expect(planMatchesWork({ ...plan, validUntil: null }, 'ended', day)).toBe(false);
    expect(planMatchesWork({ ...plan, status: 'entwurf' }, 'due', day)).toBe(false);
    expect(planMatchesWork(plan, 'due', day)).toBe(true);
    expect(planWorkFilter(['due'])).toBe('all');
  });
  it('defines reached evaluations from active measures in active plans and never trusts a presentation flag', () => {
    expect(measureMatchesWork(measure, 'due', day)).toBe(true);
    expect(measureMatchesWork({ ...measure, planStatus: 'completed', overdue: true }, 'due', day)).toBe(false);
    expect(measureMatchesWork({ ...measure, status: 'paused' }, 'due', day)).toBe(false);
    expect(measureMatchesWork({ ...measure, status: 'paused' }, 'paused', day)).toBe(true);
    expect(measureMatchesWork({ ...measure, nextEvaluationAt: null }, 'undated', day)).toBe(true);
    expect(measureMatchesWork({ ...measure, nextEvaluationAt: '2026-11-21' }, 'upcoming', day)).toBe(true);
    expect(measureWorkFilter(['paused', 'completed'])).toBe('all');
  });
  it('puts reached dates first in a deterministic work queue', () => {
    const undated = { ...measure, id: id('5'), nextEvaluationAt: null };
    const later = { ...measure, id: id('6'), nextEvaluationAt: '2026-11-20' };
    const paused = { ...measure, id: id('7'), status: 'paused' as const, nextEvaluationAt: '2026-10-03' };
    expect(groupVisibleMeasures([paused, undated, later, measure], day).map(row => row.id)).toEqual([measure.id, later.id, undated.id, paused.id]);
  });
  it('keeps completed measures readable but rules out stale review ranges and foreign parents', () => {
    expect(canReviewMeasure(measure)).toBe(true);
    expect(canReviewMeasure({ ...measure, status: 'completed' })).toBe(false);
    expect(canReviewMeasure({ ...measure, planStatus: 'draft' })).toBe(false);
    expect(sameMeasureReviewFrame(measure, { ...measure })).toBe(true);
    expect(sameMeasureReviewFrame(measure, { ...measure, clientId: id('999') })).toBe(false);
    expect(sameMeasureReviewFrame(measure, { ...measure, updatedAt: '2026-11-14T10:00:00Z' })).toBe(false);
    expect(sameMeasureReviewFrame(measure, { ...measure, nextEvaluationAt: '2026-11-15' })).toBe(false);
  });
});
