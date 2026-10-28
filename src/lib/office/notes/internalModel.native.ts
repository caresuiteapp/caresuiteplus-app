// Generated native presentation from src/lib/office/notes/internalModel.web.ts. Update through scripts/port-native-workspaces.mjs.
import { isUuid } from '@/lib/validation/uuid';
import type { NoteDraft } from "./types.native.ts";
import type { InternalDeliveryStatus, InternalNoteDraft, InternalNoteKind, InternalNotePriority } from "./internalTypes.native.ts";
export const INTERNAL_NOTE_KINDS: {
    value: InternalNoteKind;
    label: string;
}[] = [
    { value: 'note', label: 'Notiz' }, { value: 'task', label: 'Aufgabe' },
    { value: 'conversation', label: 'Gesprächsnotiz' }, { value: 'callback', label: 'Rückrufbitte' },
    { value: 'request', label: 'Wunsch / Anliegen' },
];
export const INTERNAL_NOTE_PRIORITIES: {
    value: InternalNotePriority;
    label: string;
}[] = [
    { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Wichtig' },
];
export const INTERNAL_NOTE_STATUSES: {
    value: InternalDeliveryStatus;
    label: string;
}[] = [
    { value: 'open', label: 'Offen' }, { value: 'in_progress', label: 'In Bearbeitung' }, { value: 'done', label: 'Erledigt' },
];
export const INTERNAL_NOTE_HANDWRITING_NOTICE = 'Handschrift und Zeichnungen werden nicht mitgesendet. Bitte wichtige Inhalte als Text ergänzen.';
export function isInternalNoteDate(value: unknown): value is string {
    if (value === '')
        return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-'))
        return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
/** Builds only the editable text shown in the send dialog, never a private-note reference. */
export function buildInternalNoteDraft(note?: NoteDraft | null): InternalNoteDraft {
    const draft: InternalNoteDraft = { kind: 'note', priority: 'normal', title: '', body: '', dueDate: '', recipientEmployeeIds: [] };
    if (!note)
        return draft;
    if (note.category === 'tasks' || note.category === 'next_steps')
        draft.kind = 'task';
    draft.title = note.title;
    draft.dueDate = note.dueDate;
    const sections: string[] = [];
    const section = (label: string, lines: string[]) => { const text = lines.filter(Boolean).join('\n'); if (text)
        sections.push(`${label}\n${text}`); };
    if (note.content.text.trim())
        sections.push(note.content.text);
    // Other format fields may still exist after switching the private editor's
    // format. Only include the ones the selected format actually displays.
    if (note.format === 'cornell') {
        section('Schlüsselwörter & Fragen', [note.content.cues]);
        section('Zusammenfassung', [note.content.summary]);
    }
    if (note.format === 'mindmap')
        section('Mindmap', note.content.nodes.filter(node => node.text.trim()).map(node => `• ${node.text}`));
    section('Fakten & Angaben', note.content.fields.filter(field => field.value.trim()).map(field => field.label.trim() ? `${field.label}: ${field.value}` : field.value));
    section('Aufgaben & nächste Schritte', note.content.tasks.filter(task => task.text.trim()).map(task => {
        const status = INTERNAL_NOTE_STATUSES.find(item => item.value === task.status)?.label ?? 'Offen';
        return `• ${task.text} (${status}${task.assignee.trim() ? `; zuständig: ${task.assignee}` : ''}${task.dueDate ? `; fällig: ${task.dueDate}` : ''})`;
    }));
    section('Quellen & Links', note.content.sources.filter(source => source.title.trim() || source.url.trim()).map(source => [source.title, source.url].filter(Boolean).join(': ')));
    // Do not silently shorten a long private note. The sender reviews and edits
    // this text; validation asks them to reduce it before any transmission.
    draft.body = sections.join('\n\n');
    return draft;
}
export function validateInternalNoteDraft(value: unknown): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return 'Der interne Eintrag ist ungültig.';
    const draft = value as Record<string, unknown>;
    if (!INTERNAL_NOTE_KINDS.some(item => item.value === draft.kind))
        return 'Bitte eine gültige Art auswählen.';
    if (!INTERNAL_NOTE_PRIORITIES.some(item => item.value === draft.priority))
        return 'Bitte eine gültige Priorität auswählen.';
    if (typeof draft.title !== 'string' || !draft.title.trim() || draft.title.length > 240)
        return 'Bitte einen Titel mit höchstens 240 Zeichen eingeben.';
    if (typeof draft.body !== 'string' || !draft.body.trim() || draft.body.length > 20000)
        return 'Bitte einen Text mit höchstens 20.000 Zeichen eingeben.';
    if (!isInternalNoteDate(draft.dueDate))
        return 'Bitte ein gültiges Fälligkeitsdatum auswählen oder das Datum leeren.';
    if (!Array.isArray(draft.recipientEmployeeIds) || draft.recipientEmployeeIds.length < 1 || draft.recipientEmployeeIds.length > 25
        || draft.recipientEmployeeIds.some(id => !isUuid(id as string)))
        return 'Bitte zwischen 1 und 25 Mitarbeitende mit aktivem Portalzugang auswählen.';
    const ids = draft.recipientEmployeeIds as string[];
    if (new Set(ids.map(id => id.toLowerCase())).size !== ids.length)
        return 'Eine Person wurde mehrfach ausgewählt. Bitte die Empfängerliste prüfen.';
    return null;
}
