// Generated native presentation from src/components/office/notes/NotesWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSvgPath,NativeSvgCircle} from '@/components/layout/NativeSvgPresentation.native';
import {NativeSection,NativeStyle,NativeHeader,NativeDiv,NativeSpan,NativeH1,NativeP,NativeButton,NativeNav,NativeAside,NativeH2,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeStrong,NativeTime,NativeMain,NativeDetails,NativeSummary,NativeSmall,NativeH3,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { WebActionIcon } from "../../icons/WebActionIcon.native.tsx";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useUnsavedWebChanges } from "../../../hooks/useUnsavedWebChanges.native.ts";
import { confirmAction } from '@/lib/platform/confirmAction';
import type { NoteDraft, NotesActor, NotesResult, OfficeNote } from "../../../lib/office/notes/types.native.ts";
import { createNoteDraft, draftsEqual, newNoteId, NOTE_CATEGORIES, NOTE_FORMATS, NOTE_STATUSES, NOTE_TEMPLATES, notePreview, noteSearchText, noteToDraft, validateNoteDraft } from "../../../lib/office/notes/model.native.ts";
import { deleteNote, listNotes, loadNote, saveNote, setNoteArchived } from "../../../lib/office/notes/service.native.ts";
import { downloadNote } from "../../../lib/office/notes/export.native.ts";
import { NoteEditor } from "./NoteEditor.native.tsx";
import { notesWorkspaceCss } from "./notesWorkspaceCss.native.ts";
import { noteEditorCss } from "./noteEditorCss.native.ts";
import { visualEditorsCss } from "./visualEditorsCss.native.ts";
import { InternalNoteForwarder } from "./InternalNoteForwarder.native.tsx";
import { InternalNotesOutbox } from "./InternalNotesOutbox.native.tsx";
import { internalNotesCss } from "./internalNotesCss.native.ts";
type View = 'active' | 'pinned' | 'tasks' | 'archive';
type PendingOperation = {
    kind: 'save';
    expectedRevision: number | null;
} | {
    kind: 'archive' | 'restore' | 'delete';
    expectedRevision: number;
};
type SaveIssue = {
    message: string;
    needsCheck: boolean;
    checked: boolean;
    server: OfficeNote | null;
    operation?: PendingOperation;
};
const when = (date: string) => new Date(date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
function NoteIcon({ kind = 'note' }: {
    kind?: 'note' | 'plus' | 'search' | 'pin' | 'arrow' | 'save';
}) {
    const paths = { note: <><NativeSvgPath d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><NativeSvgPath d="M9 3v18M12 8h4M12 12h4M12 16h2M3 7h4M3 12h4M3 17h4"/></>, plus: <NativeSvgPath d="M12 5v14M5 12h14"/>, search: <><NativeSvgCircle cx="10" cy="10" r="6"/><NativeSvgPath d="m15 15 5 5"/></>, pin: <NativeSvgPath d="m9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6Zm3 12v6"/>, arrow: <NativeSvgPath d="m14 5-7 7 7 7M7 12h14"/>, save: <><NativeSvgPath d="M5 3h12l4 4v14H3V3h2ZM7 3v6h10V3M7 21v-8h10v8"/></> };
    return <WebActionIcon>{paths[kind]}</WebActionIcon>;
}
/** Remount on account, organisation or access changes; never retain another person's draft. */
export function NotesWorkspace({ actor }: {
    actor: NotesActor;
}) {
    const { tenantId, userId, roleKey } = actor;
    const permissionKey = actor.permissions === undefined ? undefined : [...new Set(actor.permissions)].sort().join(',');
    const stableActor = useMemo<NotesActor>(() => ({ tenantId, userId, roleKey,
        permissions: permissionKey === undefined ? undefined : permissionKey ? permissionKey.split(',') as NotesActor['permissions'] : [],
    }), [tenantId, userId, roleKey, permissionKey]);
    const scope = JSON.stringify([tenantId, userId, roleKey, permissionKey]);
    return <PersonalNotesWorkspace key={scope} actor={stableActor}/>;
}
function PersonalNotesWorkspace({ actor }: {
    actor: NotesActor;
}) {
    const router = useRouter();
    const [notes, setNotes] = useState<OfficeNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [query, setQuery] = useState('');
    const [view, setView] = useState<View>('active');
    const [category, setCategory] = useState('all');
    const [status, setStatus] = useState('all');
    const [templatesOpen, setTemplatesOpen] = useState(false);
    const [base, setBase] = useState<OfficeNote | null>(null);
    const [draft, setDraft] = useState<NoteDraft | null>(null);
    const [draftId, setDraftId] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [issue, setIssue] = useState<SaveIssue | null>(null);
    const [area, setArea] = useState<'personal' | 'sent'>('personal');
    const [forwarding, setForwarding] = useState<{
        note?: NoteDraft;
    } | null>(null);
    const [forwardHidden, setForwardHidden] = useState(false);
    const [forwardState, setForwardState] = useState({ dirty: false, busy: false, uncertain: false });
    const [sentRefresh, setSentRefresh] = useState(0);
    const alive = useRef(true);
    const lock = useRef(false);
    const listRequest = useRef(0);
    const dirty = !!draft && (!base || !draftsEqual(draft, noteToDraft(base)));
    const confirmLeave = useUnsavedWebChanges(dirty || forwardState.dirty, busy || forwardState.busy);
    const canForward = actor.permissions === undefined || actor.permissions.includes('communication.send_message');
    useEffect(() => { alive.current = true; return () => { alive.current = false; listRequest.current += 1; }; }, []);
    const refresh = useCallback(async () => {
        const request = ++listRequest.current;
        setLoading(true);
        setListError('');
        let result: NotesResult<OfficeNote[]>;
        try {
            result = await listNotes(actor);
        }
        catch {
            result = { ok: false, error: 'Die Notizen konnten nicht geladen werden. Bitte erneut versuchen.' };
        }
        if (!alive.current || request !== listRequest.current)
            return;
        if (result.ok)
            setNotes(result.data);
        else
            setListError(result.error);
        setLoading(false);
    }, [actor]);
    useEffect(() => { void refresh(); }, [refresh]);
    const upsert = (note: OfficeNote) => { listRequest.current += 1; setLoading(false); setNotes(current => [note, ...current.filter(item => item.id !== note.id)]); };
    const adopt = (note: OfficeNote) => { setBase(note); setDraft(noteToDraft(note)); setDraftId(note.id); setTemplatesOpen(false); setIssue(null); upsert(note); };
    const start = async (template = 'blank') => {
        if (lock.current || !(await confirmLeave()) || !alive.current)
            return;
        setArea('personal');
        setBase(null);
        setDraft(createNoteDraft(template));
        setDraftId(newNoteId());
        setTemplatesOpen(false);
        setIssue(null);
        setNotice('');
    };
    const open = async (note: OfficeNote) => {
        if (lock.current || note.id === draftId || !(await confirmLeave()) || !alive.current)
            return;
        // Always read the current revision when reopening an entry, even when the list is older.
        lock.current = true;
        setBusy(true);
        setNotice('');
        try {
            const result = await loadNote(actor, note.id);
            if (!alive.current)
                return;
            if (result.ok && result.data)
                adopt(result.data);
            else
                setNotice(result.ok ? 'Diese Notiz ist nicht mehr verfügbar. Bitte die Liste aktualisieren.' : result.error);
        }
        catch {
            if (alive.current)
                setNotice('Die Notiz konnte nicht geöffnet werden. Bitte erneut versuchen.');
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    const close = async () => { if (lock.current || !(await confirmLeave()) || !alive.current)
        return; setDraft(null); setBase(null); setDraftId(''); setTemplatesOpen(false); setIssue(null); setNotice(''); };
    const chooseTemplates = async () => { if (lock.current || !(await confirmLeave()) || !alive.current)
        return; setArea('personal'); setDraft(null); setBase(null); setDraftId(''); setTemplatesOpen(true); setIssue(null); setNotice(''); };
    const persist = async () => {
        if (lock.current || !draft || !dirty || base?.archivedAt || issue?.needsCheck)
            return;
        const invalid = validateNoteDraft(draft);
        if (invalid) {
            setIssue({ message: invalid, needsCheck: false, checked: false, server: null });
            return;
        }
        const operation: PendingOperation = { kind: 'save', expectedRevision: base?.revision ?? null };
        lock.current = true;
        setBusy(true);
        setNotice('');
        setIssue(null);
        try {
            const result = await saveNote(actor, { id: draftId, expectedRevision: base?.revision ?? null, draft });
            if (!alive.current)
                return;
            if (result.ok) {
                adopt(result.data);
                setNotice('Notiz gespeichert.');
            }
            else
                setIssue({ message: result.error, needsCheck: !!(result.conflict || result.uncertain), checked: false, server: null, operation });
        }
        catch {
            if (alive.current)
                setIssue({ message: 'Die Speicherbestätigung fehlt. Ihr Entwurf bleibt erhalten. Bitte den Speicherstand prüfen.', needsCheck: true, checked: false, server: null, operation });
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    const checkServer = async () => {
        if (lock.current || !draft)
            return;
        const operation = issue?.operation ?? { kind: 'save' as const, expectedRevision: base?.revision ?? null };
        lock.current = true;
        setBusy(true);
        try {
            const result = await loadNote(actor, draftId);
            if (!alive.current)
                return;
            if (!result.ok) {
                setIssue(current => ({ message: result.error, needsCheck: true, checked: false, server: current?.server ?? null, operation }));
                return;
            }
            const server = result.data;
            if (operation.kind === 'delete') {
                if (!server) {
                    listRequest.current += 1;
                    setLoading(false);
                    setNotes(current => current.filter(item => item.id !== draftId));
                    setDraft(null);
                    setBase(null);
                    setDraftId('');
                    setIssue(null);
                    setNotice('Löschung bestätigt. Die Notiz ist nicht mehr vorhanden.');
                    return;
                }
                if (server.revision === operation.expectedRevision && server.archivedAt) {
                    adopt(server);
                    setNotice('Die Notiz ist noch vorhanden. Sie können die Löschung erneut versuchen.');
                    return;
                }
            }
            else if (operation.kind === 'archive' || operation.kind === 'restore') {
                const archived = operation.kind === 'archive';
                if (server && Boolean(server.archivedAt) === archived && server.revision > operation.expectedRevision) {
                    adopt(server);
                    setView(archived ? 'archive' : 'active');
                    setNotice(archived ? 'Archivierung bestätigt. Die Notiz liegt im Archiv.' : 'Wiederherstellung bestätigt. Die Notiz ist wieder aktiv.');
                    return;
                }
                if (server && server.revision === operation.expectedRevision && Boolean(server.archivedAt) !== archived) {
                    adopt(server);
                    setNotice(archived ? 'Die Notiz ist noch aktiv. Sie können die Archivierung erneut versuchen.' : 'Die Notiz liegt weiterhin im Archiv. Sie können die Wiederherstellung erneut versuchen.');
                    return;
                }
            }
            else {
                const expectedRevision = operation.expectedRevision === null ? 1 : operation.expectedRevision + 1;
                if (server && !server.archivedAt && server.revision === expectedRevision && draftsEqual(draft, noteToDraft(server))) {
                    adopt(server);
                    setNotice('Speicherstand bestätigt. Ihre Notiz ist gespeichert.');
                    return;
                }
                if (!server && operation.expectedRevision === null) {
                    setIssue(null);
                    setNotice('Diese neue Notiz ist noch nicht gespeichert. Sie können das Speichern erneut versuchen.');
                    return;
                }
                if (server && base && server.revision === operation.expectedRevision && !server.archivedAt && draftsEqual(noteToDraft(base), noteToDraft(server))) {
                    setIssue(null);
                    setNotice('Die Änderungen sind noch nicht gespeichert. Ihr Entwurf bleibt erhalten. Sie können das Speichern erneut versuchen.');
                    return;
                }
            }
            setIssue({ message: server ? 'Der gespeicherte Stand hat sich geändert. Vergleichen Sie beide Fassungen.' : 'Die ursprüngliche Notiz ist nicht mehr verfügbar. Ihr Entwurf bleibt erhalten und kann als neue Notiz gespeichert werden.', needsCheck: true, checked: true, server, operation });
        }
        catch {
            if (alive.current)
                setIssue({ message: 'Der Speicherstand konnte nicht geprüft werden. Ihr Entwurf bleibt erhalten.', needsCheck: true, checked: false, server: null, operation });
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    const useServer = async () => {
        if (lock.current || !issue?.server)
            return;
        const server = issue.server;
        if (!(await confirmAction({ title: 'Gespeicherten Stand übernehmen?', message: 'Ihr aktueller Entwurf wird durch die gespeicherte Fassung ersetzt.', confirmLabel: 'Stand übernehmen' })) || !alive.current)
            return;
        adopt(server);
        setNotice('Gespeicherter Stand geladen.');
    };
    const copyDraft = () => { if (lock.current || !draft)
        return; setDraft({ ...draft, title: `${draft.title.slice(0, 230)} – Kopie` }); setBase(null); setDraftId(newNoteId()); setIssue(null); setNotice('Kopie erstellt. Bitte speichern, um sie zu behalten.'); };
    const archive = async (archived: boolean) => {
        if (lock.current || !base || dirty)
            return;
        const operation: PendingOperation = { kind: archived ? 'archive' : 'restore', expectedRevision: base.revision };
        lock.current = true;
        setBusy(true);
        setNotice('');
        setIssue(null);
        try {
            const result = await setNoteArchived(actor, base, archived);
            if (!alive.current)
                return;
            if (result.ok) {
                adopt(result.data);
                setView(archived ? 'archive' : 'active');
                setNotice(archived ? 'Notiz archiviert. Sie können sie jederzeit wiederherstellen.' : 'Notiz wiederhergestellt.');
            }
            else
                setIssue({ message: result.error, needsCheck: !!(result.conflict || result.uncertain), checked: false, server: null, operation });
        }
        catch {
            if (alive.current)
                setIssue({ message: 'Die Änderung wurde noch nicht bestätigt. Bitte den Speicherstand prüfen.', needsCheck: true, checked: false, server: null, operation });
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    const remove = async () => {
        if (lock.current || !base?.archivedAt)
            return;
        if (!(await confirmAction({ title: 'Notiz endgültig löschen?', message: `„${base.title || 'Ohne Titel'}“ wird dauerhaft gelöscht. Dies kann nicht rückgängig gemacht werden.`, confirmLabel: 'Endgültig löschen' })) || !alive.current || lock.current)
            return;
        const operation: PendingOperation = { kind: 'delete', expectedRevision: base.revision };
        lock.current = true;
        setBusy(true);
        setNotice('');
        try {
            const result = await deleteNote(actor, base.id, base.revision);
            if (!alive.current)
                return;
            if (result.ok) {
                listRequest.current += 1;
                setLoading(false);
                setNotes(current => current.filter(item => item.id !== base.id));
                setDraft(null);
                setBase(null);
                setDraftId('');
                setIssue(null);
                setNotice('Notiz gelöscht.');
            }
            else
                setIssue({ message: result.error, needsCheck: !!(result.conflict || result.uncertain), checked: false, server: null, operation });
        }
        catch {
            if (alive.current)
                setIssue({ message: 'Die Löschung ist noch nicht bestätigt. Bitte den Speicherstand prüfen.', needsCheck: true, checked: false, server: null, operation });
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    const exportDraft = async (format: 'markdown' | 'json') => { if (!draft)
        return; try {
        await downloadNote(draft, format);
        setNotice(format === 'json' ? 'Notizdatei mit allen Inhalten heruntergeladen.' : 'Textfassung heruntergeladen. Zeichendaten sind in der Notizdatei enthalten.');
    }
    catch {
        setNotice('Die Datei konnte nicht heruntergeladen werden. Bitte erneut versuchen.');
    } };
    const active = notes.filter(note => !note.archivedAt);
    const visible = useMemo(() => {
        const needle = query.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLocaleLowerCase('de-DE');
        return notes.filter(note => (view === 'archive' ? !!note.archivedAt : !note.archivedAt)
            && (view !== 'pinned' || note.pinned)
            && (view !== 'tasks' || note.content.tasks.some(task => task.status !== 'done') || (['tasks', 'next_steps'].includes(note.category) && note.status !== 'done'))
            && (category === 'all' || note.category === category) && (status === 'all' || note.status === status)
            && (!needle || noteSearchText(note).toLocaleLowerCase('de-DE').includes(needle)))
            .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    }, [notes, view, query, category, status]);
    const pendingTasks = active.reduce((count, note) => count + note.content.tasks.filter(task => task.status !== 'done').length, 0);
    const filtered = !!query || category !== 'all' || status !== 'all' || view !== 'active';
    const beginForward = (source?: NoteDraft) => { if (lock.current || !canForward)
        return; setNotice(''); setForwardHidden(false); if (forwarding)
        return; setForwardState({ dirty: false, busy: false, uncertain: false }); setForwarding(source ? { note: structuredClone(source) } : {}); };
    const closeForward = async () => {
        if (forwardState.uncertain) {
            setForwardHidden(true);
            setArea('sent');
            return;
        }
        if (forwardState.busy)
            return;
        if (forwardState.dirty && !(await confirmAction({ title: 'Übermittlung verwerfen?', message: 'Der noch nicht gesendete Inhalt wird verworfen. Ihre persönliche Notiz bleibt erhalten.', confirmLabel: 'Übermittlung schließen', cancelLabel: 'Weiter bearbeiten' })))
            return;
        if (!alive.current)
            return;
        setForwarding(null);
        setForwardState({ dirty: false, busy: false, uncertain: false });
    };
    return <NativeWorkspaceStyleScope css={[notesWorkspaceCss + noteEditorCss + visualEditorsCss + internalNotesCss]}>{<NativeSection className="nw" aria-label="Persönliche Notizen" data-cs-office-notes="private-workspace-v1" onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!forwarding && area === 'personal')
            void persist();
    } }}>
    <NativeStyle>{notesWorkspaceCss + noteEditorCss + visualEditorsCss + internalNotesCss}</NativeStyle>
    <NativeHeader className="nw-header"><NativeDiv className="nw-title"><NativeSpan className="nw-title-icon"><NoteIcon /></NativeSpan><NativeDiv><NativeDiv className="nw-eyebrow">OFFICE · NOTIZEN & INTERNE AUFGABEN</NativeDiv><NativeH1>Notizen</NativeH1><NativeP>Festhalten, ordnen und gezielt weitergeben.</NativeP></NativeDiv></NativeDiv><NativeDiv className="nw-actions"><NativeSpan className="nw-private">{forwarding || area === 'sent' ? 'Intern im Unternehmen' : 'Nur für Sie'}</NativeSpan><NativeButton className="nw-button" disabled={busy || forwardState.busy} onClick={() => router.replace('/Desktop' as never)}><NoteIcon kind="arrow"/>Desktop</NativeButton><NativeButton className="nw-button" disabled={busy || !!forwarding} onClick={() => void chooseTemplates()}>Vorlagen</NativeButton><NativeButton className="nw-button nw-button--primary" disabled={busy || !!forwarding} onClick={() => void start()}><NoteIcon kind="plus"/>Neue Notiz</NativeButton></NativeDiv></NativeHeader>
    <NativeNav className="ni-area-tabs" aria-label="Notizenbereiche"><NativeButton disabled={busy || !!forwarding} aria-pressed={area === 'personal'} onClick={() => setArea('personal')}>Meine Notizen</NativeButton><NativeButton disabled={busy || !!forwarding} aria-pressed={area === 'sent'} onClick={() => setArea('sent')}>Weitergegeben</NativeButton></NativeNav>
    {forwarding && <NativeDiv className="ni-forward-host" hidden={forwardHidden}><InternalNoteForwarder actor={actor} sourceNote={forwarding.note} onStateChange={setForwardState} onClose={() => void closeForward()} onSent={() => { setForwarding(null); setForwardHidden(false); setForwardState({ dirty: false, busy: false, uncertain: false }); setArea('sent'); setSentRefresh(value => value + 1); setNotice('Die interne Übermittlung wurde gespeichert und ist im Mitarbeiterportal verfügbar.'); }}/></NativeDiv>}
    {area === 'sent' && (!forwarding || forwardHidden) ? <>{forwarding && <NativeDiv className="nw-notice" role="status">Die Bestätigung Ihrer Übermittlung steht noch aus.<NativeButton className="nw-button" onClick={() => setForwardHidden(false)}>Übermittlung fortsetzen</NativeButton></NativeDiv>}{notice && <NativeDiv className="nw-notice" role="status">{notice}<NativeButton className="nw-text-button" aria-label="Hinweis schließen" onClick={() => setNotice('')}>×</NativeButton></NativeDiv>}<InternalNotesOutbox actor={actor} refreshKey={sentRefresh} canCompose={canForward && !forwarding} onCompose={() => beginForward()}/></> : null}
    <NativeDiv className="nw-layout" hidden={!!forwarding || area !== 'personal'} data-selected={!!draft || templatesOpen}>
      <NativeAside className="nw-sidebar" aria-label="Notizübersicht"><NativeDiv className="nw-sidebar-top"><NativeDiv className="nw-list-title"><NativeH2>Mein Notizbuch</NativeH2><NativeSpan>{active.length}</NativeSpan></NativeDiv><NativeLabel className="nw-search"><NoteIcon kind="search"/><NativeInput type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Notizen durchsuchen …" aria-label="Notizen durchsuchen"/></NativeLabel><NativeDiv className="nw-view-tabs" role="group" aria-label="Notizen filtern">{([['active', 'Alle'], ['pinned', 'Angeheftet'], ['tasks', 'Aufgaben'], ['archive', 'Archiv']] as const).map(([value, label]) => <NativeButton key={value} aria-pressed={view === value} onClick={() => setView(value)}>{label}</NativeButton>)}</NativeDiv><NativeDiv className="nw-list-filters"><NativeLabel><NativeSpan>Kategorie</NativeSpan><NativeSelect value={category} onChange={event => setCategory(event.target.value)} aria-label="Nach Kategorie filtern"><NativeOption value="all">Alle Kategorien</NativeOption>{NOTE_CATEGORIES.map(item => <NativeOption key={item.value} value={item.value}>{item.label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel><NativeSpan>Status</NativeSpan><NativeSelect value={status} onChange={event => setStatus(event.target.value)} aria-label="Nach Status filtern"><NativeOption value="all">Jeder Status</NativeOption>{NOTE_STATUSES.map(item => <NativeOption key={item.value} value={item.value}>{item.label}</NativeOption>)}</NativeSelect></NativeLabel></NativeDiv><NativeDiv className="nw-list-meta"><NativeSpan>{visible.length} {visible.length === 1 ? 'Notiz' : 'Notizen'}{pendingTasks > 0 ? ` · ${pendingTasks} offene Aufgaben` : ''}</NativeSpan><NativeButton className="nw-text-button" onClick={() => void refresh()} disabled={loading || busy}>Aktualisieren</NativeButton></NativeDiv></NativeDiv>
        {listError && <NativeDiv className="nw-notice nw-notice--error" role="alert">{listError}<NativeButton className="nw-text-button" disabled={loading} onClick={() => void refresh()}>Erneut versuchen</NativeButton></NativeDiv>}
        <NativeDiv className="nw-notes-list" aria-busy={loading}>{loading && !notes.length ? <NativeDiv className="nw-list-empty" role="status">Notizen werden geladen …</NativeDiv> : visible.length === 0 ? <NativeDiv className="nw-list-empty"><NoteIcon /><NativeStrong>{listError ? 'Notizen nicht geladen' : filtered ? 'Keine passenden Notizen' : 'Platz für Ihre Gedanken'}</NativeStrong><NativeP>{listError ? 'Bitte versuchen Sie die Abfrage erneut.' : filtered ? 'Passen Sie die Suche oder die Filter an.' : 'Beginnen Sie mit einer freien Notiz oder einer Vorlage.'}</NativeP>{filtered && <NativeButton className="nw-button" onClick={() => { setQuery(''); setCategory('all'); setStatus('all'); setView('active'); }}>Filter zurücksetzen</NativeButton>}{!filtered && !listError && <NativeButton className="nw-button" disabled={busy} onClick={() => void chooseTemplates()}>Vorlage auswählen</NativeButton>}</NativeDiv> : visible.map(note => <NativeButton key={note.id} className="nw-note-card" aria-current={draftId === note.id ? 'true' : undefined} disabled={busy} onClick={() => void open(note)}><NativeSpan className="nw-note-top"><NativeSpan className={`nw-category-dot nw-category-dot--${note.category}`} aria-hidden="true"/><NativeSpan>{NOTE_CATEGORIES.find(item => item.value === note.category)?.label}</NativeSpan>{note.pinned && <NativeSpan className="nw-pin" aria-label="Angeheftet"><NoteIcon kind="pin"/></NativeSpan>}</NativeSpan><NativeStrong>{note.title || 'Ohne Titel'}</NativeStrong><NativeSpan className="nw-note-preview">{notePreview(note) || 'Ohne weiteren Text'}</NativeSpan><NativeSpan className="nw-note-meta"><NativeSpan className={`nw-status nw-status--${note.status}`}>{NOTE_STATUSES.find(item => item.value === note.status)?.label}</NativeSpan><NativeTime dateTime={note.updatedAt}>{new Date(note.updatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</NativeTime></NativeSpan>{note.dueDate && <NativeSpan className="nw-note-date">Frist: {note.dueDate.split('-').reverse().join('.')}</NativeSpan>}{draftId === note.id && dirty && <NativeSpan className="nw-unsaved-dot">Ungespeicherte Änderungen</NativeSpan>}</NativeButton>)}</NativeDiv><NativeDiv className="nw-sidebar-footer">Persönliche Notizen in Ihrem Unternehmenskonto.</NativeDiv>
      </NativeAside>
      <NativeMain className="nw-main">
        {notice && <NativeDiv className="nw-notice" role="status">{notice}<NativeButton className="nw-text-button" aria-label="Hinweis schließen" onClick={() => setNotice('')}>×</NativeButton></NativeDiv>}
        {draft ? <><NativeDiv className="nw-editor-toolbar"><NativeDiv className="nw-actions"><NativeButton className="nw-button nw-mobile-back" disabled={busy} onClick={() => void close()}><NoteIcon kind="arrow"/>Liste</NativeButton><NativeSpan className={`nw-save-state ${dirty ? 'is-dirty' : ''}`}>{busy ? 'Wird verarbeitet …' : base?.archivedAt ? 'Archiviert' : dirty ? 'Noch nicht gespeichert' : 'Gespeichert'}</NativeSpan>{base && <NativeSpan className="nw-updated">{when(base.updatedAt)}</NativeSpan>}</NativeDiv><NativeDiv className="nw-actions"><NativeButton className="nw-button" disabled={busy || !canForward || !!issue?.needsCheck} title={canForward ? "Ausgewählten Inhalt prüfen und intern übermitteln" : "Ihr Zugang ist nicht für interne Übermittlungen freigegeben"} onClick={() => beginForward(draft)}>Intern weitergeben</NativeButton><NativeButton className="nw-button" disabled={busy || (!!issue?.needsCheck && !issue.checked)} onClick={copyDraft}>Kopie</NativeButton><NativeDetails className="nw-export"><NativeSummary>Exportieren</NativeSummary><NativeDiv><NativeButton onClick={async () => await exportDraft('markdown')}>Text herunterladen (.md)</NativeButton><NativeButton onClick={async () => await exportDraft('json')}>Alle Inhalte herunterladen (.json)</NativeButton></NativeDiv></NativeDetails>{base?.archivedAt ? <><NativeButton className="nw-button" disabled={busy || !!issue?.needsCheck} onClick={() => void archive(false)}>Wiederherstellen</NativeButton><NativeButton className="nw-button nw-button--danger" disabled={busy || !!issue?.needsCheck} onClick={() => void remove()}>Löschen</NativeButton></> : <>{base && <NativeButton className="nw-button" title={dirty ? 'Bitte Änderungen zuerst speichern.' : 'Ins Archiv verschieben'} disabled={busy || dirty || !!issue?.needsCheck} onClick={() => void archive(true)}>Archivieren</NativeButton>}<NativeButton className="nw-button nw-button--primary" disabled={busy || !dirty || !!issue?.needsCheck} onClick={() => void persist()}><NoteIcon kind="save"/>{busy ? 'Bitte warten …' : 'Speichern'}</NativeButton></>}</NativeDiv></NativeDiv>
          {issue && <NativeDiv className="nw-save-issue" role="alert"><NativeStrong>{issue.message}</NativeStrong>{issue.needsCheck && <><NativeP>Ihr Entwurf bleibt geöffnet. Es wird nichts automatisch überschrieben.</NativeP><NativeDiv className="nw-actions"><NativeButton className="nw-button" disabled={busy} onClick={() => void checkServer()}>Speicherstand prüfen</NativeButton>{issue.checked && <NativeButton className="nw-button" disabled={busy} onClick={copyDraft}>Als Kopie weiterbearbeiten</NativeButton>}</NativeDiv>{issue.server && <NativeDiv className="nw-server-version"><NativeStrong>Gespeicherte Fassung: {issue.server.title || 'Ohne Titel'}</NativeStrong><NativeSmall>{when(issue.server.updatedAt)}</NativeSmall><NativeDetails><NativeSummary>Gespeicherte Fassung anzeigen</NativeSummary><NativeDiv className="nw-server-preview"><NoteEditor draft={noteToDraft(issue.server)} onChange={() => { }} disabled/></NativeDiv></NativeDetails><NativeButton className="nw-button" disabled={busy} onClick={() => void useServer()}>Gespeicherten Stand übernehmen</NativeButton></NativeDiv>}</>}</NativeDiv>}
          <NativeDiv className="nw-editor-scroll"><NoteEditor key={draftId} draft={draft} onChange={next => { if (!lock.current && !base?.archivedAt) {
            setDraft(next);
            if (!issue?.needsCheck)
                setIssue(null);
            setNotice('');
        } }} disabled={busy || !!base?.archivedAt || !!issue?.needsCheck}/><NativeDiv className="nw-editor-footnote">{base?.archivedAt ? 'Zum Bearbeiten können Sie diese Notiz wiederherstellen oder eine Kopie erstellen.' : 'Speichern mit Strg + S / ⌘ + S. Notizen und Fristen lösen keine automatischen Erinnerungen aus.'}</NativeDiv></NativeDiv></> : <NativeDiv className="nw-welcome-scroll"><NativeButton className="nw-button nw-mobile-back" onClick={() => void close()}><NoteIcon kind="arrow"/>Zur Liste</NativeButton><NativeDiv className="nw-welcome"><NativeSpan className="nw-welcome-icon"><NoteIcon /></NativeSpan><NativeSpan className="nw-eyebrow">KOPF FREI. ALLES AN EINEM ORT.</NativeSpan><NativeH2>{templatesOpen ? 'Wie möchten Sie anfangen?' : 'Wichtiges bleibt festgehalten.'}</NativeH2><NativeP>Kontakte, Aufgaben, Entscheidungen oder eine spontane Idee: Wählen Sie eine Vorlage und schreiben Sie in Ihren eigenen Worten.</NativeP><NativeButton className="nw-button nw-button--primary" disabled={busy} onClick={() => void start()}><NoteIcon kind="plus"/>Freie Notiz beginnen</NativeButton></NativeDiv><NativeDiv className="nw-template-heading"><NativeH3>Vorlagen für Ihren Alltag</NativeH3><NativeSpan>Direkt ausfüllen und anpassen</NativeSpan></NativeDiv><NativeDiv className="nw-template-grid">{NOTE_TEMPLATES.filter(template => template.id !== 'blank').map(template => <NativeButton className="nw-template-card" key={template.id} disabled={busy} onClick={() => void start(template.id)}><NativeSpan className={`nw-category-dot nw-category-dot--${template.category}`} aria-hidden="true"/><NativeStrong>{template.label}</NativeStrong><NativeP>{template.description}</NativeP><NativeSpan>{NOTE_FORMATS.find(format => format.value === template.format)?.label} <NativeSpan aria-hidden="true">↗</NativeSpan></NativeSpan></NativeButton>)}</NativeDiv><NativeP className="nw-tip"><NativeStrong>Kurz reicht.</NativeStrong> Stichworte, eigene Formulierungen und klare nächste Schritte machen Ihre Notizen später leichter nutzbar.</NativeP></NativeDiv>}
      </NativeMain>
    </NativeDiv>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
