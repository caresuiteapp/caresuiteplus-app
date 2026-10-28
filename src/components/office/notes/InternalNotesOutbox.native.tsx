// Generated native presentation from src/components/office/notes/InternalNotesOutbox.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSection,NativeDiv,NativeSpan,NativeH2,NativeP,NativeButton,NativeInput,NativeSelect,NativeOption,NativeH3,NativeArticle,NativeTime,NativeDetails,NativeSummary,NativeUl,NativeLi,NativeStrong,NativeSmall} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InternalNote, InternalNoteActor } from "../../../lib/office/notes/internalTypes.native.ts";
import { listInternalNotes } from "../../../lib/office/notes/internalService.native.ts";
import { INTERNAL_NOTE_KINDS, INTERNAL_NOTE_STATUSES } from "../../../lib/office/notes/internalModel.native.ts";
const when = (value: string) => new Date(value).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
export function InternalNotesOutbox({ actor, onCompose, refreshKey = 0, canCompose = true }: {
    actor: InternalNoteActor;
    onCompose: () => void;
    refreshKey?: number;
    canCompose?: boolean;
}) {
    const window = useNativeWorkflowWindow();
    const [notes, setNotes] = useState<InternalNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const request = useRef(0);
    const refresh = useCallback(async () => {
        const serial = ++request.current;
        setLoading(true);
        setError('');
        try {
            const result = await listInternalNotes(actor, 'sent');
            if (serial !== request.current)
                return;
            if (result.ok)
                setNotes(result.data);
            else
                setError(result.error);
        }
        catch {
            if (serial === request.current)
                setError('Die übermittelten Einträge konnten nicht geladen werden.');
        }
        finally {
            if (serial === request.current)
                setLoading(false);
        }
    }, [actor]);
    useEffect(() => { void refresh(); return () => { request.current++; }; }, [refresh, refreshKey]);
    useEffect(() => { const focus = () => { void refresh(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [refresh]);
    const visible = useMemo(() => notes.filter(note => {
        const complete = note.recipients.length > 0 && note.recipients.every(person => person.status === 'done');
        return (filter === 'all' || (filter === 'done' ? complete : !complete)) && [note.title, note.body, ...note.recipients.map(person => person.displayName)].join(' ').toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de'));
    }), [notes, filter, query]);
    return <NativeSection className="ni-outbox ni-scroll" aria-label="Weitergegebene Einträge">
    <NativeDiv className="ni-section-heading"><NativeDiv><NativeSpan className="nw-eyebrow">IHRE INTERNEN ÜBERMITTLUNGEN</NativeSpan><NativeH2>Weitergegeben</NativeH2><NativeP>Verfolgen Sie den Bearbeitungsstand und die Rückmeldungen Ihrer Mitarbeitenden.</NativeP></NativeDiv><NativeDiv className="nw-actions"><NativeButton className="nw-button" disabled={loading} onClick={() => void refresh()}>Aktualisieren</NativeButton>{canCompose && <NativeButton className="nw-button nw-button--primary" onClick={onCompose}>Neue Übermittlung</NativeButton>}</NativeDiv></NativeDiv>
    <NativeDiv className="ni-outbox-filters"><NativeInput type="search" aria-label="Übermittlungen durchsuchen" placeholder="Betreff, Inhalt oder Person suchen …" value={query} onChange={event => setQuery(event.target.value)}/><NativeSelect aria-label="Bearbeitungsstand filtern" value={filter} onChange={event => setFilter(event.target.value)}><NativeOption value="all">Alle Übermittlungen</NativeOption><NativeOption value="open">Noch offen</NativeOption><NativeOption value="done">Bei allen erledigt</NativeOption></NativeSelect></NativeDiv>
    {error && <NativeDiv className="nw-notice nw-notice--error" role="alert">{error}<NativeButton className="nw-text-button" disabled={loading} onClick={() => void refresh()}>Erneut versuchen</NativeButton></NativeDiv>}
    <NativeDiv className="ni-outbox-list" aria-busy={loading}>{loading && !notes.length ? <NativeP role="status" className="ni-empty">Übermittlungen werden geladen …</NativeP> : !visible.length ? <NativeDiv className="ni-empty"><NativeH3>{error ? 'Einträge nicht geladen' : notes.length ? 'Keine passenden Einträge' : 'Noch nichts weitergegeben'}</NativeH3><NativeP>{error ? 'Bitte die Abfrage erneut versuchen.' : notes.length ? 'Passen Sie die Suche oder den Bearbeitungsstand an.' : 'Erstellen Sie eine interne Aufgabe oder öffnen Sie eine persönliche Notiz und wählen Sie „Intern weitergeben“.'}</NativeP></NativeDiv> : visible.map(note => <NativeArticle className="ni-sent-card" key={note.id}>
      <NativeDiv className="ni-sent-head"><NativeSpan className="ni-pill">{INTERNAL_NOTE_KINDS.find(item => item.value === note.kind)?.label}</NativeSpan>{note.priority === 'high' && <NativeSpan className="ni-pill ni-pill--high">Hohe Priorität</NativeSpan>}<NativeTime dateTime={note.createdAt}>{when(note.createdAt)}</NativeTime></NativeDiv><NativeH3>{note.title}</NativeH3>{note.dueDate && <NativeP className="ni-due">Frist: {note.dueDate.split('-').reverse().join('.')}</NativeP>}
      <NativeDetails className="ni-sent-body"><NativeSummary>Übermittelten Inhalt anzeigen</NativeSummary><NativeP className="ni-body">{note.body}</NativeP></NativeDetails>
      <NativeUl className="ni-deliveries">{note.recipients.map(person => <NativeLi key={person.employeeId}><NativeDiv className="ni-delivery-heading"><NativeStrong>{person.displayName}</NativeStrong><NativeSpan className={`ni-pill ni-pill--${person.status}`}>{INTERNAL_NOTE_STATUSES.find(item => item.value === person.status)?.label}</NativeSpan></NativeDiv><NativeSmall>{person.readAt ? `Gelesen am ${when(person.readAt)}` : 'Noch nicht gelesen'}</NativeSmall>{person.response && <NativeDiv className="ni-response"><NativeSpan>Rückmeldung</NativeSpan><NativeP>{person.response}</NativeP></NativeDiv>}</NativeLi>)}</NativeUl>
    </NativeArticle>)}</NativeDiv>
  </NativeSection>;
}
