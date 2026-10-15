import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { messagingScope, useMessageResource, type MessageDraft } from '@/hooks/useMessageWorkspace.web';
import { loadConversation, loadConversationAttachments, loadConversationMessages, markConversationRead, removeConversationMessage, updateConversation, type ConversationPatch, type MessagingActor } from '@/lib/office/messageWorkspaceService.web';
import { fetchOfficeMessageCategories } from '@/lib/office/messagethreadservice';
import { conversationExport, conversationName, MESSAGE_PRIORITIES, messageDay, messageTime } from '@/lib/office/messageWorkspace.web';
import { auditFromThread, logOfficeMessageAuditEvent } from '@/lib/office/officemessageauditservice';
import { OFFICE_THREAD_STATUS_LABELS } from '@/lib/office/messagestatuslabels';
import { subscribeToOfficeMessageThread } from '@/lib/office/officemessagerealtime';
import type { OfficeMessage } from '@/types/office/messaging';
import type { MessagePreferences } from '@/lib/office/messageWorkspaceSettings.web';
import { MessageAvatar, MessageButton, MessageEmpty, MessageIcon, MessageNotice } from './MessagePrimitives.web';
import { MessageFile } from './MessageAttachments.web';
import { MessageComposer } from './MessageComposer.web';

export function ConversationView({ actor, threadId, draft, onDraft, onSend, sending, refreshToken, onBack, onChanged, onBusyChange, onOpenTemplates, focused, preferences, templateVersion, onRemoved }: {
  actor: MessagingActor; threadId: string; draft: MessageDraft; onDraft: (draft: MessageDraft) => void; onSend: () => void; sending: boolean; refreshToken: number;
  onBack: () => void; onChanged: () => void; onBusyChange: (busy: boolean) => void; onOpenTemplates: () => void; focused: boolean;
  preferences?: MessagePreferences; templateVersion: number; onRemoved: () => void;
}) {
  const { can } = usePermissions();
  const resource = useMessageResource(`${messagingScope(actor)}:${threadId}`, () => loadConversation(actor, threadId));
  const thread = resource.data?.thread;
  const refreshConversation = resource.refresh;
  const [older, setOlder] = useState<OfficeMessage[]>([]); const [olderOffset, setOlderOffset] = useState(80); const [hasOlder, setHasOlder] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [readError, setReadError] = useState('');
  const [details, setDetails] = useState(false); const [searchOpen, setSearchOpen] = useState(false); const [query, setQuery] = useState('');
  const [jump, setJump] = useState(false); const history = useRef<HTMLDivElement>(null); const nearBottom = useRef(true); const initial = useRef(true);
  const alive = useRef(true); const flight = useRef(false); const reading = useRef(false); const readAttempt = useRef('');
  const callbacks = useRef({ onChanged, onBusyChange }); callbacks.current = { onChanged, onBusyChange };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useEffect(() => { if (refreshToken > 0) { nearBottom.current = true; void refreshConversation(); } }, [refreshToken, refreshConversation]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToOfficeMessageThread(actor.tenantId, threadId, () => { clearTimeout(timer); timer = setTimeout(() => void refreshConversation(), 250); });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [actor.tenantId, threadId, refreshConversation]);
  const messages = useMemo(() => [...new Map([...older, ...(thread?.messages ?? [])].map(message => [message.id, message])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)), [older, thread?.messages]);
  const attachmentKey = messages.map(message => message.id).join(',');
  const attachments = useMessageResource(`${messagingScope(actor)}:${threadId}:files:${attachmentKey}`, () => loadConversationAttachments(actor, threadId, messages.map(message => message.id)));
  const refreshAttachments = attachments.refresh; const attachmentData = attachments.data; const threadUpdatedAt = thread?.updatedAt;
  useEffect(() => { if (threadUpdatedAt) void refreshAttachments(); }, [threadUpdatedAt, refreshToken, refreshAttachments]);
  const filesByMessage = useMemo(() => { const map = new Map<string, NonNullable<typeof attachmentData>>(); for (const file of attachmentData ?? []) map.set(file.messageId, [...(map.get(file.messageId) ?? []), file]); return map; }, [attachmentData]);
  const categories = useMessageResource(`${messagingScope(actor)}:categories`, () => fetchOfficeMessageCategories(actor.tenantId, actor.roleKey));
  const matches = query.trim() ? messages.filter(message => `${message.body} ${message.senderDisplayName}`.toLocaleLowerCase('de-DE').includes(query.trim().toLocaleLowerCase('de-DE'))) : messages;
  const scrollBottom = useCallback(() => { const node = history.current; if (node) node.scrollTop = node.scrollHeight; nearBottom.current = true; setJump(false); }, []);
  useEffect(() => { if (!thread) return; if (initial.current || nearBottom.current) { scrollBottom(); initial.current = false; } else setJump(true); }, [thread?.messages, thread, scrollBottom]);
  const read = useCallback(async (force = false) => {
    if (!focused || document.visibilityState !== 'visible' || reading.current) return;
    const signature = messages.filter(message => !message.readAt && !message.isInternalNote && !message.isSystemMessage && (message.senderClientId || message.senderEmployeeId)).map(message => message.id).join(',');
    if (!signature || (!force && readAttempt.current === signature)) return;
    readAttempt.current = signature; reading.current = true;
    try {
      const result = await markConversationRead(actor, threadId, messages);
      if (!alive.current) return;
      setReadError(result.ok ? '' : result.error);
      if (result.ok) callbacks.current.onChanged();
    } catch { if (alive.current) setReadError('Lesebestätigung konnte nicht gespeichert werden.'); }
    finally { reading.current = false; }
  }, [actor, focused, messages, threadId]);
  useEffect(() => { void read(); const visible = () => void read(); document.addEventListener('visibilitychange', visible); return () => document.removeEventListener('visibilitychange', visible); }, [read]);
  async function more() {
    if (flight.current) return; flight.current = true; setBusy(true); setError('');
    const node = history.current; const previousHeight = node?.scrollHeight ?? 0; const previousTop = node?.scrollTop ?? 0;
    try {
      const result = await loadConversationMessages(actor, threadId, olderOffset);
      if (!alive.current) return;
      if (!result.ok) { setError(result.error); return; }
      nearBottom.current = false; setOlder(items => [...items, ...result.data.items]); setOlderOffset(result.data.nextOffset); setHasOlder(result.data.hasMore);
      requestAnimationFrame(() => { if (alive.current && history.current) history.current.scrollTop = previousTop + history.current.scrollHeight - previousHeight; });
    } catch { if (alive.current) setError('Ältere Nachrichten konnten nicht geladen werden.'); }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  async function change(patch: ConversationPatch) {
    if (flight.current || sending) return;
    if (patch.status === 'deleted' && !window.confirm('Diese Unterhaltung aus der Übersicht und den Portalen entfernen? Diese Aktion kann hier nicht rückgängig gemacht werden.')) return;
    if (patch.status === 'closed' && !window.confirm('Dieses Gespräch abschließen? Antworten sind nach dem erneuten Öffnen wieder möglich.')) return;
    flight.current = true; setBusy(true); setError('');
    try {
      const result = await updateConversation(actor, threadId, patch);
      if (!alive.current) return;
      if (!result.ok) { setError(result.error); return; }
      onChanged(); if (patch.status === 'deleted') onRemoved(); else await resource.refresh();
    } catch { if (alive.current) setError('Die Änderung konnte nicht bestätigt werden. Bitte die Ansicht aktualisieren.'); }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  async function remove(message: OfficeMessage, status: 'archived' | 'deleted') {
    if (flight.current || sending || !window.confirm(status === 'archived' ? 'Diese Nachricht archivieren? Sie verschwindet aus dem aktiven Verlauf.' : 'Diese Nachricht aus dem Verlauf für alle Teilnehmenden entfernen? Dies kann hier nicht rückgängig gemacht werden.')) return;
    flight.current = true; setBusy(true); setError('');
    try {
      const result = await removeConversationMessage(actor, threadId, message.id, status);
      if (!alive.current) return;
      if (!result.ok) { setError(result.error); return; }
      setOlder([]); setOlderOffset(80); setHasOlder(true); onChanged(); await resource.refresh();
    } catch { if (alive.current) setError('Die Änderung wurde nicht bestätigt. Bitte erneut versuchen.'); }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  async function download() {
    if (!thread || flight.current) return; flight.current = true; setBusy(true); setError('');
    try {
      const all: OfficeMessage[] = []; let offset = 0;
      for (;;) {
        const result = await loadConversationMessages(actor, threadId, offset);
        if (!alive.current) return;
        if (!result.ok) { setError(result.error); return; }
        all.push(...result.data.items); if (!result.data.hasMore) break; offset = result.data.nextOffset;
      }
      const unique = [...new Map(all.map(item => [item.id, item])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      const url = URL.createObjectURL(new Blob([conversationExport(thread, unique)], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `CareSuite-Gespraech-${thread.id.slice(0, 8)}.txt`; link.click(); void logOfficeMessageAuditEvent({ tenantId: actor.tenantId, ...auditFromThread(thread), actorName: actor.displayName, action: 'office_message_export_requested', summary: 'Gesprächsverlauf als Text exportiert.', metadata: { messageCount: unique.length } }).catch(() => {}); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (alive.current) setError('Der Export konnte nicht erstellt werden.'); }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  const composeBusy = useCallback((value: boolean) => callbacks.current.onBusyChange(value || flight.current), []);
  if (!thread) return <><div className="mw-thread-header"><MessageButton icon="back" onClick={onBack}>Zur Übersicht</MessageButton></div>{resource.error ? <MessageNotice error onRetry={() => void resource.refresh()}>{resource.error}</MessageNotice> : <div className="mw-loading" role="status">Gespräch wird geladen</div>}</>;
  const name = conversationName(thread); const canWrite = can('communication.send_message');
  const filteredCategories = categories.data?.filter(item => item.audience === 'all' || item.audience === (thread.threadType === 'client_office' ? 'client' : thread.threadType === 'internal' ? 'internal' : 'employee')) ?? [];
  return <>
    <header className="mw-thread-header"><div className="mw-thread-identity"><MessageButton className="mw-back" icon="back" aria-label="Zur Gesprächsliste" disabled={busy || sending} onClick={onBack} /><MessageAvatar name={name} group={thread.threadType === 'employee_group_office' || thread.threadType === 'internal'} large /><div><h2>{name}</h2><p>{thread.subject !== name ? `${thread.subject} · ` : ''}{OFFICE_THREAD_STATUS_LABELS[thread.status]}</p></div></div><div className="mw-actions"><MessageButton icon="search" aria-label="Im Gespräch suchen" title="Im Gespräch suchen" aria-expanded={searchOpen} onClick={() => { setSearchOpen(value => !value); setQuery(''); }} /><MessageButton icon="refresh" aria-label="Gespräch aktualisieren" title="Aktualisieren" disabled={resource.loading || busy || sending} onClick={() => void resource.refresh()} /><MessageButton icon="info" aria-expanded={details} onClick={() => setDetails(value => !value)}>Details</MessageButton><MessageButton className="mw-close-conversation" icon="close" aria-label="Gespräch schließen" title="Gespräch schließen" disabled={busy || sending} onClick={onBack} /></div></header>
    {(error || resource.error) && <MessageNotice error onRetry={() => { setError(''); void resource.refresh(); }}>{error || resource.error}</MessageNotice>}
    {readError && <MessageNotice error onRetry={() => void read(true)}>{readError}</MessageNotice>}
    {searchOpen && <div className="mw-search-thread"><div className="mw-search"><MessageIcon name="search" /><input autoFocus aria-label="Verlauf durchsuchen" placeholder="Text oder Absender suchen" value={query} onChange={event => setQuery(event.target.value)} /></div><small>{matches.length} Treffer{resource.data?.hasMore ? ' im geladenen Verlauf' : ''}</small></div>}
    <div className="mw-thread-content"><div className="mw-conversation-panel"><div className="mw-history" ref={history} aria-label="Nachrichtenverlauf" onScroll={() => { const node = history.current; if (node) { nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 90; if (nearBottom.current) setJump(false); } }}>
      {resource.data?.hasMore && hasOlder && <div style={{ textAlign: 'center', marginBottom: 18 }}><MessageButton icon="refresh" disabled={busy} onClick={() => void more()}>{busy ? 'Wird geladen …' : 'Ältere Nachrichten laden'}</MessageButton></div>}
      {attachments.error && <MessageNotice error onRetry={() => void attachments.refresh()}>Anhänge konnten nicht geladen werden. {attachments.error}</MessageNotice>}
      {!messages.length && <MessageEmpty title="Das Gespräch ist eröffnet">Schreiben Sie die erste Nachricht oder fügen Sie eine Datei hinzu.</MessageEmpty>}
      {!!messages.length && !matches.length && <MessageEmpty title="Keine passende Nachricht">Versuchen Sie einen anderen Suchbegriff oder laden Sie ältere Nachrichten.</MessageEmpty>}
      {matches.map((message, index) => <Fragment key={message.id}>{(index === 0 || messageDay(matches[index - 1].sentAt) !== messageDay(message.sentAt)) && <div className="mw-day"><span>{messageDay(message.sentAt)}</span></div>}{message.isSystemMessage ? <div className="mw-system">{message.body}</div> : <article className={`mw-message${message.senderProfileId === actor.profileId ? ' mw-message--own' : ''}${message.isInternalNote ? ' mw-message--note' : ''}`} aria-label={`${message.senderDisplayName}, ${messageTime(message.sentAt, true)}`}><div className="mw-message-bubble"><div className="mw-message-sender">{message.senderProfileId === actor.profileId ? 'Sie' : message.senderDisplayName}{message.isInternalNote && <span className="mw-tag mw-tag--note">Interne Notiz</span>}</div><div className="mw-message-body">{message.body}</div>{!!filesByMessage.get(message.id)?.length && <div className="mw-file-list">{filesByMessage.get(message.id)!.map(attachment => <MessageFile key={attachment.id} actor={actor} threadId={threadId} attachment={attachment} />)}</div>}<div className="mw-message-meta"><time title={messageTime(message.sentAt, true)}>{new Date(message.sentAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</time>{message.senderProfileId === actor.profileId && !message.isInternalNote && <span title={message.readAt && preferences?.showReadReceipts ? `Gelesen: ${messageTime(message.readAt, true)}` : 'Gespeichert und gesendet'}>{message.readAt && preferences?.showReadReceipts ? 'Gelesen' : 'Gesendet'}</span>}</div>{(can('office.messages.archive') || can('office.messages.delete')) && <details className="mw-message-tools"><summary aria-label="Nachrichtenaktionen">Aktionen</summary><div className="mw-actions">{can('office.messages.archive') && <MessageButton icon="archive" disabled={busy || sending} onClick={() => void remove(message, 'archived')}>Archivieren</MessageButton>}{can('office.messages.delete') && <MessageButton icon="trash" disabled={busy || sending} onClick={() => void remove(message, 'deleted')}>Entfernen</MessageButton>}</div></details>}</div></article>}</Fragment>)}
    </div>{jump && <MessageButton className="mw-jump" onClick={scrollBottom}>Zu den neuesten Nachrichten</MessageButton>}
    {thread.isClosed ? <div className="mw-composer"><MessageNotice>Dieses Gespräch ist {thread.status === 'archived' ? 'archiviert' : 'abgeschlossen'}.</MessageNotice>{canWrite && <MessageButton style={{ marginTop: 10 }} disabled={busy} icon="refresh" onClick={() => void change({ status: 'in_progress' })}>Gespräch wieder öffnen</MessageButton>}</div> : canWrite && preferences ? <MessageComposer actor={actor} draft={draft} onChange={onDraft} onSend={onSend} sending={sending || busy} canNote={can('communication.send_internal_note') && preferences.internalNotesEnabled} onBusyChange={composeBusy} onOpenTemplates={onOpenTemplates} preferences={preferences} templateVersion={templateVersion} canVoice={can('communication.send_voice_message')} /> : <div className="mw-composer"><MessageNotice>{canWrite ? 'Die Nachrichteneinstellungen werden benötigt, bevor Sie antworten können.' : 'Sie können dieses Gespräch lesen. Zum Antworten benötigen Sie die entsprechende Berechtigung.'}</MessageNotice></div>}
    </div>{details && <aside className="mw-detail-panel" aria-label="Gesprächsdetails"><div className="mw-detail-heading"><h3>Gesprächsdetails</h3><MessageButton icon="close" aria-label="Details schließen" onClick={() => setDetails(false)} /></div><dl><div><dt>Betreff</dt><dd>{thread.subject}</dd></div><div><dt>Teilnehmende</dt><dd>{thread.employeeParticipantNames?.length ? thread.employeeParticipantNames.join(', ') : thread.participantName || name}</dd></div><div><dt>Zuständig</dt><dd>{thread.assignedToUserName || 'Noch nicht zugewiesen'}</dd></div><div><dt>Eröffnet</dt><dd>{messageTime(thread.createdAt, true)}</dd></div></dl>
      <div><div className="mw-field"><label htmlFor="mw-status">Status</label><select id="mw-status" disabled={!canWrite || busy || sending} value={thread.status} onChange={event => void change({ status: event.target.value as ConversationPatch['status'] })}>{Object.entries(OFFICE_THREAD_STATUS_LABELS).filter(([key]) => !['deleted', 'open', 'waiting', 'new', 'archived'].includes(key) || key === thread.status).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="mw-field"><label htmlFor="mw-priority">Priorität</label><select id="mw-priority" disabled={!canWrite || busy || sending} value={thread.priority} onChange={event => void change({ priority: event.target.value as ConversationPatch['priority'] })}>{MESSAGE_PRIORITIES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div><div className="mw-field"><label htmlFor="mw-category">Kategorie</label><select id="mw-category" disabled={!canWrite || busy || sending || !!categories.error} value={thread.categoryId ?? ''} onChange={event => void change({ categoryId: event.target.value || null })}><option value="">Ohne Kategorie</option>{thread.categoryId && !filteredCategories.some(item => item.id === thread.categoryId) && <option value={thread.categoryId}>{thread.categoryLabel || 'Bisherige Kategorie'}</option>}{filteredCategories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div></div>
      <div className="mw-detail-actions">{canWrite && <MessageButton icon="people" disabled={busy || sending} onClick={() => void change({ assignedToUserId: thread.assignedToUserId === actor.profileId ? null : actor.profileId })}>{thread.assignedToUserId === actor.profileId ? 'Zuweisung aufheben' : 'Mir zuweisen'}</MessageButton>}<MessageButton icon="download" disabled={busy} onClick={() => void download()}>Verlauf herunterladen</MessageButton>{can('office.messages.archive') && thread.status !== 'archived' && <MessageButton icon="archive" disabled={busy || sending} onClick={() => void change({ status: 'archived' })}>Gespräch archivieren</MessageButton>}{can('office.messages.delete') && <MessageButton tone="danger" icon="trash" disabled={busy || sending} onClick={() => void change({ status: 'deleted' })}>Gespräch entfernen</MessageButton>}</div><small>Der Export enthält den Text aller verfügbaren Nachrichten einschließlich interner Notizen. Dateien laden Sie direkt im Verlauf herunter.</small>
    </aside>}</div>
  </>;
}
