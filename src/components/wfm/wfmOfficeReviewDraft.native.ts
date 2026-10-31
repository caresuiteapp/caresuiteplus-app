// Generated native presentation from src/components/wfm/wfmOfficeReviewDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
export function localDateTimeInput(iso: string | null | undefined): string {
    if (!iso)
        return '';
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime()))
        return '';
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
/** Reject impossible calendar dates and DST gaps instead of normalising user input. */
export function localDateTimeToIso(value: string): string {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value))
        return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
        return '';
    const normalized = localDateTimeInput(date.toISOString());
    if (normalized !== (value.length === 16 ? `${value}:00` : value))
        return '';
    return date.toISOString();
}
export function validReviewDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateReviewRange(from: string, to: string): string | null {
    if (!validReviewDate(from) || !validReviewDate(to))
        return 'Bitte ein gültiges Anfangs- und Enddatum wählen.';
    if (from > to)
        return 'Das Enddatum darf nicht vor dem Anfangsdatum liegen.';
    return null;
}
export function validateReviewCorrection(start: string, end: string, pause: string, now = Date.now()): string | null {
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs))
        return 'Bitte Beginn und Ende vollständig eingeben.';
    if (endMs <= startMs)
        return 'Das Ende muss nach dem Beginn liegen. Bei Nachtschichten auch das Enddatum anpassen.';
    if (endMs > now)
        return 'Erfasste Arbeitszeit darf nicht in der Zukunft liegen.';
    if (!/^\d+$/.test(pause.trim()))
        return 'Die Pause muss eine ganze, nicht negative Minutenzahl sein.';
    const pauseMinutes = Number(pause);
    if (!Number.isSafeInteger(pauseMinutes) || pauseMinutes * 60000 > endMs - startMs)
        return 'Die Pause darf die erfasste Dauer nicht überschreiten.';
    return null;
}
export function reviewCorrectionChanged(entry: WfmOfficeTimeEntry, start: string, end: string, pause: string): boolean {
    return start !== (entry.actualStartAt ?? entry.assignmentActualStartAt ?? '')
        || end !== (entry.actualEndAt ?? entry.assignmentActualEndAt ?? '')
        || pause !== String(entry.pauseMinutes ?? 0);
}
export function reviewEntryProtected(entry: WfmOfficeTimeEntry): boolean {
    return entry.exportStatus === 'exported' || entry.reviewStatus === 'exported' || entry.reviewStatus === 'locked';
}
