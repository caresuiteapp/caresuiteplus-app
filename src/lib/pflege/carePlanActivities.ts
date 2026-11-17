export const carePlanDays = [
  { key: 1, label: 'Mo', name: 'Montag' },
  { key: 2, label: 'Di', name: 'Dienstag' },
  { key: 3, label: 'Mi', name: 'Mittwoch' },
  { key: 4, label: 'Do', name: 'Donnerstag' },
  { key: 5, label: 'Fr', name: 'Freitag' },
  { key: 6, label: 'Sa', name: 'Samstag' },
  { key: 7, label: 'So', name: 'Sonntag' },
] as const;

export const carePlanActivityLabels = { drinking: 'Trinkplan', positioning: 'Lagerungsplanung' } as const;
export type CarePlanActivityKind = keyof typeof carePlanActivityLabels;
export type CarePlanDay = (typeof carePlanDays)[number]['key'];
export type CarePlanItemState = 'active' | 'paused' | 'completed' | 'cancelled';

export type CarePlanActivity = {
  kind: CarePlanActivityKind;
  days: CarePlanDay[];
  times: string[];
  subject: string;
  equipment: string;
  offeredMl: number | null;
};

export type CarePlanActivityDraft = Omit<CarePlanActivity, 'times' | 'offeredMl'> & {
  times: string;
  offeredMl: string;
};

export function newPlanActivity(kind: CarePlanActivityKind): CarePlanActivityDraft {
  return { kind, days: [], times: '', subject: '', equipment: '', offeredMl: '' };
}

export function planActivityDraft(activity: CarePlanActivity): CarePlanActivityDraft {
  return {
    ...activity,
    times: activity.times.join(', '),
    offeredMl: activity.offeredMl === null ? '' : String(activity.offeredMl),
  };
}

const clock = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;

export function readPlanActivity(value: unknown): CarePlanActivity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { kind, days, times, subject, equipment, offeredMl } = value as Partial<CarePlanActivity>;
  if (kind !== 'drinking' && kind !== 'positioning') return null;
  if (!Array.isArray(days) || !days.length || days.length > 7 ||
      !days.every(day => carePlanDays.some(choice => choice.key === day)) || new Set(days).size !== days.length) return null;
  if (!Array.isArray(times) || !times.length || times.length > 24 ||
      !times.every(time => typeof time === 'string' && clock.test(time)) || new Set(times).size !== times.length) return null;
  if (typeof subject !== 'string' || !subject.trim() || subject.length > 160 ||
      typeof equipment !== 'string' || equipment.length > 240) return null;
  if (offeredMl !== null && (kind !== 'drinking' || typeof offeredMl !== 'number' ||
      !Number.isInteger(offeredMl) || offeredMl < 1 || offeredMl > 9999)) return null;
  return { kind, days: [...days].sort(), times: [...times].sort(), subject, equipment, offeredMl };
}

export function parsePlanActivity(draft: CarePlanActivityDraft): CarePlanActivity | null {
  const amount = draft.kind === 'drinking' ? draft.offeredMl.trim() : '';
  if (amount && !/^[0-9]{1,4}$/.test(amount)) return null;
  return readPlanActivity({
    ...draft,
    times: draft.times.trim().split(/[,\s]+/).filter(Boolean),
    subject: draft.subject.trim(), equipment: draft.equipment.trim(),
    offeredMl: amount ? Number(amount) : null,
  });
}

export function planActivityFrequency(activity: CarePlanActivity): string {
  const days = activity.days.length === 7 ? 'Täglich' : carePlanDays.filter(day => activity.days.includes(day.key)).map(day => day.label).join(', ');
  return `${days} · ${activity.times.join(', ')}`;
}

export function planItemState(input: unknown): CarePlanItemState | undefined {
  return input === 'active' || input === 'paused' || input === 'completed' || input === 'cancelled' ? input : undefined;
}

export function planModelKey(input: unknown) {
  if (input === 'atl' || input === 'aedl' || input === 'fedl' || input === 'roper' || input === 'orem' || input === 'henderson') return input;
  return null;
}
