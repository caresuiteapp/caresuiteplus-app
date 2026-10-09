import { useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { CareDateInput } from '@/components/inputs/CareDateInput';
import { NativeAction, NativeField, nativeWorkspaceStyles as ui } from '@/components/ui/NativeWorkspaceUi';
import { invokeGoogleWorkspaceAction as invoke, type GoogleWorkspaceConnection } from '@/lib/googleWorkspace/googleWorkspaceService';
import { useWorkspacePage, refreshWorkspaceData } from '@/hooks/useGoogleWorkspace.native';
import { googleTime, plainMail, serviceDefinition, type WorkspaceItem, type WorkspaceService } from '@/lib/googleWorkspace/workspaceModel';
import type { WorkspaceFilter } from '@/lib/googleWorkspace/workspaceData';
import { WorkspaceActionForm } from './WorkspaceActionForm.native';

export function WorkspaceServicePanel({ service, connection, scope }: { service: WorkspaceService; connection: GoogleWorkspaceConnection; scope: string }) {
  const definition = serviceDefinition(service); const [filter, setFilter] = useState<WorkspaceFilter>({}); const [query, setQuery] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [pages, setPages] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(); const [form, setForm] = useState(false); const [chatItem, setChatItem] = useState<WorkspaceItem>();
  const [success, setSuccess] = useState<{ message: string; url?: string }>(); const [error, setError] = useState('');
  const [lists, setLists] = useState<{ id: string; title: string }[]>([]); const [listError, setListError] = useState(''); const [listAttempt, setListAttempt] = useState(0);
  const needsDrive = ['docs', 'sheets', 'slides'].includes(service); const enabled = connection.capabilities[service] && (!needsDrive || connection.capabilities.drive);
  const result = useWorkspacePage(service, filter, enabled, connection.connectedAt ?? connection.email ?? '');
  const reset = (next: WorkspaceFilter) => { setFilter({ ...next, pageToken: undefined }); setPages([]); setSelected(undefined); };
  useEffect(() => {
    if (service !== 'tasks' || !enabled) return;
    let active = true; setListError('');
    void (async () => { const all: { id: string; title: string }[] = []; let token: string | undefined; const seen = new Set<string>();
      do { const page = await invoke<{ items?: typeof all; nextPageToken?: string }>('tasks_lists', { pageToken: token }); all.push(...(page.items ?? [])); token = page.nextPageToken; if (token && seen.has(token)) throw new Error('Die nächste Aufgabenliste konnte nicht eindeutig geladen werden.'); if (token) seen.add(token); } while (token && active);
      if (active) setLists(all);
    })().catch(e => { if (active) setListError(e instanceof Error ? e.message : 'Aufgabenlisten konnten nicht geladen werden.'); });
    return () => { active = false; };
  }, [service, enabled, listAttempt]);
  const saved = (message: string, url?: string) => { setForm(false); setChatItem(undefined); setSelected(undefined); setSuccess({ message, url }); refreshWorkspaceData(scope); };
  const apply = () => { if (from && to && from > to) { setError('Das Ende muss am oder nach dem Beginn liegen.'); return; } setError(''); reset({ ...filter, query, from, to }); };
  return <View style={ui.stack}>
    <Text accessibilityRole="header" style={ui.title}>{definition.title}</Text><Text style={ui.body}>{definition.description}</Text>
    <View style={ui.row}><NativeAction label="Aktualisieren" disabled={!enabled} busy={result.loading} onPress={() => void result.refresh()} />{service !== 'chat' ? <NativeAction label={service === 'gmail' ? 'E-Mail schreiben' : service === 'drive' ? 'Hinzufügen' : 'Neu erstellen'} primary disabled={!connection.capabilities[service]} onPress={() => { setSuccess(undefined); setForm(true); }} /> : null}</View>
    {success ? <View style={ui.surface}><Text accessibilityLiveRegion="polite" style={ui.body}>{success.message}</Text>{success.url ? <NativeAction label="In Google öffnen" onPress={() => void Linking.openURL(success.url!)} /> : null}</View> : null}
    {form ? <WorkspaceActionForm service={service} taskListId={filter.taskListId} item={chatItem} onSaved={saved} onCancel={() => { setForm(false); setChatItem(undefined); }} /> : null}
    {!enabled ? <Text style={ui.body}>{needsDrive && connection.capabilities[service] ? 'Zum Auflisten der Dateien fehlt die Google-Drive-Freigabe. Neue Dateien können Sie oben erstellen.' : `Die Google-Freigabe für ${definition.title} fehlt.`} Erteilen Sie die Berechtigung über „Freigaben verwalten“.</Text> : <>
      {['gmail', 'drive', 'docs', 'sheets', 'slides'].includes(service) ? <NativeField label={service === 'gmail' ? 'Postfach durchsuchen' : 'Dateiname suchen'} value={query} onChangeText={setQuery} onSubmitEditing={apply} returnKeyType="search" autoCorrect={false} /> : null}
      {service === 'calendar' || service === 'meet' ? <><CareDateInput label="Von" value={from} onChange={setFrom} onDarkSurface /><CareDateInput label="Bis" value={to} onChange={setTo} onDarkSurface /></> : null}
      {service === 'tasks' ? <><Text style={ui.label}>Aufgabenliste</Text><View style={ui.row}>{[{ id: '@default', title: 'Standardliste' }, ...lists].map(list => <NativeAction key={list.id} label={list.title} selected={list.id === (filter.taskListId || '@default')} onPress={() => reset({ ...filter, taskListId: list.id })} />)}</View><NativeAction label={filter.completed ? '✓ Erledigte einbeziehen' : 'Erledigte einbeziehen'} selected={filter.completed} onPress={() => reset({ ...filter, completed: !filter.completed })} /></> : null}
      {!['tasks', 'contacts', 'chat'].includes(service) ? <NativeAction label="Auswahl anwenden" onPress={apply} /> : null}
      {error ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
      {listError ? <View style={ui.stack}><Text accessibilityRole="alert" style={ui.error}>{listError}</Text><NativeAction label="Aufgabenlisten erneut laden" onPress={() => setListAttempt(value => value + 1)} /></View> : null}
      {result.error ? <View style={ui.stack}><Text accessibilityRole="alert" style={ui.error}>{result.error}</Text>{result.data ? <Text style={ui.muted}>Die Einträge stammen vom letzten erfolgreichen Abruf.</Text> : null}<NativeAction label="Erneut versuchen" onPress={() => void result.refresh()} /></View> : null}
      {result.loading ? <Text accessibilityLiveRegion="polite" style={ui.muted}>{definition.title} wird geladen …</Text> : null}
      {result.data ? <Text style={ui.muted}>{result.data.items.length} Einträge · Abruf: {googleTime(result.data.fetchedAt)}</Text> : null}
      {result.data?.items.map(item => <View key={item.id} style={ui.surface}><NativeAction label={`${item.unread ? '● ' : ''}${item.completed ? '✓ ' : ''}${item.title}`} selected={selected === item.id} onPress={() => setSelected(selected === item.id ? undefined : item.id)} /><Text selectable style={ui.body}>{item.subtitle}</Text>{item.when ? <Text style={ui.muted}>{googleTime(item.when)}</Text> : null}
        {item.url ? <NativeAction label={service === 'meet' ? 'Teilnehmen' : 'In Google öffnen'} onPress={() => void Linking.openURL(item.url!)} /> : null}
        {service === 'chat' ? <NativeAction label="Nachricht schreiben" onPress={() => { setChatItem(item); setForm(true); setSuccess(undefined); }} /> : null}
        {selected === item.id ? <ItemDetail key={item.id} service={service} item={item} email={connection.email} taskListId={filter.taskListId} onSaved={saved} /> : null}
      </View>)}
      {!result.loading && !result.error && !result.data?.items.length ? <View style={ui.surface}><Text style={ui.title}>Keine Einträge gefunden</Text><Text style={ui.body}>Passen Sie die Auswahl an oder erstellen Sie einen Eintrag.</Text></View> : null}
      <View style={ui.row}><NativeAction label="Vorherige Seite" disabled={!pages.length || result.loading} onPress={() => { const previous = [...pages]; const token = previous.pop(); setPages(previous); setFilter({ ...filter, pageToken: token || undefined }); setSelected(undefined); }} /><NativeAction label="Weitere laden" disabled={!result.data?.nextPageToken || result.loading} onPress={() => { setPages([...pages, filter.pageToken || '']); setFilter({ ...filter, pageToken: result.data?.nextPageToken }); setSelected(undefined); }} /></View>
    </>}
  </View>;
}

function ItemDetail({ service, item, email, taskListId, onSaved }: { service: WorkspaceService; item: WorkspaceItem; email: string | null; taskListId?: string; onSaved: (message: string) => void }) {
  const [message, setMessage] = useState<any>(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [attempt, setAttempt] = useState(0); const lock = useRef(false);
  useEffect(() => { if (service !== 'gmail') return; let active = true; setError(''); setMessage(undefined); void invoke<any>('gmail_read', { id: item.id }).then(result => { if (active) setMessage(result); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Nachricht konnte nicht geladen werden.'); }); return () => { active = false; }; }, [service, item.id, attempt]);
  const change = async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await invoke(service === 'tasks' ? 'tasks_update' : 'gmail_modify', service === 'tasks' ? { id: item.id, taskListId: taskListId || '@default', task: { status: item.completed ? 'needsAction' : 'completed' } } : { id: item.id, removeLabelIds: ['UNREAD'] }, true); onSaved(service === 'tasks' ? 'Aufgabenstatus in Google aktualisiert.' : 'E-Mail als gelesen markiert.'); } catch (e) { setError(e instanceof Error ? e.message : 'Änderung fehlgeschlagen.'); } finally { lock.current = false; setBusy(false); } };
  return <View style={ui.stack}>
    {error ? <><Text accessibilityRole="alert" style={ui.error}>{error}</Text>{service === 'gmail' ? <NativeAction label="Nachricht erneut laden" onPress={() => setAttempt(value => value + 1)} /> : null}</> : null}
    {service === 'gmail' ? <><Text selectable style={ui.body}>{message ? plainMail(message.payload) || 'Diese Nachricht enthält keinen Klartext. Öffnen Sie Gmail für die vollständige Nachricht und Anhänge.' : error ? '' : 'Nachricht wird geladen …'}</Text><NativeAction label="In Gmail öffnen / antworten" onPress={() => void Linking.openURL(`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email || '')}#inbox/${encodeURIComponent(item.raw?.threadId || item.id)}`)} />{item.unread ? <NativeAction label="Als gelesen markieren" busy={busy} onPress={() => void change()} /> : null}</> : <><Text selectable style={ui.body}>{service === 'tasks' ? item.raw?.notes || 'Keine Notizen.' : service === 'calendar' || service === 'meet' ? item.raw?.description?.replace(/<[^>]*>/g, '') || 'Keine Beschreibung.' : item.subtitle}</Text>{service === 'tasks' ? <NativeAction label={item.completed ? 'Wieder öffnen' : 'Als erledigt markieren'} busy={busy} onPress={() => void change()} /> : null}{service === 'calendar' || service === 'meet' ? <Text style={ui.muted}>Ende: {googleTime(item.raw?.end?.dateTime || item.raw?.end?.date)}</Text> : null}</>}
  </View>;
}
