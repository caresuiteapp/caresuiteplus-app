import type { CareMeasureLiveItem, CarePlanListItem } from '@/types/modules/pflege';
import { woundUuid } from './woundCareDomain.ts';

export type PlanWorkFilter = 'all' | 'due' | 'ending' | 'ended';
export type MeasureWorkFilter = 'all' | 'due' | 'upcoming' | 'undated' | 'paused' | 'completed' | 'cancelled';

export function storedCalendarDay(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T12:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export function addCalendarDays(day: string, delta: number): string {
  const date = new Date(day + 'T12:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export const PLAN_WORK_FILTERS = [
  { key: 'all', label: 'Alle Arbeitsschritte' },
  { key: 'due', label: 'Evaluationstermin erreicht' },
  { key: 'ending', label: 'Endet bis in 7 Tagen' },
  { key: 'ended', label: 'Gültigkeitsende überschritten' },
] satisfies { key: PlanWorkFilter; label: string }[];

export function planWorkFilter(value: unknown): PlanWorkFilter {
  return value === 'due' || value === 'ending' || value === 'ended' ? value : 'all';
}

export function planMatchesWork(item: CarePlanListItem, filter: PlanWorkFilter, day: string): boolean {
  if (filter === 'all') return true;
  if (item.status !== 'aktiv') return false;
  if (filter === 'due') return item.alertCount > 0;
  const until = storedCalendarDay(item.validUntil);
  if (!until) return false;
  return filter === 'ended' ? until < day : until >= day && until <= addCalendarDays(day, 7);
}

export const MEASURE_WORK_FILTERS = [
  { key: 'all', label: 'Alle Zustände' },
  { key: 'due', label: 'Termin erreicht' },
  { key: 'upcoming', label: 'Nächste 7 Tage' },
  { key: 'undated', label: 'Ohne Termin' },
  { key: 'paused', label: 'Pausiert' },
  { key: 'completed', label: 'Abgeschlossen' },
  { key: 'cancelled', label: 'Abgebrochen' },
] satisfies { key: MeasureWorkFilter; label: string }[];

export function measureWorkFilter(value: unknown): MeasureWorkFilter {
  return MEASURE_WORK_FILTERS.some(item => item.key === value) ? value as MeasureWorkFilter : 'all';
}

export function canReviewMeasure(row: CareMeasureLiveItem): boolean {
  return woundUuid(row.id) && woundUuid(row.carePlanId) && woundUuid(row.clientId)
    && ['active', 'aktiv'].includes(row.planStatus) && (row.status === 'active' || row.status === 'paused');
}

export function sameMeasureReviewFrame(expected: CareMeasureLiveItem, current: CareMeasureLiveItem): boolean {
  return canReviewMeasure(current) && expected.id === current.id && expected.carePlanId === current.carePlanId
    && expected.clientId === current.clientId && expected.updatedAt === current.updatedAt && expected.status === current.status
    && expected.planStatus === current.planStatus && expected.title === current.title && expected.intervention === current.intervention
    && expected.frequency === current.frequency && expected.responsibleRole === current.responsibleRole
    && expected.nextEvaluationAt === current.nextEvaluationAt;
}

export function measureMatchesWork(row: CareMeasureLiveItem, filter: MeasureWorkFilter, day: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'paused' || filter === 'completed' || filter === 'cancelled') return row.status === filter;
  if (row.status !== 'active' || !['active', 'aktiv'].includes(row.planStatus)) return false;
  if (filter === 'undated') return row.nextEvaluationAt === null;
  const reviewDay = storedCalendarDay(row.nextEvaluationAt);
  return reviewDay !== null && (filter === 'due' ? reviewDay <= day : reviewDay > day && reviewDay <= addCalendarDays(day, 7));
}

export function storedDateLabel(value: unknown): string {
  const date = storedCalendarDay(value);
  return date ? date.split('-').reverse().join('.') : 'Nicht angegeben';
}

export function groupVisibleMeasures<T extends Pick<CareMeasureLiveItem, 'status' | 'nextEvaluationAt' | 'planStatus' | 'clientName' | 'title' | 'id'>>(
  rows: readonly T[], day: string,
): T[] {
  const group = (row: T) => {
    if (row.status !== 'active' || !['active', 'aktiv'].includes(row.planStatus)) return 3;
    const reviewDay = storedCalendarDay(row.nextEvaluationAt);
    return reviewDay ? (reviewDay <= day ? 0 : 1) : 2;
  };
  return [...rows].sort((left, right) => group(left) - group(right)
    || (left.nextEvaluationAt ?? '').localeCompare(right.nextEvaluationAt ?? '')
    || left.clientName.localeCompare(right.clientName, 'de') || left.title.localeCompare(right.title, 'de') || left.id.localeCompare(right.id));
}
