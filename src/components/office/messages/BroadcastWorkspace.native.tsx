// Generated native presentation from src/components/office/messages/BroadcastWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeAside,NativeButton,NativeSpan,NativeStrong,NativeTime,NativeMain,NativeHeader,NativeH2,NativeP,NativeSmall,NativeInput,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeForm,NativeSection,NativeH3,NativeLabel,NativeTextarea,NativeSelect,NativeOption,NativeFooter} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { withMessagingTimeout } from '@/lib/office/voicemessageutils';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { messagingScope, useMessageResource } from "../../../hooks/useMessageWorkspace.native.ts";
import { archiveWorkspaceBroadcast, loadBroadcastDetail, loadBroadcastList, loadBroadcastTargets, sendWorkspaceBroadcast, type BroadcastOperation, type BroadcastSegment } from "../../../lib/office/broadcastWorkspaceService.native.ts";
import { BROADCAST_CATEGORIES, BROADCAST_PRIORITIES, type CreateBroadcastInput } from '@/types/office/broadcast';
import type { MessagingActor } from "../../../lib/office/messageWorkspaceService.native.ts";
import { messageTime } from "../../../lib/office/messageWorkspace.native.ts";
import { MessageAvatar, MessageButton, MessageDialog, MessageEmpty, MessageIcon, MessageNotice } from "./MessagePrimitives.native.tsx";
export function BroadcastWorkspace({ actor, audience, selectedId, onSelect, onBack, sidebarControls, query, closed, refreshToken, onBusyChange, onOpenReply, onResume, actorUserId }: {
    actor: MessagingActor;
    audience: BroadcastSegment;
    selectedId: string;
    onSelect: (id: string) => void;
    onBack: () => void;
    sidebarControls: ReactNode;
    query: string;
    closed: boolean;
    refreshToken: number;
    onBusyChange: (value: boolean) => void;
    onOpenReply: (id: string) => void;
    onResume: (operation: BroadcastOperation) => void;
    actorUserId: string;
}) {
    const [pages, setPages] = useState(1);
    const list = useMessageResource(`${messagingScope(actor)}:broadcast-list:${pages}:${refreshToken}`, async () => {
        const items = [];
        let hasMore = false;
        for (let page = 0; page < pages; page++) {
            const result = await loadBroadcastList(actor, page * 80);
            if (!result.ok)
                return result;
            items.push(...result.data.items);
            hasMore = result.data.hasMore;
            if (!hasMore)
                break;
        }
        return { ok: true as const, data: { items: [...new Map(items.map(item => [item.id, item])).values()], hasMore } };
    });
    const rows = (list.data?.items ?? []).filter(item => (audience === 'employees' ? !['clients', 'internal'].includes(item.audience) : item.audience === audience) && (!closed || item.status === 'archived') && `${item.title} ${item.body} ${item.categoryLabel}`.toLocaleLowerCase('de-DE').includes(query.trim().toLocaleLowerCase('de-DE')));
    return <NativeDiv className="mw-workspace" data-selected={!!selectedId}><NativeAside className="mw-sidebar">{sidebarControls}<NativeDiv className="mw-conversations" aria-label="Rundnachrichten">{list.error && <MessageNotice error onRetry={() => void list.refresh()}>{list.error}</MessageNotice>}{list.loading && !list.data ? <NativeDiv className="mw-loading">Rundnachrichten werden geladen</NativeDiv> : !rows.length ? <MessageEmpty title="Keine Rundnachricht gefunden">Erstellen Sie eine Mitteilung oder passen Sie Ihre Suche an.</MessageEmpty> : rows.map(item => <NativeButton type="button" key={item.id} className="mw-conversation" aria-current={item.id === selectedId} onClick={() => onSelect(item.id)}><MessageAvatar name={item.title} group/><NativeSpan className="mw-conversation-copy"><NativeSpan className="mw-conversation-top"><NativeStrong>{item.title}</NativeStrong><NativeTime>{messageTime(item.sentAt || item.createdAt)}</NativeTime></NativeSpan><NativeSpan className="mw-conversation-preview"><NativeSpan>{item.body}</NativeSpan></NativeSpan><NativeSpan className="mw-meta-row"><NativeSpan className="mw-tag">{item.status === 'sent' ? 'Gesendet' : item.status === 'archived' ? 'Archiviert' : item.status === 'scheduled' ? 'Geplant' : 'Versand unvollständig'}</NativeSpan>{item.priority !== 'normal' && <NativeSpan className="mw-tag mw-tag--urgent">{BROADCAST_PRIORITIES.find(priority => priority.key === item.priority)?.label}</NativeSpan>}</NativeSpan></NativeSpan></NativeButton>)}</NativeDiv><NativeDiv className="mw-list-footer">{rows.length} Rundnachrichten{list.data?.hasMore && <MessageButton style={{ marginTop: 8, width: '100%' }} disabled={list.loading} onClick={() => setPages(value => value + 1)}>Weitere Rundnachrichten laden</MessageButton>}</NativeDiv></NativeAside><NativeMain className="mw-main">{selectedId ? <BroadcastDetail key={selectedId} actor={actor} id={selectedId} onBack={onBack} onChanged={() => void list.refresh()} onBusyChange={onBusyChange} onOpenReply={onOpenReply} onResume={onResume} actorUserId={actorUserId}/> : <MessageEmpty title="Eine Mitteilung. Alle erreichen.">Wählen Sie eine Rundnachricht aus, um Inhalt und verfügbare Rückmeldungen zu sehen.</MessageEmpty>}</NativeMain></NativeDiv>;
}
function BroadcastDetail({ actor, id, onBack, onChanged, onBusyChange, onOpenReply, onResume, actorUserId }: {
    actor: MessagingActor;
    id: string;
    onBack: () => void;
    onChanged: () => void;
    onBusyChange: (value: boolean) => void;
    onOpenReply: (id: string) => void;
    onResume: (operation: BroadcastOperation) => void;
    actorUserId: string;
}) {
    const resource = useMessageResource(`${messagingScope(actor)}:broadcast:${id}`, () => loadBroadcastDetail(actor, id));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const alive = useRef(true);
    const flight = useRef(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
    async function archive() {
        if (flight.current || !await confirmNativeWorkspaceAction('Diese Rundnachricht archivieren? Bereits zugestellte Benachrichtigungen werden dadurch nicht zurückgerufen.'))
            return;
        flight.current = true;
        setBusy(true);
        setError('');
        try {
            const result = await archiveWorkspaceBroadcast(actor, id);
            if (!alive.current)
                return;
            if (!result.ok)
                setError(result.error);
            else {
                onChanged();
                await resource.refresh();
            }
        }
        catch {
            if (alive.current)
                setError('Archivierung nicht bestätigt.');
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    const item = resource.data?.broadcast;
    return <><NativeHeader className="mw-thread-header"><NativeDiv className="mw-thread-identity"><MessageButton className="mw-back" icon="back" aria-label="Zur Rundnachrichtenliste" disabled={busy} onClick={onBack}/><MessageAvatar name="Rundnachricht" group large/><NativeDiv><NativeH2>Rundnachricht</NativeH2><NativeP>{item?.categoryLabel || 'Mitteilung und Rückmeldungen'}</NativeP></NativeDiv></NativeDiv><NativeDiv className="mw-actions"><MessageButton icon="refresh" disabled={busy || resource.loading} onClick={() => void resource.refresh()}>Aktualisieren</MessageButton>{item && item.status !== 'archived' && <MessageButton icon="archive" disabled={busy} onClick={() => void archive()}>Archivieren</MessageButton>}</NativeDiv></NativeHeader>{(resource.error || error) && <MessageNotice error onRetry={() => void resource.refresh()}>{error || resource.error}</MessageNotice>}{!item ? <NativeDiv className="mw-loading">Rundnachricht wird geladen</NativeDiv> : <NativeDiv className="mw-broadcast-read"><NativeDiv className="mw-meta-row"><NativeSpan className="mw-tag">{item.status === 'sent' ? 'Gesendet' : item.status === 'archived' ? 'Archiviert' : 'Versand nicht abgeschlossen'}</NativeSpan><NativeSpan className={`mw-tag${item.priority !== 'normal' ? ' mw-tag--urgent' : ''}`}>{BROADCAST_PRIORITIES.find(priority => priority.key === item.priority)?.label}</NativeSpan></NativeDiv><NativeH2>{item.title}</NativeH2><NativeSmall>{messageTime(item.sentAt || item.createdAt, true)}{item.expiresAt ? ` · Gültig bis ${messageTime(item.expiresAt, true)}` : ''}</NativeSmall>{item.status === 'draft' && <MessageNotice error>Dieser Versand wurde noch nicht vollständig abgeschlossen. Bereits zugestellte Benachrichtigungen können sichtbar sein. Setzen Sie denselben Versandvorgang fort.</MessageNotice>}{resource.data?.pendingOperation && item.createdByUserId === actorUserId && <MessageButton tone="primary" icon="send" style={{ marginTop: 12 }} disabled={busy} onClick={() => onResume(resource.data!.pendingOperation!)}>Versand fortsetzen</MessageButton>}<NativeP className="mw-broadcast-body">{item.body}</NativeP>{item.receiptAvailable ? <><NativeDiv className="mw-stats"><NativeDiv className="mw-stat"><NativeStrong>{item.recipientCount}</NativeStrong><NativeSpan>Empfänger</NativeSpan></NativeDiv><NativeDiv className="mw-stat"><NativeStrong>{item.readCount}</NativeStrong><NativeSpan>Gelesen</NativeSpan></NativeDiv><NativeDiv className="mw-stat"><NativeStrong>{item.requireAcknowledgement ? item.acknowledgedCount : '—'}</NativeStrong><NativeSpan>{item.requireAcknowledgement ? 'Bestätigt' : 'Keine Bestätigung angefordert'}</NativeSpan></NativeDiv></NativeDiv><NativeDiv className="mw-search"><MessageIcon name="search"/><NativeInput aria-label="Empfänger der Rundnachricht suchen" placeholder="Empfänger suchen" value={search} onChange={event => setSearch(event.target.value)}/></NativeDiv><NativeTable className="mw-table"><NativeThead><NativeTr><NativeTh>Empfänger</NativeTh><NativeTh>Gelesen</NativeTh>{item.requireAcknowledgement && <NativeTh>Bestätigt</NativeTh>}<NativeTh>Antwort</NativeTh></NativeTr></NativeThead><NativeTbody>{resource.data?.recipients.filter(person => person.name.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE'))).map(person => <NativeTr key={person.id}><NativeTd>{person.name}</NativeTd><NativeTd>{person.readAt ? messageTime(person.readAt, true) : 'Noch nicht'}</NativeTd>{item.requireAcknowledgement && <NativeTd>{person.acknowledgedAt ? messageTime(person.acknowledgedAt, true) : 'Ausstehend'}</NativeTd>}<NativeTd>{person.replyThreadId ? <MessageButton icon="chat" onClick={() => onOpenReply(person.replyThreadId!)}>Öffnen</MessageButton> : '—'}</NativeTd></NativeTr>)}</NativeTbody></NativeTable></> : <MessageNotice>{item.plannedCount != null ? `${item.plannedCount} Empfänger ausgewählt. ` : ''}Für diese Zielgruppe werden derzeit keine individuellen Lesebestätigungen bereitgestellt.</MessageNotice>}</NativeDiv>}</>;
}
export function NewBroadcast({ actor, actorUserId, audience, onClose, onSent, onDirtyChange, onBusyChange, resumeOperation }: {
    actor: MessagingActor;
    actorUserId: string;
    audience: BroadcastSegment;
    onClose: () => void;
    onSent: (id: string) => void;
    onDirtyChange: (value: boolean) => void;
    onBusyChange: (value: boolean) => void;
    resumeOperation?: BroadcastOperation;
}) {
    const [title, setTitle] = useState(resumeOperation?.input.title ?? '');
    const [body, setBody] = useState(resumeOperation?.input.body ?? '');
    const [category, setCategory] = useState<CreateBroadcastInput['category']>(resumeOperation?.input.category ?? 'general');
    const [priority, setPriority] = useState<CreateBroadcastInput['priority']>(resumeOperation?.input.priority ?? 'normal');
    const [allowReplies, setReplies] = useState(resumeOperation?.input.allowReplies ?? false);
    const [acknowledge, setAcknowledge] = useState(resumeOperation?.input.requireAcknowledgement ?? false);
    const [expires, setExpires] = useState(resumeOperation?.input.expiresAt ? new Date(new Date(resumeOperation.input.expiresAt).getTime() - new Date(resumeOperation.input.expiresAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
    const [selected, setSelected] = useState<string[]>(resumeOperation?.targets.map(target => target.id) ?? []);
    const [query, setQuery] = useState('');
    const [operation, setOperation] = useState<BroadcastOperation | null>(resumeOperation ?? null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const flight = useRef(false);
    const alive = useRef(true);
    const resource = useMessageResource(`${messagingScope(actor)}:broadcast-targets:${audience}`, () => loadBroadcastTargets(actor, audience));
    const targets = (resource.data ?? []).filter(person => selected.includes(person.id));
    const locked = busy || !!operation;
    const dirty = !!title || !!body || !!selected.length || !!operation;
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
    useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
    const close = async () => { if (!busy && (!dirty || await confirmNativeWorkspaceAction(operation ? 'Der Versand ist möglicherweise teilweise erfolgt. Die Rundnachricht bleibt in der Übersicht. Diesen Vorgang verlassen?' : 'Den Entwurf der Rundnachricht verwerfen?')))
        onClose(); };
    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (flight.current)
            return;
        if (!title.trim() || !body.trim() || !targets.length) {
            setError('Bitte Betreff, Nachricht und mindestens einen Empfänger auswählen.');
            return;
        }
        if (!operation && expires && new Date(expires).getTime() <= Date.now()) {
            setError('Das Ablaufdatum muss in der Zukunft liegen.');
            return;
        }
        if (!operation && !await confirmNativeWorkspaceAction(`„${title.trim()}“ jetzt an ${targets.length} ${targets.length === 1 ? 'Empfänger' : 'Empfänger'} senden?`))
            return;
        const current: BroadcastOperation = operation ?? { id: crypto.randomUUID(), sentAt: new Date().toISOString(), audience, targets: targets.map(target => ({ ...target, notificationId: crypto.randomUUID() })), input: { title: title.trim(), body: body.trim(), category, priority, allowReplies: audience === 'employees' && allowReplies, requireAcknowledgement: audience === 'employees' && acknowledge, showInEmployeePortal: true, expiresAt: expires ? new Date(expires).toISOString() : null, recipientFilter: { audience: audience === 'employees' ? 'selected_employees' : audience, employeeIds: audience === 'employees' ? targets.map(target => target.employeeId!) : undefined } } };
        flight.current = true;
        setBusy(true);
        setOperation(current);
        setError('');
        try {
            const result = await withMessagingTimeout(sendWorkspaceBroadcast(actor, actorUserId, current), 45000, 'Versand nicht bestätigt.');
            if (!alive.current)
                return;
            if (!result.ok)
                setError(result.error);
            else {
                onDirtyChange(false);
                onBusyChange(false);
                onSent(result.data.id);
            }
        }
        catch {
            if (alive.current)
                setError('Versand nicht bestätigt. Bitte denselben Vorgang fortsetzen.');
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    const audienceLabel = audience === 'employees' ? 'Mitarbeitende' : audience === 'clients' ? 'Klient:innen mit Portalzugang' : 'Verwaltung, Leitung und Geschäftsführung';
    return <MessageDialog title="Neue Rundnachricht" wide busy={busy} onClose={close}><NativeForm onSubmit={event => void submit(event)}><NativeDiv className="mw-dialog-scroll">{error && <MessageNotice error>{error}</MessageNotice>}{resource.error && <MessageNotice error onRetry={() => void resource.refresh()}>{resource.error}</MessageNotice>}<NativeDiv className="mw-broadcast-layout"><NativeDiv style={{ display: 'grid', gap: 20 }}><NativeSection className="mw-step"><NativeDiv className="mw-step-heading"><NativeSpan>1</NativeSpan><NativeH3>Empfänger auswählen</NativeH3><NativeSmall>{targets.length} ausgewählt</NativeSmall></NativeDiv><NativeSmall>{audienceLabel}</NativeSmall><NativeDiv className="mw-search"><MessageIcon name="search"/><NativeInput aria-label="Rundnachrichtenempfänger suchen" disabled={locked} placeholder="Name suchen" value={query} onChange={event => setQuery(event.target.value)}/></NativeDiv><NativeLabel className="mw-check"><NativeInput type="checkbox" disabled={locked || !resource.data?.length} checked={!!resource.data?.length && selected.length === resource.data.length} onChange={event => setSelected(event.target.checked ? resource.data!.map(person => person.id) : [])}/><NativeSpan>Alle {resource.data?.length ?? 0} Empfänger auswählen</NativeSpan></NativeLabel><NativeDiv className="mw-recipients">{resource.loading ? <NativeDiv className="mw-loading">Empfänger werden geladen</NativeDiv> : resource.data?.filter(person => person.name.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE'))).map(person => <NativeButton type="button" role="checkbox" aria-checked={selected.includes(person.id)} className="mw-recipient" key={person.id} disabled={locked} onClick={() => setSelected(ids => ids.includes(person.id) ? ids.filter(id => id !== person.id) : [...ids, person.id])}><MessageAvatar name={person.name}/><NativeSpan className="mw-recipient-copy"><NativeStrong>{person.name}</NativeStrong>{!person.userId && <NativeSmall>Noch ohne aktiven App-Zugang</NativeSmall>}</NativeSpan><NativeSpan className="mw-recipient-check">{selected.includes(person.id) && <MessageIcon name="check"/>}</NativeSpan></NativeButton>)}</NativeDiv>{targets.some(person => !person.userId) && <NativeSmall>Personen ohne App-Zugang können die hinterlegte Mitteilung erst nach Freischaltung ihres Zugangs abrufen.</NativeSmall>}</NativeSection><NativeSection className="mw-step"><NativeDiv className="mw-step-heading"><NativeSpan>2</NativeSpan><NativeH3>Mitteilung verfassen</NativeH3></NativeDiv><NativeDiv className="mw-field"><NativeLabel htmlFor="mw-broadcast-title">Betreff *</NativeLabel><NativeInput id="mw-broadcast-title" disabled={locked} maxLength={180} required value={title} onChange={event => setTitle(event.target.value)} placeholder="Was sollen alle wissen?"/></NativeDiv><NativeDiv className="mw-field"><NativeLabel htmlFor="mw-broadcast-body">Nachricht *</NativeLabel><NativeTextarea id="mw-broadcast-body" disabled={locked} required maxLength={12000} rows={6} value={body} onChange={event => setBody(event.target.value)} placeholder="Ihre Mitteilung …"/></NativeDiv><NativeDiv className="mw-form-grid"><NativeDiv className="mw-field"><NativeLabel htmlFor="mw-broadcast-category">Kategorie</NativeLabel><NativeSelect id="mw-broadcast-category" disabled={locked} value={category} onChange={event => setCategory(event.target.value as typeof category)}>{BROADCAST_CATEGORIES.map(item => <NativeOption key={item.key} value={item.key}>{item.label}</NativeOption>)}</NativeSelect></NativeDiv><NativeDiv className="mw-field"><NativeLabel htmlFor="mw-broadcast-priority">Priorität</NativeLabel><NativeSelect id="mw-broadcast-priority" disabled={locked} value={priority} onChange={event => setPriority(event.target.value as typeof priority)}>{BROADCAST_PRIORITIES.map(item => <NativeOption key={item.key} value={item.key}>{item.label}</NativeOption>)}</NativeSelect></NativeDiv></NativeDiv><NativeDiv className="mw-field"><NativeLabel htmlFor="mw-broadcast-expires">Gültig bis <NativeSmall>optional</NativeSmall></NativeLabel><NativeInput id="mw-broadcast-expires" type="datetime-local" disabled={locked} value={expires} onChange={event => setExpires(event.target.value)}/></NativeDiv>{audience === 'employees' && <><NativeLabel className="mw-check"><NativeInput type="checkbox" checked={allowReplies} disabled={locked} onChange={event => setReplies(event.target.checked)}/><NativeSpan>Persönliche Antworten erlauben<NativeSmall>Antworten öffnen jeweils ein eigenes Gespräch.</NativeSmall></NativeSpan></NativeLabel><NativeLabel className="mw-check"><NativeInput type="checkbox" checked={acknowledge} disabled={locked} onChange={event => setAcknowledge(event.target.checked)}/><NativeSpan>Bestätigung anfordern</NativeSpan></NativeLabel></>}</NativeSection></NativeDiv><NativeAside className="mw-preview"><NativeSpan className="mw-tag">Vorschau · {targets.length} Empfänger</NativeSpan><NativeH3>{title || 'Betreff Ihrer Rundnachricht'}</NativeH3><NativeP>{body || 'Hier erscheint Ihre Mitteilung.'}</NativeP><NativeSmall>{BROADCAST_CATEGORIES.find(item => item.key === category)?.label} · {BROADCAST_PRIORITIES.find(item => item.key === priority)?.label}</NativeSmall><NativeSmall>Die Mitteilung wird im jeweiligen Portal beziehungsweise in den Benachrichtigungen bereitgestellt.</NativeSmall></NativeAside></NativeDiv></NativeDiv><NativeFooter className="mw-dialog-footer"><NativeP>{operation ? 'Ein erneuter Versuch setzt denselben Versand fort.' : `${targets.length} Empfänger · Bitte die Vorschau vor dem Senden prüfen.`}</NativeP><NativeDiv className="mw-actions"><MessageButton disabled={busy} onClick={close}>Abbrechen</MessageButton><MessageButton type="submit" tone="primary" icon="send" disabled={busy || resource.loading || !!resource.error || !targets.length}>{busy ? 'Wird gesendet …' : operation ? 'Versand fortsetzen' : 'Rundnachricht senden'}</MessageButton></NativeDiv></NativeFooter></NativeForm></MessageDialog>;
}
