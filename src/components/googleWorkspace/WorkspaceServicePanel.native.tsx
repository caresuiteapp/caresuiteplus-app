// Generated native presentation from src/components/googleWorkspace/WorkspaceServicePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeSection,NativeDiv,NativeSpan,NativeH2,NativeP,NativeButton,NativeA,NativeForm,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeStrong,NativeH3,NativePre} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import { useEffect, useRef, useState } from 'react';
import { invokeGoogleWorkspaceAction as invoke, type GoogleWorkspaceConnection } from '@/lib/googleWorkspace/googleWorkspaceService';
import { useWorkspacePage, refreshWorkspaceData } from "../../hooks/useGoogleWorkspace.native.ts";
import { googleTime, plainMail, serviceDefinition, type WorkspaceItem, type WorkspaceService } from '@/lib/googleWorkspace/workspaceModel';
import type { WorkspaceFilter } from '@/lib/googleWorkspace/workspaceData';
import { WorkspaceActionForm } from "./WorkspaceActionForm.native.tsx";
export function WorkspaceServicePanel({ service, connection, scope }: {
    service: WorkspaceService;
    connection: GoogleWorkspaceConnection;
    scope: string;
}) {
    const definition = serviceDefinition(service);
    const [filter, setFilter] = useState<WorkspaceFilter>({});
    const [draft, setDraft] = useState({ query: '', from: '', to: '' });
    const [filterError, setFilterError] = useState('');
    const [pages, setPages] = useState<string[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [form, setForm] = useState(false);
    const [chatItem, setChatItem] = useState<WorkspaceItem>();
    const [success, setSuccess] = useState<{
        message: string;
        url?: string;
    } | null>(null);
    const [lists, setLists] = useState<{
        id: string;
        title: string;
    }[]>([]);
    const [listError, setListError] = useState('');
    const [listAttempt, setListAttempt] = useState(0);
    const needsDrive = ['docs', 'sheets', 'slides'].includes(service);
    const enabled = connection.capabilities[service] && (!needsDrive || connection.capabilities.drive);
    const result = useWorkspacePage(service, filter, enabled, connection.connectedAt ?? connection.email ?? '');
    const resetFilter = (next: WorkspaceFilter) => { setFilter(next); setPages([]); setSelected(null); };
    useEffect(() => {
        if (service !== 'tasks' || !enabled)
            return;
        let active = true;
        setListError('');
        const load = async () => { let next: string | undefined; const all: {
            id: string;
            title: string;
        }[] = []; do {
            const page: any = await invoke('tasks_lists', { pageToken: next });
            all.push(...(page.items ?? []));
            next = page.nextPageToken;
        } while (next && active); if (active)
            setLists(all); };
        void load().catch(e => { if (active)
            setListError(e.message); });
        return () => { active = false; };
    }, [service, enabled, listAttempt]);
    const saved = (message: string, url?: string) => { setForm(false); setChatItem(undefined); setSuccess({ message, url }); refreshWorkspaceData(scope); };
    return <NativeSection className="cs-w-stack" aria-label={definition.title}>
    <NativeDiv className="cs-w-row cs-w-between"><NativeDiv className="cs-w-row cs-w-service-identity"><NativeSpan className="cs-w-icon" style={{ color: definition.color }} aria-hidden="true">{definition.glyph}</NativeSpan><NativeDiv className="cs-w-service-title"><NativeH2>{definition.title}</NativeH2><NativeP className="cs-w-muted">{definition.description}</NativeP></NativeDiv></NativeDiv><NativeDiv className="cs-w-row"><NativeButton className="cs-w-button" disabled={!enabled || result.loading} onClick={() => void result.refresh()}>Aktualisieren</NativeButton>{service !== 'chat' && <NativeButton className="cs-w-button primary" disabled={!connection.capabilities[service]} onClick={() => { setForm(true); setSuccess(null); }}><WebActionIcon size={18}><NativeSvgPath d="M12 5v14M5 12h14"/></WebActionIcon>{service === 'gmail' ? 'E-Mail schreiben' : service === 'drive' ? 'Hinzufügen' : 'Neu erstellen'}</NativeButton>}</NativeDiv></NativeDiv>
    {success && <NativeDiv role="status" className="cs-w-notice success">{success.message}{success.url && <> <NativeA href={success.url} target="_blank" rel="noopener noreferrer">In Google öffnen ↗</NativeA></>}</NativeDiv>}
    {form && <WorkspaceActionForm service={service} taskListId={filter.taskListId} item={chatItem} onSaved={saved} onCancel={() => { setForm(false); setChatItem(undefined); }}/>}
    {!enabled ? <NativeDiv className="cs-w-notice">{needsDrive && connection.capabilities[service] ? 'Zum Auflisten Ihrer Dateien fehlt die Google-Drive-Freigabe. Neue Dateien können Sie oben erstellen.' : `Die Google-Freigabe für ${definition.title} fehlt.`} Erteilen Sie die fehlenden Berechtigungen über „Freigaben verwalten“.</NativeDiv> : <>
      {filterError && <NativeP role="alert" className="cs-w-notice error">{filterError}</NativeP>}<NativeForm className="cs-w-filter" onSubmit={e => { e.preventDefault(); if (draft.from && draft.to && draft.from > draft.to) {
            setFilterError('Das Ende muss am oder nach dem Beginn liegen.');
            return;
        } setFilterError(''); resetFilter({ ...filter, pageToken: undefined, ...draft }); }}>
        {['gmail', 'drive', 'docs', 'sheets', 'slides'].includes(service) && <NativeLabel className="cs-w-field search">{service === 'gmail' ? 'Postfach durchsuchen' : 'Dateiname suchen'}<NativeInput type="search" name="query" value={draft.query} onChange={e => setDraft(previous => ({ ...previous, query: e.target.value }))} placeholder={service === 'gmail' ? 'z. B. is:unread oder from:name@firma.de' : 'Dateiname eingeben …'}/></NativeLabel>}
        {(service === 'calendar' || service === 'meet') && <><NativeLabel className="cs-w-field">Von<NativeInput type="date" name="from" value={draft.from} onChange={e => setDraft(previous => ({ ...previous, from: e.target.value }))}/></NativeLabel><NativeLabel className="cs-w-field">Bis<NativeInput type="date" name="to" value={draft.to} onChange={e => { setDraft(previous => ({ ...previous, to: e.target.value })); setFilterError(''); }}/></NativeLabel></>}
        {service === 'tasks' && <><NativeLabel className="cs-w-field">Aufgabenliste<NativeSelect value={filter.taskListId || '@default'} onChange={e => resetFilter({ ...filter, pageToken: undefined, taskListId: e.target.value })}><NativeOption value="@default">Standardliste</NativeOption>{lists.map(l => <NativeOption value={l.id} key={l.id}>{l.title}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="cs-w-check"><NativeInput type="checkbox" checked={!!filter.completed} onChange={e => resetFilter({ ...filter, pageToken: undefined, completed: e.target.checked })}/>Erledigte einbeziehen</NativeLabel></>}
        {!['tasks', 'contacts', 'chat'].includes(service) && <NativeButton className="cs-w-button" type="submit">Anwenden</NativeButton>}
      </NativeForm>
      {listError && <NativeDiv className="cs-w-notice error" role="alert">Aufgabenlisten konnten nicht geladen werden: {listError} <NativeButton className="cs-w-button small" onClick={() => setListAttempt(n => n + 1)}>Erneut versuchen</NativeButton></NativeDiv>}
      {result.error && <NativeDiv className="cs-w-notice error" role="alert">{result.error} <NativeButton className="cs-w-button small" onClick={() => void result.refresh()}>Erneut versuchen</NativeButton>{result.data && <NativeP>Die angezeigten Einträge stammen vom letzten erfolgreichen Abruf.</NativeP>}</NativeDiv>}
      {result.loading && <NativeDiv className="cs-w-loading" role="status">{definition.title} wird geladen …</NativeDiv>}
      {result.data && <NativeDiv className="cs-w-row cs-w-between cs-w-muted"><NativeSpan>{result.data.items.length} Einträge auf dieser Seite{result.data.nextPageToken ? ' · Weitere verfügbar' : ''}</NativeSpan><NativeSpan>Abgerufen: {googleTime(result.data.fetchedAt)}</NativeSpan></NativeDiv>}
      {result.data?.items.length ? <NativeDiv className="cs-w-results">{result.data.items.map(item => <NativeDiv className="cs-w-item" key={item.id}><NativeDiv className="cs-w-item-head"><NativeButton className="cs-w-item-main" aria-expanded={selected === item.id} onClick={() => setSelected(selected === item.id ? null : item.id)}><NativeStrong>{item.unread && <NativeSpan aria-label="Ungelesen" style={{ color: '#096be0' }}>● </NativeSpan>}{item.completed ? '✓ ' : ''}{item.title}</NativeStrong><NativeSpan>{item.subtitle}</NativeSpan></NativeButton>{item.when && <NativeSpan className="cs-w-item-date">{googleTime(item.when)}</NativeSpan>}{item.url && <NativeA className="cs-w-button small" href={item.url} target="_blank" rel="noopener noreferrer">{service === 'meet' ? 'Teilnehmen' : 'Öffnen'} ↗</NativeA>}{service === 'chat' && <NativeButton className="cs-w-button small" onClick={() => { setChatItem(item); setForm(true); }}>Nachricht</NativeButton>}</NativeDiv>{selected === item.id && <ItemDetail service={service} item={item} email={connection.email} taskListId={filter.taskListId} onSaved={saved}/>}</NativeDiv>)}</NativeDiv> : !result.loading && !result.error && <NativeDiv className="cs-w-empty"><NativeH3>Keine Einträge gefunden</NativeH3><NativeP>{service === 'tasks' ? 'In dieser Auswahl sind keine Aufgaben vorhanden.' : service === 'calendar' || service === 'meet' ? 'In diesem Zeitraum sind keine passenden Termine vorhanden.' : 'Passen Sie gegebenenfalls die Auswahl an oder erstellen Sie einen Eintrag.'}</NativeP></NativeDiv>}
      <NativeDiv className="cs-w-row"><NativeButton className="cs-w-button small" disabled={!pages.length || result.loading} onClick={() => { const previous = [...pages]; const token = previous.pop(); setPages(previous); setFilter({ ...filter, pageToken: token || undefined }); setSelected(null); }}>Vorherige Seite</NativeButton><NativeButton className="cs-w-button small" disabled={!result.data?.nextPageToken || result.loading} onClick={() => { setPages([...pages, filter.pageToken || '']); setFilter({ ...filter, pageToken: result.data?.nextPageToken }); setSelected(null); }}>Weitere laden</NativeButton></NativeDiv>
    </>}
  </NativeSection>;
}
function ItemDetail({ service, item, email, taskListId, onSaved }: {
    service: WorkspaceService;
    item: WorkspaceItem;
    email: string | null;
    taskListId?: string;
    onSaved: (text: string) => void;
}) {
    const [message, setMessage] = useState<any>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const lock = useRef(false);
    useEffect(() => { if (service !== 'gmail')
        return; let active = true; setError(''); setMessage(null); void invoke<any>('gmail_read', { id: item.id }).then(m => { if (active)
        setMessage(m); }).catch(e => { if (active)
        setError(e.message); }); return () => { active = false; }; }, [item.id, service, attempt]);
    const change = async () => { if (lock.current)
        return; lock.current = true; setBusy(true); setError(''); try {
        await invoke(service === 'tasks' ? 'tasks_update' : 'gmail_modify', service === 'tasks' ? { id: item.id, taskListId: taskListId || '@default', task: { status: item.completed ? 'needsAction' : 'completed' } } : { id: item.id, removeLabelIds: ['UNREAD'] }, true);
        onSaved(service === 'tasks' ? 'Aufgabenstatus in Google aktualisiert.' : 'E-Mail als gelesen markiert.');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Änderung fehlgeschlagen.');
    }
    finally {
        lock.current = false;
        setBusy(false);
    } };
    return <NativeDiv className="cs-w-detail cs-w-stack">
    {error && <NativeDiv className="cs-w-notice error" role="alert">{error}{service === 'gmail' && <NativeButton className="cs-w-button small" onClick={() => setAttempt(n => n + 1)}>Erneut laden</NativeButton>}</NativeDiv>}
    {service === 'gmail' ? <>{!message && !error ? <NativeP role="status">Nachricht wird geladen …</NativeP> : message && <NativePre className="cs-w-mail">{plainMail(message.payload) || 'Diese Nachricht enthält keinen lesbaren Klartext. Öffnen Sie sie in Gmail, um die vollständige Darstellung und Anhänge zu sehen.'}</NativePre>}<NativeDiv className="cs-w-row"><NativeA className="cs-w-button small" target="_blank" rel="noopener noreferrer" href={`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email || '')}#inbox/${encodeURIComponent(item.raw?.threadId || item.id)}`}>In Gmail öffnen / antworten ↗</NativeA>{item.unread && <NativeButton disabled={busy} onClick={() => void change()} className="cs-w-button small">Als gelesen markieren</NativeButton>}</NativeDiv></> : <><NativeP style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{service === 'tasks' ? item.raw?.notes || 'Keine Notizen.' : service === 'calendar' || service === 'meet' ? item.raw?.description?.replace(/<[^>]*>/g, '') || 'Keine Beschreibung.' : item.subtitle}</NativeP>{service === 'tasks' && <NativeButton className="cs-w-button small" disabled={busy} onClick={() => void change()}>{busy ? 'Wird gespeichert …' : item.completed ? 'Wieder öffnen' : 'Als erledigt markieren'}</NativeButton>}{(service === 'calendar' || service === 'meet') && <NativeP className="cs-w-muted">Ende: {googleTime(item.raw?.end?.dateTime || item.raw?.end?.date)}</NativeP>}</>}
  </NativeDiv>;
}
