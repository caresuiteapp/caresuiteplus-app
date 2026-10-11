export type CareTourStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled';
export type CareStopStatus = 'planned' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
export type CareTourInput = {
  requestId?: string;
  tourDate: string; name: string; employeeId: string; vehicleLabel: string; notes: string;
  stops: { clientId: string; plannedStart: string; plannedEnd: string; serviceSummary: string }[];
};
export const CARE_TOUR_STATUS_LABELS: Record<CareTourStatus, string> = {
  draft: 'Entwurf', published: 'Freigegeben', in_progress: 'Unterwegs', completed: 'Abgeschlossen', cancelled: 'Abgesagt',
};
export const CARE_STOP_STATUS_LABELS: Record<CareStopStatus, string> = {
  planned: 'Geplant', arrived: 'Angekommen', in_progress: 'In Versorgung', completed: 'Dokumentiert', cancelled: 'Ausgefallen',
};
export function berlinCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validateCareTour(input: CareTourInput): string | null {
  if (!input.name.trim() || !input.employeeId) return 'Tourname und Pflegekraft sind erforderlich.';
  const date = new Date(`${input.tourDate}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tourDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.tourDate) return 'Bitte ein gültiges Datum im Format JJJJ-MM-TT eingeben.';
  if (!input.stops.length) return 'Mindestens ein Einsatz ist erforderlich.';
  let previousEnd = '';
  for (const [index, stop] of input.stops.entries()) {
    if (!stop.clientId || !stop.serviceSummary.trim()) return `Einsatz ${index + 1}: Klient:in und geplante Leistung sind erforderlich.`;
    if (![stop.plannedStart, stop.plannedEnd].every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) || stop.plannedEnd <= stop.plannedStart) return `Einsatz ${index + 1}: gültige Zeiten (HH:MM) mit Ende nach Beginn eingeben.`;
    if (previousEnd && stop.plannedStart < previousEnd) return `Einsatz ${index + 1}: Zeitfenster überschneiden sich oder die Reihenfolge stimmt nicht.`;
    previousEnd = stop.plannedEnd;
  }
  return null;
}
export function nextCareTourStatus(status: string): CareTourStatus | null {
  return ({ draft: 'published', published: 'in_progress', in_progress: 'completed' } as Record<string, CareTourStatus>)[status] ?? null;
}
export function nextCareStopStatus(status: string): CareStopStatus | null {
  return ({ planned: 'arrived', arrived: 'in_progress', in_progress: 'completed' } as Record<string, CareStopStatus>)[status] ?? null;
}
export function careTourCanComplete(stops: { status: string }[]): boolean {
  return stops.length > 0 && stops.every((stop) => stop.status === 'completed' || stop.status === 'cancelled');
}

/** Correlation only, never an authorization token. */
export function newCareTourRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    return (value === 'x' ? random : (random & 3) | 8).toString(16);
  });
}
