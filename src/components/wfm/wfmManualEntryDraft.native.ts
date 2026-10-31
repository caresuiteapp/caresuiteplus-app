// Generated native presentation from src/components/wfm/wfmManualEntryDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { WfmOfficeManualEntryInput, WfmOfficeWorkKind } from '@/types/modules/wfmOfficeTimekeeping';
export type BerlinClockChoice = 'auto' | 'summer' | 'winter';
export type ManualEntryDraft = {
    employeeId: string;
    workDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    startClock: BerlinClockChoice;
    endClock: BerlinClockChoice;
    pauseMinutes: string;
    workKind: WfmOfficeWorkKind;
    reason: string;
};
const berlinClock = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function berlinWorkDate(now = new Date()): string {
    const parts = berlinClock.formatToParts(now);
    const part = (name: string) => parts.find(item => item.type === name)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validManualDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const probe = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(probe.getTime()) && probe.toISOString().slice(0, 10) === value;
}
/** Matching Intl's actual Berlin clock rejects nonexistent times and exposes repeated times. */
export function berlinClockCandidates(day: string, clock: string): {
    choice: Exclude<BerlinClockChoice, 'auto'>;
    iso: string;
}[] {
    if (!validManualDate(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))
        return [];
    const naive = Date.parse(`${day}T${clock}:00Z`);
    return ([{ choice: 'summer', offset: 120 }, { choice: 'winter', offset: 60 }] as const).flatMap(candidate => {
        const instant = new Date(naive - candidate.offset * 60000);
        const parts = berlinClock.formatToParts(instant);
        const part = (name: string) => parts.find(item => item.type === name)?.value ?? '';
        return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}` === `${day}T${clock}`
            ? [{ choice: candidate.choice, iso: instant.toISOString() }] : [];
    });
}
export function resolveBerlinClock(day: string, clock: string, choice: BerlinClockChoice): string {
    const candidates = berlinClockCandidates(day, clock);
    return candidates.length === 1 ? candidates[0].iso : candidates.find(candidate => candidate.choice === choice)?.iso ?? '';
}
export function validateManualEntryDraft(draft: ManualEntryDraft, employeeIds: readonly string[], now = Date.now()): {
    ok: true;
    input: WfmOfficeManualEntryInput;
    grossMinutes: number;
    netMinutes: number;
} | {
    ok: false;
    error: string;
} {
    if (!draft.employeeId || !employeeIds.includes(draft.employeeId))
        return { ok: false, error: 'Bitte eine verfügbare mitarbeitende Person auswählen.' };
    if (!validManualDate(draft.workDate) || !validManualDate(draft.endDate))
        return { ok: false, error: 'Bitte ein gültiges Beginn- und Enddatum angeben.' };
    const start = resolveBerlinClock(draft.workDate, draft.startTime, draft.startClock);
    const end = resolveBerlinClock(draft.endDate, draft.endTime, draft.endClock);
    if (!start || !end) {
        const repeated = berlinClockCandidates(draft.workDate, draft.startTime).length > 1 || berlinClockCandidates(draft.endDate, draft.endTime).length > 1;
        return { ok: false, error: repeated ? 'Diese Uhrzeit kommt bei der Zeitumstellung zweimal vor. Bitte Sommer- oder Winterzeit auswählen.' : 'Bitte gültige Uhrzeiten angeben. Zeiten innerhalb der übersprungenen Stunde bei der Zeitumstellung sind nicht möglich.' };
    }
    if (Date.parse(end) <= Date.parse(start))
        return { ok: false, error: 'Das Ende muss nach dem Beginn liegen. Bei Nachtschichten auch das Enddatum anpassen.' };
    if (Date.parse(end) > now)
        return { ok: false, error: 'Ein Nachtrag darf keine zukünftige Arbeitszeit enthalten.' };
    const grossMinutes = Math.round((Date.parse(end) - Date.parse(start)) / 60000);
    const pauseMinutes = Number(draft.pauseMinutes);
    if (!/^\d+$/.test(draft.pauseMinutes) || !Number.isSafeInteger(pauseMinutes) || pauseMinutes > grossMinutes)
        return { ok: false, error: 'Die Pause muss eine ganze Minutenzahl zwischen 0 und der erfassten Dauer sein.' };
    if (!['einsatz', 'buero', 'homeoffice', 'fahrt', 'sonstige'].includes(draft.workKind))
        return { ok: false, error: 'Bitte eine gültige Arbeitsart auswählen.' };
    if (!draft.reason.trim())
        return { ok: false, error: 'Bitte eine Begründung für den Nachtrag eintragen.' };
    if (draft.reason.trim().length > 2000)
        return { ok: false, error: 'Die Begründung darf höchstens 2.000 Zeichen enthalten.' };
    return { ok: true, input: { employeeId: draft.employeeId, workDate: draft.workDate, workKind: draft.workKind, actualStartAt: start, actualEndAt: end, pauseMinutes, reason: draft.reason.trim() }, grossMinutes, netMinutes: grossMinutes - pauseMinutes };
}
export function manualEntryRequest(previous: {
    fingerprint: string;
    id: string;
} | null, input: WfmOfficeManualEntryInput, createId: () => string): {
    fingerprint: string;
    id: string;
} {
    const fingerprint = JSON.stringify([input.employeeId, input.workDate, input.workKind, input.actualStartAt, input.actualEndAt, input.pauseMinutes, input.reason, input.assignmentId ?? null]);
    return previous?.fingerprint === fingerprint ? previous : { fingerprint, id: createId() };
}
