import {woundInstant} from './woundCareDomain.ts';

export type AdministrationOutcome = 'administered' | 'late' | 'omitted' | 'refused' | 'held';
export type AdministrationDraft = {
  status: AdministrationOutcome; occurredAt: string; dose?: string; route?: string;
  deviationReason?: string; prnReason?: string; witnessProfileId?: string | null;
  painScoreBefore?: number | null; notes?: string;
};
export type AdministrationOrder = {
  status: string; startDate: string | null; endDate: string | null;
  isPrn: boolean; isControlledSubstance: boolean;
};
export const isMedicationGiven = (status: string) => status === 'administered' || status === 'late';
export const validPainScore = (score: unknown) => score == null || (typeof score === 'number' && Number.isInteger(score) && score >= 0 && score <= 10);

export function berlinEventInput(date: Date) {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = (key: string) => parts.find(p => p.type === key)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

function validCalendar(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !date.startsWith('0000') && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}

export function berlinEventCandidates(date: string, time: string): string[] {
  if (!validCalendar(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return [];
  return ['+02:00', '+01:00'].map(offset => `${date}T${time}:00${offset}`).filter(iso => {
    const actual = berlinEventInput(new Date(iso));
    return actual.date === date && actual.time === time;
  });
}

export function validEventInstant(iso: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(iso);
  return !!match && validCalendar(match[1]) && Number.isFinite(Date.parse(iso));
}

function medicationInstant(iso: string) { return validEventInstant(iso) ? woundInstant(iso) : null; }
function medicationNow(now: Date) { const value = now.getTime(); return Number.isSafeInteger(value) ? BigInt(value) * 1000n : null; }

export function validateMedicationAdministration(order: AdministrationOrder, actorId: string, input: AdministrationDraft, now = new Date()): string | null {
  if (!actorId) return 'Das angemeldete Benutzerprofil fehlt.';
  if (order.status !== 'active') return 'Nur aktive Verordnungen dürfen dokumentiert werden.';
  if (!['administered', 'late', 'omitted', 'refused', 'held'].includes(input.status)) return 'Bitte ein gültiges Ergebnis auswählen.';
  const occurred = medicationInstant(input.occurredAt), recordedNow = medicationNow(now);
  if (occurred === null || recordedNow === null || occurred > recordedNow) return 'Ein gültiger Ereigniszeitpunkt ohne Zukunftsdatum ist erforderlich.';
  const day = berlinEventInput(new Date(input.occurredAt)).date;
  if ((order.startDate && day < order.startDate) || (order.endDate && day > order.endDate)) return 'Der Ereigniszeitpunkt liegt außerhalb der Verordnungsgültigkeit.';
  if (input.status !== 'administered' && !input.deviationReason?.trim()) return 'Bei nicht erfolgter oder abweichender Gabe ist eine Begründung erforderlich.';
  if (!validPainScore(input.painScoreBefore)) return 'Die Schmerzskala muss eine ganze Zahl von 0 bis 10 sein.';
  if (isMedicationGiven(input.status)) {
    if (!input.dose?.trim() || !input.route?.trim()) return 'Tatsächlich verabreichte Dosis und Applikationsweg ausdrücklich angeben.';
    if (order.isPrn && !input.prnReason?.trim()) return 'Die aktuelle Bedarfsindikation fehlt.';
    if (order.isControlledSubstance && (!input.witnessProfileId || input.witnessProfileId === actorId)) return 'Eine andere Person für die Gegenkontrolle auswählen.';
  } else if (input.dose?.trim() || input.route?.trim() || input.prnReason?.trim() || input.witnessProfileId || input.painScoreBefore != null) {
    return 'Eine Nichtgabe darf keine verabreichte Dosis, Applikation oder Gegenkontrolle enthalten.';
  }
  return null;
}

export function validateMedicationFollowUp(givenAt: string | null, observedAt: string, observation: string, action: string, pain: number | null, now = new Date()): string | null {
  const given = givenAt ? medicationInstant(givenAt) : null;
  if (given === null) return 'Ein bestätigter tatsächlicher Gabezeitpunkt fehlt.';
  const observed = medicationInstant(observedAt), recordedNow = medicationNow(now);
  if (observed === null || recordedNow === null || observed < given || observed > recordedNow) return 'Die Kontrolle muss nach der Gabe und außerhalb der Zukunft liegen.';
  if (!observation.trim() || !action.trim()) return 'Beobachtung und daraus folgende Maßnahme sind erforderlich.';
  return validPainScore(pain) ? null : 'Die Schmerzskala muss eine ganze Zahl von 0 bis 10 sein.';
}
