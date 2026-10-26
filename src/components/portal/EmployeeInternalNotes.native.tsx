// Generated native presentation from src/components/portal/EmployeeInternalNotes.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeStyle,NativeHeader,NativeDiv,NativeSpan,NativeH2,NativeP,NativeButton,NativeStrong,NativeLabel,NativeInput,NativeH3,NativeArticle,NativeForm,NativeH4,NativeSelect,NativeOption,NativeSmall,NativeTextarea,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { listInternalNotes, updateInternalDelivery } from "../../lib/office/notes/internalService.native.ts";
import { INTERNAL_NOTE_KINDS, INTERNAL_NOTE_PRIORITIES, INTERNAL_NOTE_STATUSES } from "../../lib/office/notes/internalModel.native.ts";
import type { InternalDelivery, InternalNote, InternalNoteActor } from "../../lib/office/notes/internalTypes.native.ts";
import { employeeInternalNotesCss } from "./EmployeeInternalNotesStyles.native.ts";
type Filter = 'active' | 'unread' | 'done' | 'all';
type InboxEntry = {
    note: InternalNote;
    delivery: InternalDelivery;
};
const when = (value: string) => new Date(value).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const due = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const label = (items: readonly {
    value: string;
    label: string;
}[], value: string) => items.find(item => item.value === value)?.label ?? value;
const searchable = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLocaleLowerCase('de-DE');
/** A new account, employee mapping, tenant or read-only state drops all previous data and drafts. */
export function EmployeeInternalNotes({ actor }: {
    actor: InternalNoteActor;
}) {
    const { tenantId, userId, roleKey, employeeId, readOnly } = actor;
    const stableActor = useMemo<InternalNoteActor>(() => ({ tenantId, userId, roleKey, employeeId, readOnly }), [tenantId, userId, roleKey, employeeId, readOnly]);
    const scope = JSON.stringify([tenantId, userId, roleKey, employeeId, !!readOnly]);
    return <NativeWorkspaceStyleScope key={scope} css={[employeeInternalNotesCss]}>{<EmployeeInternalNotesInbox key={scope} actor={stableActor}/>}</NativeWorkspaceStyleScope>;
}
function EmployeeInternalNotesInbox({ actor }: {
    actor: InternalNoteActor;
}) {
    const [notes, setNotes] = useState<InternalNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [filter, setFilter] = useState<Filter>('active');
    const [query, setQuery] = useState('');
    const [selection, setSelection] = useState<InboxEntry | null>(null);
    const [status, setStatus] = useState<InternalDelivery['status']>('open');
    const [response, setResponse] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [issue, setIssue] = useState('');
    const [needsReload, setNeedsReload] = useState(false);
    const alive = useRef(true);
    const lock = useRef(false);
    const request = useRef(0);
    const dirty = !!selection && (status !== selection.delivery.status || response !== (selection.delivery.response ?? ''));
    const confirmLeave = useUnsavedWebChanges(dirty, busy);
    useEffect(() => { alive.current = true; return () => { alive.current = false; request.current += 1; }; }, []);
    const fetchNotes = useCallback(async () => {
        const version = ++request.current;
        setLoading(true);
        setLoadError('');
        try {
            const result = await listInternalNotes(actor, 'inbox');
            if (!alive.current || version !== request.current)
                return null;
            if (!result.ok) {
                setLoadError(result.error);
                return null;
            }
            // The service and RLS enforce this boundary too. Never render a foreign delivery.
            const own = result.data.filter(note => note.tenantId === actor.tenantId)
                .map(note => ({ ...note, recipients: note.recipients.filter(recipient => recipient.employeeId === actor.employeeId && recipient.recipientUserId === actor.userId) }))
                .filter(note => note.recipients.length === 1);
            setNotes(own);
            return own;
        }
        catch {
            if (alive.current && version === request.current)
                setLoadError('Die Aufgaben konnten nicht geladen werden. Bitte erneut versuchen.');
            return null;
        }
        finally {
            if (alive.current && version === request.current)
                setLoading(false);
        }
    }, [actor]);
    useEffect(() => { void fetchNotes(); }, [fetchNotes]);
    const adopt = (entry: InboxEntry | null) => {
        setSelection(entry);
        setStatus(entry?.delivery.status ?? 'open');
        setResponse(entry?.delivery.response ?? '');
        setNotice('');
        setIssue('');
        setNeedsReload(false);
    };
    const choose = async (entry: InboxEntry | null) => {
        if (lock.current || entry?.delivery.id === selection?.delivery.id || !(await confirmLeave()) || !alive.current)
            return;
        adopt(entry);
    };
    const reload = async () => {
        if (lock.current || !(await confirmLeave()) || !alive.current)
            return;
        lock.current = true;
        try {
            const current = await fetchNotes();
            if (!alive.current || !current)
                return;
            if (selection) {
                const note = current.find(item => item.id === selection.note.id);
                adopt(note ? { note, delivery: note.recipients[0] } : null);
                setNotice(note ? 'Der gespeicherte Stand wurde geladen.' : 'Dieser Eintrag ist für Ihren Zugang nicht mehr verfügbar.');
            }
        }
        finally {
            lock.current = false;
        }
    };
    const update = async (action: 'read' | 'status') => {
        if (lock.current || !selection || actor.readOnly || needsReload || (action === 'status' && !dirty))
            return;
        const entry = selection;
        lock.current = true;
        setBusy(true);
        setIssue('');
        setNotice('');
        // A list request started earlier may not overwrite a later acknowledged mutation.
        request.current += 1;
        setLoading(false);
        try {
            const result = await updateInternalDelivery(actor, {
                deliveryId: entry.delivery.id, employeeId: entry.delivery.employeeId,
                expectedRevision: entry.delivery.revision, action,
                ...(action === 'status' ? { status, response } : {}),
            });
            if (!alive.current)
                return;
            if (!result.ok) {
                setIssue(result.error);
                setNeedsReload(!!(result.conflict || result.uncertain));
                return;
            }
            const delivery = result.data;
            if (delivery.id !== entry.delivery.id || delivery.employeeId !== actor.employeeId) {
                setIssue('Die Bestätigung konnte Ihrem Eintrag nicht zugeordnet werden. Bitte den gespeicherten Stand laden.');
                setNeedsReload(true);
                return;
            }
            const next = { note: { ...entry.note, recipients: [delivery] }, delivery };
            setSelection(next);
            setNotes(current => current.map(note => note.id === entry.note.id ? next.note : note));
            if (action === 'status') {
                setStatus(delivery.status);
                setResponse(delivery.response ?? '');
            }
            setNotice(action === 'read' ? 'Als gelesen bestätigt. Das Büro sieht Ihre Bestätigung.' : 'Bearbeitungsstand und Rückmeldung wurden gespeichert.');
        }
        catch {
            if (alive.current) {
                setIssue('Die Änderung ist noch nicht bestätigt. Bitte den gespeicherten Stand laden, bevor Sie erneut speichern.');
                setNeedsReload(true);
            }
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    const entries = useMemo(() => notes.map(note => ({ note, delivery: note.recipients[0] }))
        .sort((a, b) => Number(!!a.delivery.readAt) - Number(!!b.delivery.readAt) || b.note.createdAt.localeCompare(a.note.createdAt)), [notes]);
    const unread = entries.filter(item => !item.delivery.readAt).length;
    const active = entries.filter(item => item.delivery.status !== 'done').length;
    const done = entries.length - active;
    const visible = entries.filter(({ note, delivery }) => (filter === 'all' || filter === 'unread' && !delivery.readAt || filter === 'active' && delivery.status !== 'done' || filter === 'done' && delivery.status === 'done')
        && (!query.trim() || searchable(`${note.title} ${note.body} ${note.senderName}`).includes(searchable(query.trim()))));
    const disabled = busy || loading || !!actor.readOnly || needsReload;
    return <NativeWorkspaceStyleScope css={[employeeInternalNotesCss, employeeInternalNotesCss]}>{<NativeSection className="ein" aria-label="Weitergegebene Aufgaben und Notizen" data-employee-internal-notes="web-v1">
    <NativeStyle>{employeeInternalNotesCss}</NativeStyle>
    <NativeHeader className="ein-header">
      <NativeDiv><NativeSpan className="ein-eyebrow">AUS IHREM BÜRO</NativeSpan><NativeH2>Ihr Eingang</NativeH2><NativeP>Hier finden Sie die Informationen und Aufgaben, die Ihnen persönlich zugewiesen wurden.</NativeP></NativeDiv>
      <NativeButton type="button" className="ein-button" disabled={busy || loading} onClick={() => void reload()}>↻ {loading ? 'Wird geladen…' : 'Aktualisieren'}</NativeButton>
    </NativeHeader>
    <NativeDiv className="ein-counts" aria-label="Überblick">
      <NativeDiv><NativeStrong>{(loading || loadError) && !notes.length ? '–' : unread}</NativeStrong><NativeSpan>Ungelesen</NativeSpan></NativeDiv>
      <NativeDiv><NativeStrong>{(loading || loadError) && !notes.length ? '–' : active}</NativeStrong><NativeSpan>In Bearbeitung / offen</NativeSpan></NativeDiv>
      <NativeDiv><NativeStrong>{(loading || loadError) && !notes.length ? '–' : done}</NativeStrong><NativeSpan>Erledigt</NativeSpan></NativeDiv>
    </NativeDiv>
    {actor.readOnly ? <NativeDiv className="ein-notice">Ihr Zugang ist derzeit nur lesend verfügbar. Sobald Ihre Mitarbeiterzuordnung online bestätigt ist, können Sie Rückmeldungen und Bearbeitungsstände speichern.</NativeDiv> : null}
    {notice ? <NativeP className="ein-notice ein-success" role="status">{notice}</NativeP> : null}
    {loadError ? <NativeDiv className="ein-error" role="alert">{loadError}<NativeButton type="button" className="ein-button" disabled={busy || loading} onClick={() => void reload()}>Erneut versuchen</NativeButton></NativeDiv> : null}
    <NativeDiv className={`ein-workspace${selection ? ' ein-has-selection' : ''}`}>
      <NativeDiv className="ein-list-panel">
        <NativeDiv className="ein-filters" aria-label="Eingang filtern">
          {([['active', 'Offen'], ['unread', 'Ungelesen'], ['done', 'Erledigt'], ['all', 'Alle']] as const).map(([value, title]) => <NativeButton key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{title}</NativeButton>)}
        </NativeDiv>
        <NativeLabel className="ein-search"><NativeSpan className="ein-sr">Aufgaben und Notizen durchsuchen</NativeSpan><NativeInput type="search" aria-label="Aufgaben und Notizen durchsuchen" placeholder="Titel, Inhalt oder Absender suchen" value={query} onChange={event => setQuery(event.target.value)}/></NativeLabel>
        <NativeDiv className="ein-list" aria-label="Ihre Einträge" aria-busy={loading}>
          {loading && !notes.length ? <NativeDiv className="ein-empty" role="status"><NativeSpan className="ein-empty-icon">↻</NativeSpan><NativeH3>Eingang wird geladen</NativeH3><NativeP>Ihre persönlichen Zuweisungen werden abgefragt.</NativeP></NativeDiv>
            : loadError && !notes.length ? <NativeDiv className="ein-empty"><NativeSpan className="ein-empty-icon">!</NativeSpan><NativeH3>Eingang nicht verfügbar</NativeH3><NativeP>Bitte versuchen Sie die Abfrage erneut.</NativeP></NativeDiv>
                : !visible.length ? <NativeDiv className="ein-empty"><NativeSpan className="ein-empty-icon">✓</NativeSpan><NativeH3>{query || filter !== 'active' ? 'Keine passenden Einträge' : 'Aktuell nichts offen'}</NativeH3><NativeP>{query || filter !== 'active' ? 'Wählen Sie einen anderen Filter oder Suchbegriff.' : 'Neue Notizen und Aufgaben aus Ihrem Büro erscheinen hier.'}</NativeP></NativeDiv>
                    : visible.map(entry => <NativeButton key={entry.delivery.id} type="button" className={`ein-entry${selection?.delivery.id === entry.delivery.id ? ' ein-selected' : ''}`} aria-pressed={selection?.delivery.id === entry.delivery.id} disabled={busy} onClick={() => void choose(entry)}>
                <NativeSpan className="ein-entry-top"><NativeSpan className="ein-kind">{label(INTERNAL_NOTE_KINDS, entry.note.kind)}</NativeSpan>{!entry.delivery.readAt ? <NativeSpan className="ein-unread">Neu</NativeSpan> : null}</NativeSpan>
                <NativeStrong>{entry.note.title}</NativeStrong><NativeSpan className="ein-preview">{entry.note.body}</NativeSpan>
                <NativeSpan className="ein-sender">{entry.note.senderName} · {when(entry.note.createdAt)}</NativeSpan>
                <NativeSpan className="ein-entry-bottom"><NativeSpan className={`ein-status ein-status-${entry.delivery.status}`}>{label(INTERNAL_NOTE_STATUSES, entry.delivery.status)}</NativeSpan>{entry.note.dueDate ? <NativeSpan>Bis {due(entry.note.dueDate)}</NativeSpan> : null}</NativeSpan>
              </NativeButton>)}
        </NativeDiv>
      </NativeDiv>
      <NativeDiv className="ein-detail-panel">
        {selection ? <NativeArticle aria-label="Geöffneter Eintrag">
          <NativeDiv className="ein-detail-tools"><NativeButton type="button" className="ein-button" disabled={busy} onClick={() => void choose(null)}>← Zur Liste</NativeButton><NativeSpan className="ein-kind">{label(INTERNAL_NOTE_KINDS, selection.note.kind)}</NativeSpan></NativeDiv>
          <NativeH3 className="ein-title">{selection.note.title}</NativeH3>
          <NativeP className="ein-detail-sender">Von <NativeStrong>{selection.note.senderName}</NativeStrong> · {when(selection.note.createdAt)}</NativeP>
          <NativeDiv className="ein-metadata"><NativeSpan className={`ein-status ein-status-${selection.delivery.status}`}>{label(INTERNAL_NOTE_STATUSES, selection.delivery.status)}</NativeSpan><NativeSpan>Priorität: {label(INTERNAL_NOTE_PRIORITIES, selection.note.priority)}</NativeSpan>{selection.note.dueDate ? <NativeSpan>Fällig: {due(selection.note.dueDate)}</NativeSpan> : null}</NativeDiv>
          <NativeDiv className="ein-body">{selection.note.body}</NativeDiv>
          <NativeDiv className="ein-read-state">{selection.delivery.readAt ? <NativeSpan>✓ Gelesen bestätigt am {when(selection.delivery.readAt)}</NativeSpan> : <><NativeSpan>Die Lesebestätigung ist noch offen.</NativeSpan><NativeButton type="button" className="ein-button" disabled={disabled} onClick={() => void update('read')}>Als gelesen bestätigen</NativeButton></>}</NativeDiv>
          <NativeForm className="ein-response" onSubmit={event => { event.preventDefault(); void update('status'); }}>
            <NativeH4>Ihr Bearbeitungsstand</NativeH4><NativeP>Das Büro sieht Ihren Status und Ihre Rückmeldung.</NativeP>
            <NativeLabel><NativeSpan>Status</NativeSpan><NativeSelect aria-label="Bearbeitungsstand" disabled={disabled} value={status} onChange={event => setStatus(event.target.value as InternalDelivery['status'])}>{INTERNAL_NOTE_STATUSES.map(item => <NativeOption key={item.value} value={item.value}>{item.label}</NativeOption>)}</NativeSelect></NativeLabel>
            <NativeLabel><NativeSpan>Rückmeldung <NativeSmall>optional · bis zu 2.000 Zeichen</NativeSmall></NativeSpan><NativeTextarea aria-label="Rückmeldung an das Büro" disabled={disabled} rows={4} maxLength={2000} placeholder="Zum Beispiel: Rückruf erfolgt, nächster Schritt vereinbart …" value={response} onChange={event => setResponse(event.target.value)}/></NativeLabel>
            {issue ? <NativeDiv className="ein-error" role="alert">{issue}{needsReload ? <NativeButton type="button" className="ein-button" disabled={busy || loading} onClick={() => void reload()}>Gespeicherten Stand laden</NativeButton> : null}</NativeDiv> : null}
            <NativeDiv className="ein-save-row"><NativeSpan>{dirty ? 'Noch nicht gespeichert' : `Zuletzt aktualisiert: ${when(selection.delivery.updatedAt)}`}</NativeSpan><NativeButton className="ein-button ein-primary" type="submit" disabled={disabled || !dirty}>{busy ? 'Wird gespeichert…' : 'Rückmeldung speichern'}</NativeButton></NativeDiv>
          </NativeForm>
        </NativeArticle> : <NativeDiv className="ein-empty ein-detail-empty"><NativeSpan className="ein-empty-icon">↗</NativeSpan><NativeH3>Alles Wichtige im Blick</NativeH3><NativeP>Öffnen Sie einen Eintrag, bestätigen Sie den Empfang und halten Sie Ihr Büro über den Fortschritt auf dem Laufenden.</NativeP></NativeDiv>}
      </NativeDiv>
    </NativeDiv>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
