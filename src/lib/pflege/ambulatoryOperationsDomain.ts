export type FundingBasis = 'sgb_xi' | 'sgb_v' | 'private';
export type AdmissionStatus = 'draft' | 'active' | 'paused' | 'closed';
export type CareAdmission = {
  id: string; clientId: string; clientName: string; status: AdmissionStatus;
  startsOn: string; endsOn: string; basis: FundingBasis; payerName: string; payerIk: string;
  contractReference: string; costInformationReference: string; consentReference: string;
  emergencyContact: string; accessNotes: string; notes: string; updatedAt: string;
};
export type CareTariff = {
  id: string; code: string; label: string; basis: FundingBasis; unit: 'visit' | 'minute' | 'hour' | 'unit';
  unitPriceCents: number; validFrom: string; validUntil: string; payerIk: string; agreementReference: string;
};
export type CareTask = {
  id: string; clientId: string; title: string; description: string; dueOn: string;
  priority: 'normal' | 'urgent'; status: 'open' | 'done' | 'cancelled'; assignedEmployeeId: string;
  resolution: string; updatedAt: string;
};
export const admissionLabels: Record<AdmissionStatus, string> = { draft: 'Aufnahme offen', active: 'In Versorgung', paused: 'Versorgung pausiert', closed: 'Versorgung beendet' };
export const basisLabels: Record<FundingBasis, string> = { sgb_xi: 'SGB XI', sgb_v: 'SGB V', private: 'Privat' };
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseEuroCents(value: string): number | null {
  if (!/^\d{1,7}(?:[,.]\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function calculateTariffAmount(tariff: Pick<CareTariff, 'unitPriceCents'>, quantity: string): number | null {
  if (!/^\d{1,5}(?:[,.]\d{1,3})?$/.test(quantity)) return null;
  const amount = Number(quantity.replace(',', '.')) * tariff.unitPriceCents;
  return amount > 0 && amount <= 999999999 ? Math.round(amount) : null;
}
export function admissionBlockers(input: Pick<CareAdmission, 'startsOn' | 'endsOn' | 'basis' | 'payerName' | 'payerIk' | 'contractReference' | 'costInformationReference'>): string[] {
  const missing: string[] = [];
  if (!isCalendarDate(input.startsOn) || (input.endsOn && (!isCalendarDate(input.endsOn) || input.endsOn < input.startsOn))) missing.push('Gültigen Versorgungszeitraum angeben.');
  if (!input.contractReference.trim()) missing.push('Pflegevertrag mit Art, Inhalt, Umfang und Vergütung hinterlegen.');
  if (!input.costInformationReference.trim()) missing.push('Kosteninformation vor Vertragsabschluss hinterlegen.');
  if (input.basis !== 'private' && !input.payerName.trim()) missing.push('Kostenträger hinterlegen.');
  if (input.basis !== 'private' && !/^\d{9}$/.test(input.payerIk)) missing.push('Kostenträger-IK mit neun Ziffern hinterlegen.');
  return missing;
}
export function validTariffs(tariffs: CareTariff[], date: string, basis: FundingBasis, payerIk: string): CareTariff[] {
  return tariffs.filter((t) => t.basis === basis && t.validFrom <= date && (!t.validUntil || t.validUntil >= date) && (!t.payerIk || t.payerIk === payerIk));
}
export function validateShift(input: { employeeId?: string | null; shiftDate: string; startTime: string; endTime: string; breakMinutes?: number }): string | null {
  if (!input.employeeId) return 'Bitte eine aktive Pflegekraft auswählen.';
  if (!isCalendarDate(input.shiftDate)) return 'Bitte ein gültiges Schichtdatum angeben.';
  if (![input.startTime, input.endTime].every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || input.endTime <= input.startTime) return 'Gültige Zeiten mit Ende nach Beginn angeben. Nachtschichten auf zwei Tage aufteilen.';
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const duration = minutes(input.endTime) - minutes(input.startTime);
  const pause = input.breakMinutes ?? 0;
  if (!Number.isInteger(pause) || pause < 0 || pause >= duration || (pause > 0 && pause < 15)) return 'Pausendauer muss null oder mindestens 15 Minuten betragen und innerhalb der Schicht liegen.';
  const work = duration - pause;
  if (work > 600) return 'Mehr als zehn Stunden geplante Arbeitszeit sind in diesem Standardablauf nicht zulässig.';
  if (pause < (work > 540 ? 45 : work > 360 ? 30 : 0)) return 'Für diese Arbeitszeit mindestens 30 bzw. 45 Minuten Pause einplanen.';
  return null;
}
