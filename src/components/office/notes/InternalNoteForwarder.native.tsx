// Generated native presentation from src/components/office/notes/InternalNoteForwarder.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSection,NativeDiv,NativeSpan,NativeH2,NativeP,NativeButton,NativeH3,NativeStrong,NativeLabel,NativeSelect,NativeOption,NativeInput,NativeTextarea,NativeSmall,NativeAside} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NoteDraft } from "../../../lib/office/notes/types.native.ts";
import type { InternalNoteActor, InternalNoteDraft, InternalRecipient } from "../../../lib/office/notes/internalTypes.native.ts";
import { buildInternalNoteDraft, INTERNAL_NOTE_KINDS, INTERNAL_NOTE_PRIORITIES, validateInternalNoteDraft } from "../../../lib/office/notes/internalModel.native.ts";
import { listInternalRecipients, recoverPendingInternalNoteSend, sendInternalNote } from "../../../lib/office/notes/internalService.native.ts";
import { newNoteId } from "../../../lib/office/notes/model.native.ts";
type Props = {
    actor: InternalNoteActor;
    sourceNote?: NoteDraft;
    onClose: () => void;
    onSent: () => void;
    onStateChange: (state: {
        dirty: boolean;
        busy: boolean;
        uncertain: boolean;
    }) => void;
};
export function InternalNoteForwarder({ actor, sourceNote, onClose, onSent, onStateChange }: Props) {
    const [draft, setDraft] = useState(() => buildInternalNoteDraft(sourceNote));
    const [recipients, setRecipients] = useState<InternalRecipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [query, setQuery] = useState('');
    const [review, setReview] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [uncertain, setUncertain] = useState(false);
    const [reload, setReload] = useState(0);
    const alive = useRef(true);
    const lock = useRef(false);
    const [initialRequestId] = useState(newNoteId);
    const requestId = useRef(initialRequestId);
    const attempt = useRef<InternalNoteDraft | null>(null);
    const dirty = Boolean(draft.title || draft.body || draft.recipientEmployeeIds.length);
    useEffect(() => { onStateChange({ dirty, busy: busy || uncertain, uncertain }); }, [dirty, busy, uncertain, onStateChange]);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => {
        let current = true;
        setLoading(true);
        setLoadError('');
        void Promise.all([listInternalRecipients(actor), recoverPendingInternalNoteSend(actor)]).then(([result, recovery]) => {
            if (!current)
                return;
            if (recovery.ok && recovery.data) {
                requestId.current = recovery.data.requestId;
                attempt.current = structuredClone(recovery.data.draft);
                setDraft(structuredClone(recovery.data.draft));
                setReview(true);
                setUncertain(true);
            }
            if (result.ok)
                setRecipients(result.data);
            else
                setLoadError(result.error);
            if (!recovery.ok)
                setLoadError(recovery.error);
        }).catch(() => { if (current)
            setLoadError('Mitarbeitende konnten nicht geladen werden. Bitte erneut versuchen.'); })
            .finally(() => { if (current)
            setLoading(false); });
        return () => { current = false; };
    }, [actor, reload]);
    const filtered = useMemo(() => {
        const normalize = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLocaleLowerCase('de');
        const needle = normalize(query.trim());
        return recipients.filter(recipient => normalize(recipient.displayName).includes(needle));
    }, [recipients, query]);
    const selected = recipients.filter(recipient => draft.recipientEmployeeIds.includes(recipient.employeeId));
    const change = (patch: Partial<InternalNoteDraft>) => {
        if (lock.current || uncertain)
            return;
        setDraft(current => ({ ...current, ...patch }));
        setError('');
    };
    const preview = () => {
        const invalid = validateInternalNoteDraft(draft);
        if (invalid) {
            setError(invalid);
            return;
        }
        setError('');
        setReview(true);
    };
    const send = async () => {
        if (lock.current)
            return;
        const invalid = validateInternalNoteDraft(draft);
        if (invalid) {
            setError(invalid);
            return;
        }
        lock.current = true;
        setBusy(true);
        setError('');
        attempt.current ??= structuredClone(draft);
        try {
            const result = await sendInternalNote(actor, requestId.current, attempt.current);
            if (!alive.current)
                return;
            if (result.ok) {
                onStateChange({ dirty: false, busy: false, uncertain: false });
                onSent();
            }
            else {
                const unresolved = uncertain || Boolean(result.uncertain);
                setError(result.error);
                setUncertain(unresolved);
                if (!unresolved) {
                    attempt.current = null;
                    requestId.current = newNoteId();
                }
            }
        }
        catch {
            if (alive.current) {
                setUncertain(true);
                setError('Die Übermittlung ist noch nicht bestätigt. Bitte mit demselben Inhalt erneut prüfen.');
            }
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    return <NativeSection className="ni-compose ni-scroll" aria-label="Interne Weitergabe">
    <NativeDiv className="ni-section-heading"><NativeDiv><NativeSpan className="nw-eyebrow">INTERN IM UNTERNEHMEN</NativeSpan><NativeH2>{review ? 'Übermittlung prüfen' : 'An Mitarbeitende weitergeben'}</NativeH2><NativeP>{review ? 'Diese Angaben werden an die ausgewählten Personen übermittelt.' : 'Gesprächsnotizen, Rückrufbitten, Wünsche und Aufgaben direkt im Mitarbeiterportal bereitstellen.'}</NativeP></NativeDiv><NativeButton className="nw-button" disabled={busy} onClick={onClose}>{uncertain ? 'Ausgang prüfen' : 'Schließen'}</NativeButton></NativeDiv>
    <NativeP className="ni-privacy">Ihre persönliche Notiz bleibt privat. Weitergegeben wird ausschließlich der Inhalt dieser Übermittlung.</NativeP>
    {!!sourceNote?.content.strokes.length && <NativeP className="ni-warning">Handschrift und Zeichnungen werden nicht mitgesendet. Bitte deren Inhalt bei Bedarf als Text ergänzen.</NativeP>}
    {error && <NativeDiv className="nw-notice nw-notice--error" role="alert">{error}</NativeDiv>}
    {uncertain && <NativeP className="ni-warning">Die Bestätigung fehlt. Die erneute Prüfung verwendet dieselbe Übermittlung und legt keine zweite Aufgabe an. Bitte diese Prüfung abschließen. Sollten Sie die Seite trotzdem neu laden, prüfen Sie vor einem erneuten Versand zuerst „Weitergegeben“.</NativeP>}
    {review ? <NativeDiv className="ni-review">
      <NativeDiv className="ni-review-meta"><NativeSpan className="ni-pill">{INTERNAL_NOTE_KINDS.find(item => item.value === draft.kind)?.label}</NativeSpan><NativeSpan className={`ni-pill ${draft.priority === 'high' ? 'ni-pill--high' : ''}`}>{INTERNAL_NOTE_PRIORITIES.find(item => item.value === draft.priority)?.label}</NativeSpan>{draft.dueDate && <NativeSpan>Bis {draft.dueDate.split('-').reverse().join('.')}</NativeSpan>}</NativeDiv>
      <NativeH3>{draft.title}</NativeH3><NativeP className="ni-body">{draft.body}</NativeP>
      <NativeDiv className="ni-review-recipients"><NativeStrong>An {draft.recipientEmployeeIds.length} {draft.recipientEmployeeIds.length === 1 ? 'Person' : 'Personen'}</NativeStrong><NativeDiv className="ni-chips">{selected.map(person => <NativeSpan className="ni-pill" key={person.employeeId}>{person.displayName}</NativeSpan>)}</NativeDiv>{selected.length !== draft.recipientEmployeeIds.length && <NativeP>Ein Teil der ursprünglichen Empfänger ist nicht mehr in der aktuellen Auswahl verfügbar. Die erneute Prüfung verwendet unverändert die ursprüngliche Empfängerliste.</NativeP>}</NativeDiv>
      <NativeDiv className="ni-footer"><NativeButton className="nw-button" disabled={busy || uncertain} onClick={() => setReview(false)}>Angaben bearbeiten</NativeButton><NativeButton className="nw-button nw-button--primary" disabled={busy} onClick={() => void send()}>{busy ? 'Wird übermittelt …' : uncertain ? 'Übermittlung erneut prüfen' : 'Jetzt intern senden'}</NativeButton></NativeDiv>
    </NativeDiv> : <NativeDiv className="ni-compose-grid">
      <NativeDiv className="ni-form">
        <NativeDiv className="ni-field-row"><NativeLabel><NativeSpan>Art des Eintrags</NativeSpan><NativeSelect aria-label="Art der internen Übermittlung" value={draft.kind} onChange={event => change({ kind: event.target.value as InternalNoteDraft['kind'] })}>{INTERNAL_NOTE_KINDS.map(item => <NativeOption value={item.value} key={item.value}>{item.label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel><NativeSpan>Priorität</NativeSpan><NativeSelect aria-label="Priorität der Übermittlung" value={draft.priority} onChange={event => change({ priority: event.target.value as InternalNoteDraft['priority'] })}>{INTERNAL_NOTE_PRIORITIES.map(item => <NativeOption value={item.value} key={item.value}>{item.label}</NativeOption>)}</NativeSelect></NativeLabel></NativeDiv>
        <NativeLabel><NativeSpan>Betreff</NativeSpan><NativeInput aria-label="Betreff der Übermittlung" value={draft.title} maxLength={240} onChange={event => change({ title: event.target.value })} placeholder="Zum Beispiel: Rückruf wegen Terminänderung"/></NativeLabel>
        <NativeLabel><NativeSpan>Inhalt für die Mitarbeitenden</NativeSpan><NativeTextarea aria-label="Inhalt der Übermittlung" value={draft.body} maxLength={20000} rows={12} onChange={event => change({ body: event.target.value })} placeholder="Was ist zu beachten oder zu erledigen?"/><NativeSmall>{draft.body.length.toLocaleString('de-DE')} / 20.000 Zeichen</NativeSmall></NativeLabel>
        <NativeLabel className="ni-date-field"><NativeSpan>Erledigen bis <NativeSmall>optional</NativeSmall></NativeSpan><NativeInput type="date" aria-label="Frist der Übermittlung" value={draft.dueDate} min="0001-01-01" max="9999-12-31" onChange={event => change({ dueDate: event.target.value })}/></NativeLabel>
      </NativeDiv>
      <NativeAside className="ni-recipient-picker" aria-label="Mitarbeitende auswählen"><NativeDiv><NativeH3>Empfänger</NativeH3><NativeP>Bis zu 25 Personen mit aktivem Mitarbeiterportal auswählen.</NativeP></NativeDiv><NativeInput type="search" aria-label="Mitarbeitende suchen" placeholder="Name suchen …" value={query} onChange={event => setQuery(event.target.value)}/>
        <NativeDiv className="ni-selected-count" role="status">{draft.recipientEmployeeIds.length} ausgewählt</NativeDiv>
        {loading ? <NativeP role="status">Mitarbeitende werden geladen …</NativeP> : loadError ? <NativeDiv role="alert"><NativeP>{loadError}</NativeP><NativeButton className="nw-button" onClick={() => setReload(value => value + 1)}>Erneut laden</NativeButton></NativeDiv> : <NativeDiv className="ni-recipient-list">{filtered.length ? filtered.map(person => <NativeLabel className="ni-recipient" key={person.employeeId}><NativeInput type="checkbox" checked={draft.recipientEmployeeIds.includes(person.employeeId)} disabled={!draft.recipientEmployeeIds.includes(person.employeeId) && draft.recipientEmployeeIds.length >= 25} onChange={event => change({ recipientEmployeeIds: event.target.checked ? [...draft.recipientEmployeeIds, person.employeeId] : draft.recipientEmployeeIds.filter(id => id !== person.employeeId) })}/><NativeSpan>{person.displayName}</NativeSpan></NativeLabel>) : <NativeP className="ni-empty">{query ? 'Keine passenden Mitarbeitenden.' : 'Keine Mitarbeitenden mit aktivem Portal verfügbar. Bitte zunächst den Portalzugang im Personalbereich freigeben.'}</NativeP>}</NativeDiv>}
      </NativeAside>
      <NativeDiv className="ni-footer"><NativeP>Die Empfänger können den Eintrag lesen, als erledigt markieren und Ihnen eine Rückmeldung hinterlassen.</NativeP><NativeButton className="nw-button nw-button--primary" disabled={loading || !!loadError} onClick={preview}>Weiter zur Vorschau</NativeButton></NativeDiv>
    </NativeDiv>}
  </NativeSection>;
}
