import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { confirmAction } from '@/lib/platform/confirmAction';
import { SupportAccessPanel } from './SupportAccessPanel';
import {
  SUPPORT_STATUS, downloadSupportAttachment, newSupportNonce, pickSupportAttachment,
  removeSupportDraftAttachment, supportRpc, subscribeSupport,
  type SupportAttachment, type SupportDetail, type SupportMessage, type SupportQueue, type SupportTicket,
} from '@/lib/support/supportService';

import { SupportButton, SupportField, supportDate, supportStyles } from './SupportPrimitives';

export function SupportWorkspace({ platformMode = false, initialSearch = '' }: { platformMode?: boolean; initialSearch?: string }) {
  const [width, setWidth] = useState(0);
  const [queue, setQueue] = useState<SupportQueue | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<SupportDetail | null>(null);
  const [older, setOlder] = useState<SupportMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('technical');
  const [priority, setPriority] = useState('normal');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const sendNonce = useRef(newSupportNonce());
  const createNonce = useRef(newSupportNonce());
  const activeTicket = useRef(selected);
  const mutationLock = useRef(false);
  const oldestLoaded = useRef(false);
  activeTicket.current = selected;
  const wide = width >= 1040;

  const refreshQueue = useCallback(async () => {
    const data = await supportRpc<SupportQueue>('support_list_tickets', { p_search: search.trim(), p_status: status, p_offset: offset });
    setQueue(data);
  }, [offset, search, status]);
  const refreshDetail = useCallback(async () => {
    if (!selected) return;
    const data = await supportRpc<SupportDetail>('support_get_ticket', { p_ticket_id: selected });
    if (activeTicket.current === selected) { setDetail(data); setUpdatedAt(new Date().toISOString()); }
  }, [selected]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const data = await supportRpc<SupportQueue>('support_list_tickets', { p_search: search.trim(), p_status: status, p_offset: offset });
        if (active) setQueue(data);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Support nicht erreichbar.'); }
      finally { if (active) { setLoading(false); timer = setTimeout(load, 15000); } }
    };
    timer = setTimeout(load, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [offset, search, status]);

  useEffect(() => {
    setDetail(null); setOlder([]); setHasOlder(false); oldestLoaded.current = false;
    if (!selected) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const data = await supportRpc<SupportDetail>('support_get_ticket', { p_ticket_id: selected });
        if (active) { setDetail(data); setHasOlder(!oldestLoaded.current && data.messages.length === 100); setUpdatedAt(new Date().toISOString()); }
      } catch (cause) {
        if (active) { setDetail(null); setError(cause instanceof Error ? cause.message : 'Ticket nicht erreichbar.'); }
      } finally { if (active) timer = setTimeout(load, 10000); }
    };
    void load();
    return () => { active = false; clearTimeout(timer); };
  }, [selected]);

  useEffect(() => subscribeSupport(null, () => { void refreshQueue().catch(() => undefined); }), [refreshQueue]);
  useEffect(() => selected ? subscribeSupport(selected, () => { void refreshDetail().catch(() => setDetail(null)); }) : undefined, [selected, refreshDetail]);

  const action = async (run: () => Promise<void>) => {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setError(null);
    try { await run(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Aktion fehlgeschlagen.'); }
    finally { mutationLock.current = false; setBusy(false); }
  };
  const choose = async (ticket: SupportTicket | null, newTicket = false) => {
    if (draft.trim() || attachments.length || (creating && (subject || description))) {
      if (!await confirmAction({ title: 'Ungesendeter Entwurf', message: 'Den Entwurf verwerfen und die andere Ansicht öffnen?', confirmLabel: 'Entwurf verwerfen' })) return;
      for (const file of attachments) await removeSupportDraftAttachment(file);
    }
    setDraft(''); setAttachments([]); setSubject(''); setDescription(''); setError(null);
    sendNonce.current = newSupportNonce(); createNonce.current = newSupportNonce();
    setSelected(ticket?.id ?? null); setCreating(newTicket);
  };
  const create = () => action(async () => {
    if (subject.trim().length < 3 || !description.trim()) throw new Error('Bitte einen Betreff und eine Beschreibung eingeben.');
    const ticket = await supportRpc<SupportTicket>('support_create_ticket', { p_subject: subject.trim(), p_body: description.trim(), p_category: category, p_priority: priority, p_client_nonce: createNonce.current });
    setSelected(ticket.id); setCreating(false); setSubject(''); setDescription(''); createNonce.current = newSupportNonce();
    await refreshQueue();
  });
  const send = () => action(async () => {
    if (!selected || (!draft.trim() && !attachments.length)) return;
    await supportRpc('support_send_message', { p_ticket_id: selected, p_body: draft.trim(), p_client_nonce: sendNonce.current, p_attachment_ids: attachments.map(file => file.id) });
    setDraft(''); setAttachments([]); sendNonce.current = newSupportNonce();
    await Promise.all([refreshDetail(), refreshQueue()]);
  });
  const changeStatus = (next: string) => action(async () => {
    if (!selected) return;
    if (['resolved','closed'].includes(next) && !await confirmAction({ title: 'Ticket abschließen', message: 'Alle Zugriffsfreigaben zu diesem Ticket werden damit beendet.', confirmLabel: 'Abschließen' })) return;
    await supportRpc('support_set_ticket_status', { p_ticket_id: selected, p_status: next });
    await Promise.all([refreshDetail(), refreshQueue()]);
  });
  const messages = [...new Map([...older, ...(detail?.messages ?? [])].map(message => [message.id, message])).values()].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));

  return <View style={supportStyles.root} onLayout={event => setWidth(event.nativeEvent.layout.width)} testID="support-workspace" {...(Platform.OS === 'web' ? { dataSet: { csSupportSurface: 'light' } } : {})}>
    <View style={supportStyles.hero}><View style={supportStyles.heroCopy}><Text accessibilityRole="header" style={supportStyles.title}>{platformMode ? 'Support-Zentrale' : 'Wir helfen Ihnen weiter.'}</Text><Text style={supportStyles.copy}>{platformMode ? 'Tickets bearbeiten, gemeinsam Lösungen finden und bestätigte Zugriffe nachvollziehen.' : 'Direkter Kontakt zu CareSuite. Nachrichten, Dateien und Freigaben bleiben übersichtlich an einem Ort.'}</Text></View>{!wide && (selected || creating) ? <SupportButton secondary label="Zur Ticketliste" disabled={busy} onPress={() => void action(() => choose(null))} /> : null}{!platformMode && queue?.can_create ? <SupportButton label="Neues Ticket" onPress={() => void action(() => choose(null, true))} disabled={busy} /> : null}</View>
    {error ? <View accessibilityRole="alert" style={supportStyles.error}><Text style={supportStyles.errorText}>{error}</Text><SupportButton secondary label="Aktualisieren" disabled={busy} onPress={() => void action(async () => { await refreshQueue(); await refreshDetail(); })} /></View> : null}
    <View style={[supportStyles.workspace, !wide && supportStyles.stacked]}>
      {wide || (!selected && !creating) ? <View style={[supportStyles.queue, !wide && supportStyles.queueCompact]}>
        <SupportField disabled={busy} label="Tickets suchen" value={search} onChangeText={value => { setSearch(value); setOffset(0); }} maxLength={180} />
        <View accessibilityRole="toolbar" accessibilityLabel="Ticketstatus filtern" style={supportStyles.filters}>
          {[['','Alle'],['open','Offen'],['waiting_support','Support'],['waiting_tenant','Unternehmen'],['resolved','Gelöst'],['closed','Geschlossen']].map(([value,label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: status===value }} onPress={() => { setStatus(value); setOffset(0); }} style={[supportStyles.chip, status===value && supportStyles.chipActive]}><Text style={supportStyles.chipText}>{label}</Text></Pressable>)}
        </View>
        <ScrollView style={supportStyles.queueScroll} contentContainerStyle={supportStyles.queueContent}>
          {loading ? <ActivityIndicator color="#056CE8" accessibilityLabel="Tickets werden geladen" /> : queue?.tickets.length ? queue.tickets.slice(0,50).map(ticket => <Pressable key={ticket.id} accessibilityRole="button" accessibilityState={{ selected: selected===ticket.id }} onPress={() => void action(() => choose(ticket))} style={[supportStyles.ticketCard, selected===ticket.id && supportStyles.ticketSelected]}><View style={supportStyles.row}><Text style={supportStyles.eyebrow}>#{ticket.number}</Text><Text style={supportStyles.small}>{SUPPORT_STATUS[ticket.status]}</Text></View><Text style={supportStyles.ticketTitle}>{ticket.subject}</Text>{platformMode ? <Text style={supportStyles.copy}>{ticket.tenant_name}</Text> : null}<Text numberOfLines={2} style={supportStyles.small}>{ticket.last_message}</Text><Text style={supportStyles.small}>{supportDate(ticket.updated_at)}{ticket.priority==='urgent' ? ' · Dringend' : ticket.priority==='high' ? ' · Hohe Priorität' : ''}</Text></Pressable>) : <Text style={supportStyles.copy}>Keine Tickets in dieser Ansicht.</Text>}
        </ScrollView>
        <View style={supportStyles.row}><SupportButton secondary label="Zurück" disabled={offset===0} onPress={() => setOffset(value => Math.max(0,value-50))} /><SupportButton secondary label="Weitere" disabled={!queue || queue.tickets.length<=50} onPress={() => setOffset(value => value+50)} /></View>
      </View> : null}
      {wide || selected || creating ? <ScrollView style={supportStyles.detailScroll} contentContainerStyle={supportStyles.detailContent} keyboardShouldPersistTaps="handled">
        {creating ? <View style={supportStyles.section}><Text accessibilityRole="header" style={supportStyles.heading}>Neues Support-Ticket</Text><SupportField disabled={busy} label="Betreff" value={subject} onChangeText={value => { setSubject(value); createNonce.current = newSupportNonce(); }} maxLength={180} /><SupportField disabled={busy} label="Was ist passiert?" value={description} onChangeText={value => { setDescription(value); createNonce.current = newSupportNonce(); }} multiline /><Text style={supportStyles.small}>Beschreiben Sie die betroffene Seite und den gewünschten Ablauf. Nach dem Erstellen können Sie Dateien im Chat anhängen.</Text><Text style={supportStyles.label}>Thema</Text><View style={supportStyles.chips}>{[['technical','Technisches Problem'],['account','Unternehmen & Zugang'],['general','Allgemeine Frage']].map(([value,label]) => <SupportButton key={value} secondary={category!==value} label={label} disabled={busy} onPress={() => { setCategory(value); createNonce.current = newSupportNonce(); }} />)}</View><Text style={supportStyles.label}>Priorität</Text><View style={supportStyles.chips}>{[['normal','Normal'],['high','Hoch'],['urgent','Dringend']].map(([value,label]) => <SupportButton key={value} secondary={priority!==value} label={label} disabled={busy} onPress={() => { setPriority(value); createNonce.current = newSupportNonce(); }} />)}</View><SupportButton label={busy ? 'Ticket wird erstellt …' : 'Ticket erstellen'} disabled={busy} onPress={() => void create()} /></View> : detail ? <>
          <View style={supportStyles.section}><View style={supportStyles.row}><Text style={supportStyles.eyebrow}>TICKET #{detail.ticket.number} · {SUPPORT_STATUS[detail.ticket.status]}</Text><Text style={supportStyles.small}>{detail.ticket.assigned_name ? `Betreuung: ${detail.ticket.assigned_name}` : 'Noch nicht zugewiesen'}</Text></View><Text accessibilityRole="header" style={supportStyles.heading}>{detail.ticket.subject}</Text>{platformMode ? <Text style={supportStyles.copy}>{detail.ticket.tenant_name}</Text> : null}<View style={supportStyles.chips}>{platformMode && detail.can_support_write ? <SupportButton secondary label="Ticket übernehmen" disabled={busy} onPress={() => void action(async () => { await supportRpc('support_claim_ticket', { p_ticket_id: selected }); await refreshDetail(); })} /> : null}{detail.can_write ? ['resolved','closed'].includes(detail.ticket.status) ? <SupportButton secondary label="Wieder öffnen" disabled={busy} onPress={() => void changeStatus('open')} /> : <SupportButton secondary label="Als gelöst abschließen" disabled={busy} onPress={() => void changeStatus('resolved')} /> : null}</View></View>
          <View style={supportStyles.section}><View style={supportStyles.row}><Text accessibilityRole="header" style={supportStyles.heading}>Nachrichten</Text><Text style={supportStyles.small}>{updatedAt ? `Abgeglichen ${supportDate(updatedAt)}` : ''}</Text></View>
            {hasOlder && messages.length ? <SupportButton secondary label="Ältere Nachrichten laden" disabled={busy} onPress={() => void action(async () => { const data = await supportRpc<SupportDetail>('support_get_ticket', { p_ticket_id: selected, p_before_message_id: messages[0].id }); setOlder(current => [...data.messages,...current]); oldestLoaded.current = data.messages.length < 100; setHasOlder(!oldestLoaded.current); })} /> : null}
            {messages.map(message => <View key={message.id} style={[supportStyles.message, message.author_kind==='platform' && supportStyles.messageSupport]}><View style={supportStyles.row}><Text style={supportStyles.label}>{message.author_kind==='platform' && !/^CareSuite\b/i.test(message.author_name.trim()) ? 'CareSuite · ' : ''}{message.author_name}</Text><Text style={supportStyles.small}>{supportDate(message.created_at)}</Text></View>{message.body ? <Text selectable style={supportStyles.messageBody}>{message.body}</Text> : null}{message.attachments.map(file => <SupportButton key={file.id} secondary label={`↓ ${file.file_name} (${Math.ceil(file.byte_size/1024)} KB)`} disabled={busy} onPress={() => void action(() => downloadSupportAttachment(file))} />)}</View>)}
            {detail.can_write ? <View style={supportStyles.composer}><SupportField disabled={busy} label="Ihre Nachricht" value={draft} onChangeText={value => { setDraft(value); sendNonce.current=newSupportNonce(); }} multiline />{attachments.map(file => <View key={file.id} style={supportStyles.row}><Text style={supportStyles.copy}>{file.file_name}</Text><SupportButton secondary label="Anhang entfernen" disabled={busy} onPress={() => void action(async () => { await removeSupportDraftAttachment(file); setAttachments(current => current.filter(item => item.id!==file.id)); sendNonce.current = newSupportNonce(); })} /></View>)}<View style={supportStyles.chips}><SupportButton secondary label="Datei anhängen" disabled={busy || attachments.length>=5} onPress={() => void action(async () => { if (!selected) return; const file = await pickSupportAttachment(selected); if (file) { setAttachments(current => [...current,file]); sendNonce.current = newSupportNonce(); } })} /><SupportButton label={busy ? 'Bitte warten …' : 'Nachricht senden'} disabled={busy || (!draft.trim() && !attachments.length)} onPress={() => void send()} /></View><Text style={supportStyles.small}>Bis zu 5 Anhänge, jeweils höchstens 20 MB. {platformMode ? 'Nachrichten und Anhänge werden mit dem Unternehmen geteilt. Weitere Unternehmensdaten sind nur im Rahmen einer bestätigten Zugriffsfreigabe zugänglich.' : 'Nachrichten und Anhänge sind für den CareSuite-Support sichtbar. Zusätzlichen Datenzugriff gibt Ihre berechtigte Unternehmensverwaltung separat frei.'}</Text></View> : null}
          </View>
          <SupportAccessPanel detail={detail} platformMode={platformMode} busy={busy} run={action} refresh={refreshDetail} />
        </> : <View style={supportStyles.section}><Text accessibilityRole="header" style={supportStyles.heading}>{selected ? 'Ticket wird geladen …' : 'Alles zu Ihrer Anfrage an einem Ort.'}</Text><Text style={supportStyles.copy}>{selected ? 'Der aktuelle Verlauf und die Freigaben werden abgerufen.' : 'Wählen Sie ein Ticket aus oder erstellen Sie eine neue Anfrage. Eine Support-Anfrage gibt keinen allgemeinen Zugriff auf Ihre Unternehmensdaten frei.'}</Text></View>}
      </ScrollView> : null}
    </View>
  </View>;
}
