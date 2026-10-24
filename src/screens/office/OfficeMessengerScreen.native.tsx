// Generated native presentation from src/screens/office/OfficeMessengerScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeStyle,NativeButton,NativeInput,NativeSpan,NativeSection,NativeHeader,NativeH1,NativeP,NativeAside,NativeStrong,NativeTime,NativeMain,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { withMessagingTimeout } from '@/lib/office/voicemessageutils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { emptyMessageDraft, hasMessageDraft, messagingScope, useConversationList, useMessageResource, type MessageDraft } from "../../hooks/useMessageWorkspace.native.ts";
import { sendWorkspaceMessage, type MessageOperation, type MessagingActor } from "../../lib/office/messageWorkspaceService.native.ts";
import type { BroadcastOperation } from "../../lib/office/broadcastWorkspaceService.native.ts";
import { loadMessagePreferences } from "../../lib/office/messageWorkspaceSettings.native.ts";
import { CONVERSATION_FILTERS, conversationName, messageTime, parseConversationFilter, selectConversations } from "../../lib/office/messageWorkspace.native.ts";
import { canViewOfficeInternalMessages } from '@/lib/communication/officeComposeRouting';
import { canCreateBroadcast } from '@/lib/office/broadcastpermissions';
import { OFFICE_MESSAGE_AUDIENCES, parseOfficeMessageAudience } from '@/lib/office/officemessengerfilters';
import { OFFICE_THREAD_STATUS_LABELS } from '@/lib/office/messagestatuslabels';
import { setOfficeMessageNavBadgeMessengerView } from '@/lib/office/officeMessageNavBadgeSeenStore';
import { MessageAvatar, MessageButton, MessageEmpty, MessageIcon, MessageNotice } from "../../components/office/messages/MessagePrimitives.native.tsx";
import { messageWorkspaceCss } from "../../components/office/messages/messageWorkspaceCss.native.ts";
import { NewConversation, type ConversationMode } from "../../components/office/messages/NewConversation.native.tsx";
import { ConversationView } from "../../components/office/messages/ConversationView.native.tsx";
import { BroadcastWorkspace, NewBroadcast } from "../../components/office/messages/BroadcastWorkspace.native.tsx";
import { MessageTemplates } from "../../components/office/messages/MessageTemplates.native.tsx";
import { MessageSettings } from "../../components/office/messages/MessageSettings.native.tsx";
type Panel = 'templates' | 'settings' | null;
export function OfficeMessengerScreen({ initialPanel = null }: {
    initialPanel?: Panel;
} = {}) {
    const { profile, user } = useAuth();
    const tenantId = useServiceTenantId();
    const { can, roleKey } = usePermissions();
    const actor = useMemo(() => ({ tenantId: tenantId ?? '', profileId: profile?.id ?? user?.id ?? '', roleKey }), [tenantId, profile?.id, user?.id, roleKey]);
    return <NativeWorkspaceStyleScope css={[messageWorkspaceCss, messageWorkspaceCss, messageWorkspaceCss]}>{<ScreenShell contentOwnsHeader title="Nachrichten" scroll={false} showBreadcrumbs={false} compactHeader showBack={false}>
    {!actor.tenantId || !actor.profileId ? <NativeDiv className="mw"><NativeStyle>{messageWorkspaceCss}</NativeStyle><MessageEmpty title="Anmeldung wird benötigt">Bitte melden Sie sich mit einem Organisationskonto an.</MessageEmpty></NativeDiv> : !can('office.messages.view') ? <NativeDiv className="mw"><NativeStyle>{messageWorkspaceCss}</NativeStyle><MessageEmpty title="Kein Zugriff auf Nachrichten">Für diesen Bereich benötigen Sie die entsprechende Berechtigung.</MessageEmpty></NativeDiv> : <MessageWorkspace key={messagingScope(actor)} actor={actor} actorUserId={user?.id ?? actor.profileId} initialPanel={initialPanel}/>}
  </ScreenShell>}</NativeWorkspaceStyleScope>;
}
export function MessageWorkspace({ actor, actorUserId, initialPanel = null }: {
    actor: MessagingActor;
    actorUserId: string;
    initialPanel?: Panel;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useLocalSearchParams<Record<string, string | string[]>>();
    const focused = useIsFocused();
    const { can, permissions } = usePermissions();
    const internalAllowed = canViewOfficeInternalMessages(actor.roleKey);
    const broadcastAllowed = canCreateBroadcast(actor.roleKey, permissions);
    const requestedAudience = parseOfficeMessageAudience(params.audience ?? params.filter);
    const audience = requestedAudience === 'internal' && !internalAllowed ? 'employees' : requestedAudience;
    const view = (params.view === 'broadcasts' || params.tab === 'broadcasts') && broadcastAllowed ? 'broadcasts' : 'chats';
    const filter = parseConversationFilter(params.filter, params.chatAge);
    const idParam = params.thread ?? params.threadId ?? params.id;
    const selectedId = typeof idParam === 'string' ? idParam : '';
    const broadcastId = typeof params.broadcast === 'string' ? params.broadcast : '';
    const [resumeBroadcast, setResumeBroadcast] = useState<BroadcastOperation | undefined>();
    const [query, setQuery] = useState('');
    const [panel, setPanel] = useState<Panel>(initialPanel);
    const [drafts, setDrafts] = useState<Record<string, MessageDraft>>({});
    const draftsRef = useRef(drafts);
    draftsRef.current = drafts;
    const [dialogDirty, setDialogDirty] = useState(false);
    const [dialogBusy, setDialogBusy] = useState(false);
    const [threadBusy, setThreadBusy] = useState(false);
    const [sending, setSending] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const [templateVersion, setTemplateVersion] = useState(0);
    const [notice, setNotice] = useState('');
    const flight = useRef(false);
    const alive = useRef(true);
    const busy = dialogBusy || threadBusy || sending;
    const list = useConversationList(actor, audience);
    const preferences = useMessageResource(`${messagingScope(actor)}:preferences`, () => loadMessagePreferences(actor));
    const hasDrafts = Object.values(drafts).some(hasMessageDraft);
    useUnsavedWebChanges(hasDrafts || dialogDirty, busy, 'Es gibt noch nicht gesendete Nachrichten oder ungespeicherte Änderungen. Diese gehen beim Verlassen verloren. Möchten Sie die Seite verlassen?');
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { setOfficeMessageNavBadgeMessengerView({ audience, view }); return () => setOfficeMessageNavBadgeMessengerView(null); }, [audience, view]);
    const updateParams = (next: Record<string, string | undefined>) => { if (!busy && !flight.current)
        router.setParams(next); };
    const canStart = can('communication.create_thread') && can('communication.send_message');
    const compose = focused && canStart && (params.compose === '1' || params.create === '1' || params.compose === 'group');
    const broadcastCompose = focused && broadcastAllowed && (params.compose === 'broadcast' || !!resumeBroadcast);
    const mode: ConversationMode = params.compose === 'group' ? 'group' : audience === 'clients' ? 'client' : audience === 'internal' ? 'internal' : 'employee';
    const initialRecipient = typeof params.recipientId === 'string' ? params.recipientId : undefined;
    const closeComposer = () => { setResumeBroadcast(undefined); router.setParams({ compose: undefined, create: undefined, recipientId: undefined }); setDialogDirty(false); setDialogBusy(false); void list.refresh(); };
    const closePanel = () => { setPanel(null); setDialogDirty(false); if (initialPanel && /\/(settings|templates)$/.test(pathname))
        router.replace((pathname.startsWith('/business/') ? '/business/messages' : '/office/messages') as never); };
    const updateDraft = useCallback((id: string, value: MessageDraft) => { draftsRef.current = { ...draftsRef.current, [id]: value }; setDrafts(draftsRef.current); }, []);
    async function send() {
        if (flight.current || !selectedId || !preferences.data || preferences.error || !can('communication.send_message'))
            return;
        const current = draftsRef.current[selectedId] ?? emptyMessageDraft();
        if (!hasMessageDraft(current))
            return;
        const operation: MessageOperation = current.operation ?? { id: crypto.randomUUID(), body: current.text, internal: current.internal, attachments: [...current.attachments] };
        flight.current = true;
        setSending(true);
        updateDraft(selectedId, { ...current, operation, error: undefined });
        try {
            const result = await withMessagingTimeout(sendWorkspaceMessage(actor, selectedId, operation), 45000, 'Versand nicht bestätigt.');
            if (!alive.current)
                return;
            if (!result.ok)
                updateDraft(selectedId, { ...current, operation, error: result.error });
            else {
                updateDraft(selectedId, emptyMessageDraft());
                setRefreshToken(value => value + 1);
                void list.refresh();
            }
        }
        catch {
            if (alive.current)
                updateDraft(selectedId, { ...current, operation, error: 'Der Versand ist noch nicht bestätigt. Bitte den Versand fortsetzen.' });
        }
        finally {
            flight.current = false;
            if (alive.current)
                setSending(false);
        }
    }
    const rows = selectConversations(list.data?.items ?? [], query, filter, actor.profileId);
    const audiences = OFFICE_MESSAGE_AUDIENCES.filter(item => item.key !== 'internal' || internalAllowed);
    const changeAudience = (value: string) => { if (busy)
        return; setQuery(''); router.setParams({ audience: value, thread: undefined, threadId: undefined, broadcast: undefined, compose: undefined, filter: undefined, chatAge: undefined }); };
    const openThread = (id: string) => updateParams({ thread: id, view: 'chats', broadcast: undefined, compose: undefined });
    const closeThread = () => { if (busy)
        return; if (params.id || params.threadId)
        router.replace((pathname.startsWith('/business/') ? '/business/messages' : '/office/messages') as never);
    else
        router.setParams({ thread: undefined, broadcast: undefined }); };
    const refreshList = list.refresh;
    const changed = useCallback(() => { void refreshList(); }, [refreshList]);
    const sidebar = <NativeDiv className="mw-sidebar-top"><NativeDiv className="mw-audiences" role="tablist" aria-label="Nachrichtenempfänger" style={{ gridTemplateColumns: `repeat(${audiences.length},minmax(0,1fr))` }}>{audiences.map(item => <NativeButton type="button" key={item.key} role="tab" disabled={busy} aria-selected={item.key === audience} onClick={() => changeAudience(item.key)}>{item.label}</NativeButton>)}</NativeDiv><NativeDiv className="mw-list-tabs" role="tablist" aria-label="Nachrichtenart"><NativeButton type="button" role="tab" disabled={busy} aria-selected={view === 'chats'} onClick={() => updateParams({ view: 'chats', tab: undefined, filter: undefined, chatAge: undefined })}>Gespräche</NativeButton>{broadcastAllowed && <NativeButton type="button" role="tab" disabled={busy} aria-selected={view === 'broadcasts'} onClick={() => updateParams({ view: 'broadcasts', tab: undefined, filter: undefined, chatAge: undefined })}>Rundnachrichten</NativeButton>}</NativeDiv><NativeDiv className="mw-search"><MessageIcon name="search"/><NativeInput value={query} aria-label={view === 'chats' ? 'Gespräche durchsuchen' : 'Rundnachrichten durchsuchen'} placeholder={view === 'chats' ? 'Name, Betreff oder Nachricht suchen' : 'Mitteilung suchen'} onChange={event => setQuery(event.target.value)}/>{query && <NativeButton type="button" aria-label="Suche leeren" onClick={() => setQuery('')}><MessageIcon name="close"/></NativeButton>}</NativeDiv><NativeDiv className="mw-filters" aria-label="Nachrichten filtern">{CONVERSATION_FILTERS.filter(item => view === 'chats' || item.key === 'all' || item.key === 'closed').map(item => <NativeButton type="button" key={item.key} aria-pressed={filter === item.key} disabled={busy} onClick={() => updateParams({ filter: item.key, chatAge: undefined })}>{view === 'broadcasts' && item.key === 'closed' ? 'Archiviert' : item.label}</NativeButton>)}</NativeDiv>{view === 'chats' && <NativeDiv className="mw-list-meta"><NativeSpan>{rows.length} Gespräche{list.data?.hasMore ? ' im geladenen Bestand' : ''}</NativeSpan><NativeButton type="button" className="mw-button mw-button--quiet" aria-label="Gesprächsliste aktualisieren" disabled={list.loading} onClick={() => void list.refresh()}><MessageIcon name="refresh"/></NativeButton></NativeDiv>}</NativeDiv>;
    return <NativeWorkspaceStyleScope css={[messageWorkspaceCss, messageWorkspaceCss]}>{<NativeSection className="mw" aria-label="Nachrichtenzentrale"><NativeStyle>{messageWorkspaceCss}</NativeStyle><NativeHeader className="mw-header"><NativeDiv className="mw-title"><NativeSpan className="mw-title-icon"><MessageIcon name="chat"/></NativeSpan><NativeDiv><NativeH1>Nachrichten</NativeH1><NativeP>Im Austausch mit Klient:innen, Mitarbeitenden und Ihrem Team.</NativeP></NativeDiv></NativeDiv><NativeDiv className="mw-actions"><MessageButton className="mw-aux" icon="file" aria-label="Schnellantworten verwalten" title="Schnellantworten" disabled={busy} onClick={() => setPanel('templates')}/><MessageButton className="mw-aux" icon="settings" aria-label="Nachrichteneinstellungen" title="Nachrichteneinstellungen" disabled={busy || !can('communication.manage_settings') || !preferences.data} onClick={() => setPanel('settings')}/>{view === 'chats' && audience === 'employees' && canStart && <MessageButton icon="people" aria-label="Neue Teamgruppe" disabled={busy} onClick={() => updateParams({ compose: 'group' })}><NativeSpan>Neue Gruppe</NativeSpan></MessageButton>}{(view === 'chats' ? canStart : broadcastAllowed) && <MessageButton tone="primary" icon={view === 'chats' ? 'plus' : 'broadcast'} disabled={busy} onClick={() => updateParams({ compose: view === 'chats' ? '1' : 'broadcast' })}>{view === 'chats' ? 'Neue Nachricht' : 'Neue Rundnachricht'}</MessageButton>}</NativeDiv></NativeHeader>
    {notice && <MessageNotice>{notice}<NativeButton type="button" className="mw-button mw-button--quiet" aria-label="Hinweis schließen" onClick={() => setNotice('')}><MessageIcon name="close"/></NativeButton></MessageNotice>}
    {preferences.error && <MessageNotice error onRetry={() => void preferences.refresh()}>{preferences.error} Der Versand bleibt bis zum erneuten Laden gesperrt.</MessageNotice>}
    {view === 'broadcasts' ? <BroadcastWorkspace actor={actor} actorUserId={actorUserId} onResume={setResumeBroadcast} audience={audience} selectedId={broadcastId} onSelect={id => updateParams({ broadcast: id })} onBack={closeThread} sidebarControls={sidebar} query={query} closed={filter === 'closed'} refreshToken={refreshToken} onBusyChange={setThreadBusy} onOpenReply={id => { if (!busy) {
        setQuery('');
        router.setParams({ audience: 'employees', view: 'chats', thread: id, broadcast: undefined });
    } }}/> : <NativeDiv className="mw-workspace" data-selected={!!selectedId}><NativeAside className="mw-sidebar">{sidebar}<NativeDiv className="mw-conversations" aria-label="Gesprächsliste">{list.error && <MessageNotice error onRetry={() => void list.refresh()}>{list.error}</MessageNotice>}{list.loading && !list.data ? <NativeDiv className="mw-loading" role="status">Gespräche werden geladen</NativeDiv> : !rows.length ? <MessageEmpty title={query || filter !== 'all' ? 'Keine passenden Gespräche' : 'Hier beginnt der Austausch'}>{query || filter !== 'all' ? 'Passen Sie die Suche oder den Filter an.' : 'Starten Sie eine Nachricht. Ihre Unterhaltungen erscheinen anschließend hier.'}</MessageEmpty> : rows.map(thread => { const draft = drafts[thread.id]; return <NativeWorkspaceStyleScope css={[messageWorkspaceCss]}>{<NativeButton type="button" className="mw-conversation" key={thread.id} aria-current={thread.id === selectedId} disabled={busy && thread.id !== selectedId} onClick={() => openThread(thread.id)}><MessageAvatar name={conversationName(thread)} group={thread.threadType === 'employee_group_office' || thread.threadType === 'internal'}/><NativeSpan className="mw-conversation-copy"><NativeSpan className="mw-conversation-top"><NativeStrong>{conversationName(thread)}</NativeStrong><NativeTime title={messageTime(thread.lastMessageAt, true)}>{messageTime(thread.lastMessageAt)}</NativeTime></NativeSpan>{thread.subject !== conversationName(thread) && <NativeSpan className="mw-conversation-subject">{thread.subject}</NativeSpan>}<NativeSpan className="mw-conversation-preview"><NativeSpan>{hasMessageDraft(draft) ? draft.text || 'Entwurf mit Anhang' : thread.lastMessagePreview || 'Gespräch eröffnet'}</NativeSpan>{thread.unreadCount > 0 && <NativeSpan className="mw-unread" aria-label={`${thread.unreadCount} ungelesen`}>{thread.unreadCount > 99 ? '99+' : thread.unreadCount}</NativeSpan>}</NativeSpan><NativeSpan className="mw-meta-row">{hasMessageDraft(draft) && <NativeSpan className="mw-tag mw-tag--draft">Entwurf</NativeSpan>}{(thread.priority === 'high' || thread.priority === 'urgent') && <NativeSpan className="mw-tag mw-tag--urgent">{thread.priority === 'urgent' ? 'Dringend' : 'Wichtig'}</NativeSpan>}<NativeSpan className="mw-tag">{OFFICE_THREAD_STATUS_LABELS[thread.status]}</NativeSpan>{thread.assignedToUserId === actor.profileId && <NativeSpan className="mw-tag">Mir zugewiesen</NativeSpan>}</NativeSpan></NativeSpan></NativeButton>}</NativeWorkspaceStyleScope>; })}</NativeDiv><NativeDiv className="mw-list-footer">{hasDrafts ? 'Entwürfe bleiben während dieser Sitzung erhalten.' : 'Gespräche sind nach der letzten Nachricht sortiert.'}{list.data?.hasMore && <MessageButton style={{ marginTop: 8, width: '100%' }} disabled={list.loading || busy} onClick={list.loadMore}>Weitere Gespräche laden</MessageButton>}</NativeDiv></NativeAside><NativeMain className="mw-main">{selectedId ? <ConversationView key={selectedId} actor={actor} threadId={selectedId} draft={drafts[selectedId] ?? emptyMessageDraft()} onDraft={value => updateDraft(selectedId, value)} onSend={() => void send()} sending={sending} refreshToken={refreshToken} onBack={closeThread} onChanged={changed} onBusyChange={setThreadBusy} onOpenTemplates={() => setPanel('templates')} focused={focused && !compose && !broadcastCompose && !panel} preferences={preferences.error ? undefined : preferences.data} templateVersion={templateVersion} onRemoved={() => { updateDraft(selectedId, emptyMessageDraft()); if (params.id || params.threadId)
        router.replace((pathname.startsWith('/business/') ? '/business/messages' : '/office/messages') as never);
    else
        router.setParams({ thread: undefined }); setThreadBusy(false); }}/> : <MessageEmpty title="Gute Kommunikation beginnt hier." action={canStart ? <MessageButton tone="primary" icon="plus" onClick={() => updateParams({ compose: '1' })}>Nachricht starten</MessageButton> : undefined}>Wählen Sie ein Gespräch aus oder beginnen Sie eine neue Unterhaltung.</MessageEmpty>}</NativeMain></NativeDiv>}
    {compose && <NewConversation key={mode} actor={actor} mode={mode} initialRecipientId={initialRecipient} onClose={closeComposer} onDirtyChange={setDialogDirty} onBusyChange={setDialogBusy} onCreated={(id, draft) => { updateDraft(id, draft); closeComposer(); router.setParams({ thread: id, view: 'chats', filter: 'all', chatAge: undefined }); setNotice(draft.error ? 'Gespräch eröffnet. Die erste Nachricht benötigt noch Ihre Aufmerksamkeit.' : 'Gespräch eröffnet.'); }}/>}
    {broadcastCompose && <NewBroadcast actor={actor} actorUserId={actorUserId} audience={resumeBroadcast?.audience ?? audience} resumeOperation={resumeBroadcast} onClose={closeComposer} onDirtyChange={setDialogDirty} onBusyChange={setDialogBusy} onSent={id => { closeComposer(); setRefreshToken(value => value + 1); router.setParams({ view: 'broadcasts', broadcast: id }); setNotice('Rundnachricht gesendet.'); }}/>}
    {focused && panel === 'templates' && <MessageTemplates actor={actor} canEdit={can('communication.manage_settings')} onClose={closePanel} onDirtyChange={setDialogDirty} onBusyChange={setDialogBusy} onSaved={() => setTemplateVersion(value => value + 1)}/>}
    {focused && panel === 'settings' && preferences.data && can('communication.manage_settings') && <MessageSettings actor={actor} initial={preferences.data} onClose={closePanel} onSaved={() => void preferences.refresh()} onDirtyChange={setDialogDirty} onBusyChange={setDialogBusy}/>}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
