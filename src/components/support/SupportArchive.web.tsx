import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase/client';
import { SupportButton, SupportField, supportDate, supportStyles as s } from './SupportPrimitives';

type Ticket = { id: string; ticket_number: string | null; title: string; status: string; created_at: string; updated_at: string; description: string | null; resolution_summary: string | null };
type Message = { id: string; body: string; created_at: string; is_system_message: boolean | null };
type Attachment = { id: string; file_name: string | null; file_url: string | null; file_size_bytes: number | null };
const statuses: Record<string, string> = { open: 'Offen', waiting_for_customer: 'Antwort des Unternehmens ausstehend', waiting_for_support: 'Antwort des Supports ausstehend', in_progress: 'In Bearbeitung', resolved: 'Gelöst', closed: 'Geschlossen', archived: 'Archiviert' };

/** Read existing records through their existing RLS. No migration, copying or extra grants. */
export function SupportArchive({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [messageOffset, setMessageOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const load = async () => {
      setLoading(true); setError(null); setMessages([]); setAttachments([]); setTickets([]);
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error('Bitte erneut anmelden, um ältere Tickets zu öffnen.');
        if (selected) {
          const conversation = await client.from('support_ticket_messages').select('id,body,created_at,is_system_message').eq('ticket_id', selected.id)
            .or('is_internal_note.is.null,is_internal_note.eq.false').order('created_at').order('id').range(messageOffset, messageOffset + 50).abortSignal(controller.signal);
          if (conversation.error) throw new Error('Der ältere Verlauf ist momentan nicht zugänglich. Bitte erneut laden.');
          const visibleIds = (conversation.data ?? []).slice(0, 50).map(message => message.id);
          let fileQuery = client.from('support_ticket_attachments').select('id,file_name,file_url,file_size_bytes')
            .eq('ticket_id', selected.id).order('created_at').limit(100);
          fileQuery = visibleIds.length ? fileQuery.or(`message_id.is.null,message_id.in.(${visibleIds.join(',')})`) : fileQuery.is('message_id', null);
          const files = await fileQuery.abortSignal(controller.signal);
          if (conversation.error || files.error) throw new Error('Der ältere Verlauf ist momentan nicht zugänglich. Bitte erneut laden.');
          if (active) { setMessages(conversation.data ?? []); setAttachments(files.data ?? []); }
        } else {
          let query = client.from('support_tickets').select('id,ticket_number,title,status,created_at,updated_at,description,resolution_summary')
            .order('updated_at', { ascending: false }).order('id').range(offset, offset + 50);
          if (search.trim()) query = query.ilike('title', `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`);
          const result = await query.abortSignal(controller.signal);
          if (result.error) throw new Error('Ältere Tickets sind momentan nicht zugänglich. Bitte erneut laden oder die Anmeldung erneuern.');
          if (active) setTickets(result.data ?? []);
        }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Verlauf konnte nicht geladen werden.'); }
      finally { clearTimeout(timeout); if (active) setLoading(false); }
    };
    const debounce = setTimeout(() => void load(), selected ? 0 : 250);
    return () => { active = false; clearTimeout(debounce); clearTimeout(timeout); controller.abort(); };
  }, [selected, search, offset, messageOffset, retry]);
  const download = async (file: Attachment) => {
    if (downloading) return;
    setDownloading(true); setError(null);
    try {
      const client = getSupabaseClient();
      const url = new URL(file.file_url ?? '');
      const configured = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
      const path = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
      if (!client || url.origin !== configured.origin || !path) throw new Error('Für diesen älteren Anhang ist kein geschützter Download verfügbar. Bitte den Support mit der Ticketnummer kontaktieren.');
      const { data, error: downloadError } = await client.storage.from(decodeURIComponent(path[1])).download(decodeURIComponent(path[2]));
      if (downloadError || !data) throw new Error('Der Anhang ist nicht verfügbar oder nicht für Sie freigegeben.');
      const objectUrl = URL.createObjectURL(data);
      const link = document.createElement('a'); link.href = objectUrl; link.download = file.file_name || 'Support-Anhang'; link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Anhang nicht verfügbar.'); }
    finally { setDownloading(false); }
  };
  return <View style={s.root} dataSet={{ csSupportSurface: 'light' }}>
    <View style={s.hero}><View style={s.heroCopy}><Text accessibilityRole="header" style={s.title}>Ältere Support-Tickets</Text><Text style={s.copy}>Ihre bisherigen Anfragen bleiben hier nachlesbar. Neue Nachrichten und Freigaben verwalten Sie im aktuellen Support.</Text></View><SupportButton secondary label={selected ? 'Zur Übersicht' : 'Zum aktuellen Support'} onPress={() => selected ? setSelected(null) : onBack()} /></View>
    {error ? <View accessibilityRole="alert" style={s.error}><Text style={s.errorText}>{error}</Text><SupportButton secondary label="Erneut laden" onPress={() => setRetry(value => value + 1)} /></View> : null}
    {!selected ? <SupportField label="Ältere Tickets nach Betreff suchen" value={search} onChangeText={value => { setSearch(value); setOffset(0); }} maxLength={180} /> : null}
    <ScrollView style={s.detailScroll} contentContainerStyle={s.detailContent} keyboardShouldPersistTaps="handled">
      {loading ? <ActivityIndicator accessibilityLabel="Ältere Tickets werden geladen" color="#056CE8" /> : selected ? <>
        <View style={s.section}><Text style={s.eyebrow}>{selected.ticket_number || 'Älteres Ticket'} · {statuses[selected.status] ?? selected.status}</Text><Text accessibilityRole="header" style={s.heading}>{selected.title}</Text><Text style={s.small}>Erstellt {supportDate(selected.created_at)} · Aktualisiert {supportDate(selected.updated_at)}</Text><Text selectable style={s.messageBody}>{selected.description || 'Keine Beschreibung hinterlegt.'}</Text>{selected.resolution_summary ? <><Text style={s.label}>Lösung</Text><Text selectable style={s.messageBody}>{selected.resolution_summary}</Text></> : null}</View>
        {messages.slice(0, 50).map(message => <View key={message.id} style={s.message}><Text style={s.small}>{message.is_system_message ? 'System · ' : ''}{supportDate(message.created_at)}</Text><Text selectable style={s.messageBody}>{message.body}</Text></View>)}
        {!error && !messages.length ? <Text style={s.copy}>Keine weiteren freigegebenen Nachrichten vorhanden.</Text> : null}
        {attachments.map(file => <SupportButton key={file.id} secondary disabled={downloading} label={`Anhang: ${file.file_name || 'Datei'}`} onPress={() => void download(file)} />)}
        <View style={s.row}><SupportButton secondary label="Vorherige Nachrichten" disabled={!messageOffset} onPress={() => setMessageOffset(value => Math.max(0, value - 50))} /><SupportButton secondary label="Weitere Nachrichten" disabled={messages.length <= 50} onPress={() => setMessageOffset(value => value + 50)} /></View>
      </> : <>
        {tickets.slice(0, 50).map(ticket => <View key={ticket.id} style={s.ticketCard}><View style={s.row}><Text style={s.eyebrow}>{ticket.ticket_number || 'Älteres Ticket'}</Text><Text style={s.small}>{statuses[ticket.status] ?? ticket.status}</Text></View><Text style={s.ticketTitle}>{ticket.title}</Text><Text style={s.small}>{supportDate(ticket.updated_at)}</Text><SupportButton secondary label="Verlauf öffnen" onPress={() => { setMessageOffset(0); setSelected(ticket); }} /></View>)}
        {!error && !tickets.length ? <Text style={s.copy}>Keine älteren Tickets für diese Ansicht vorhanden.</Text> : null}
      </>}
    </ScrollView>
    {!selected ? <View style={s.row}><SupportButton secondary label="Zurück" disabled={loading || !offset} onPress={() => setOffset(value => Math.max(0, value - 50))} /><SupportButton secondary label="Weitere" disabled={loading || tickets.length <= 50} onPress={() => setOffset(value => value + 50)} /></View> : null}
  </View>;
}
