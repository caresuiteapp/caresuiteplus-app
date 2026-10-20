import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { CareDateInput } from '@/components/inputs/CareDateInput';
import { CareTimeInput } from '@/components/inputs/CareTimeInput';
import { NativeAction, NativeField, nativeWorkspaceStyles as ui } from '@/components/ui/NativeWorkspaceUi';
import { invokeGoogleWorkspaceAction as invoke } from '@/lib/googleWorkspace/googleWorkspaceService';
import { encodeMail, googleLink, type WorkspaceItem, type WorkspaceService } from '@/lib/googleWorkspace/workspaceModel';

export function WorkspaceActionForm({ service, taskListId, item, onSaved, onCancel }: { service: WorkspaceService; taskListId?: string; item?: WorkspaceItem; onSaved: (message: string, url?: string) => void; onCancel: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset>(); const [mode, setMode] = useState<'upload' | 'folder'>('upload'); const [meet, setMeet] = useState(service === 'meet');
  const lock = useRef(false); const value = (key: string) => values[key]?.trim() ?? ''; const update = (key: string, next: string) => setValues(previous => ({ ...previous, [key]: next }));
  const titles: Record<WorkspaceService, string> = { gmail: 'Neue E-Mail', calendar: 'Termin anlegen', meet: 'Videotermin planen', drive: 'Datei oder Ordner hinzufügen', docs: 'Dokument erstellen', sheets: 'Tabelle erstellen', slides: 'Präsentation erstellen', tasks: 'Aufgabe anlegen', contacts: 'Kontakt anlegen', chat: `Nachricht an ${item?.title ?? 'Space'}` };
  const pickFile = async () => { setError(''); try { const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false }); if (!result.canceled) { const chosen = result.assets[0]; if (!chosen.size || chosen.size > 5 * 1024 * 1024) throw new Error('Die Datei muss zwischen 1 Byte und 5 MB groß sein.'); setFile(chosen); } } catch (e) { setError(e instanceof Error ? e.message : 'Datei konnte nicht ausgewählt werden.'); } };
  const save = async (draft = false) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      let result: any; let url: string | undefined; let message = 'Erfolgreich in Google gespeichert.';
      if (!['contacts', 'chat'].includes(service) && !(service === 'drive' && mode === 'upload') && !value('title')) throw new Error('Bitte einen Titel oder Betreff eingeben.');
      if (service === 'gmail') { result = await invoke(draft ? 'gmail_draft' : 'gmail_send', { raw: encodeMail(value('to'), value('title'), value('body')) }, true); message = draft ? 'Entwurf in Gmail gespeichert.' : `E-Mail an ${value('to')} gesendet.`; }
      else if (service === 'calendar' || service === 'meet') {
        const start = new Date(`${value('startDate')}T${value('startTime')}:00`); const end = new Date(`${value('endDate')}T${value('endTime')}:00`);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || !(end > start)) throw new Error('Beginn und Ende vollständig eingeben. Das Ende muss nach dem Beginn liegen.');
        if (value('attendee') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('attendee'))) throw new Error('Bitte eine gültige E-Mail-Adresse für die Einladung eingeben.');
        result = await invoke<any>('calendar_create', { event: { summary: value('title'), description: value('body'), start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, ...(value('attendee') ? { attendees: [{ email: value('attendee') }] } : {}) }, createMeet: meet, requestId: Crypto.randomUUID(), sendUpdates: 'all' }, true);
        url = googleLink(result.htmlLink) ?? undefined; message = meet ? 'Videotermin im Google-Kalender gespeichert.' : 'Termin im Google-Kalender gespeichert.';
      } else if (service === 'drive') {
        if (mode === 'folder') result = await invoke<any>('drive_create_folder', { name: value('title') }, true);
        else { if (!file) throw new Error('Bitte eine Datei auswählen.'); const local = new File(file.uri); if (!local.exists || local.size > 5 * 1024 * 1024 || local.size < 1) throw new Error('Die Datei ist nicht verfügbar oder größer als 5 MB.'); result = await invoke<any>('drive_upload', { name: file.name, mimeType: file.mimeType || 'application/octet-stream', base64: await local.base64() }, true); }
        url = googleLink(result.webViewLink) ?? `https://drive.google.com/open?id=${encodeURIComponent(result.id)}`;
      } else if (['docs', 'sheets', 'slides'].includes(service)) {
        result = await invoke<any>(`${service}_create`, { title: value('title') }, true); const id = result.documentId || result.spreadsheetId || result.presentationId;
        url = `https://docs.google.com/${service === 'docs' ? 'document' : service === 'sheets' ? 'spreadsheets' : 'presentation'}/d/${encodeURIComponent(id)}/edit`;
      } else if (service === 'tasks') { result = await invoke('tasks_create', { taskListId: taskListId || '@default', task: { title: value('title'), notes: value('body'), ...(value('due') ? { due: `${value('due')}T00:00:00.000Z` } : {}) } }, true); }
      else if (service === 'contacts') { if (!value('first')) throw new Error('Bitte einen Vornamen eingeben.'); if (value('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email'))) throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.'); result = await invoke('contacts_create', { person: { names: [{ givenName: value('first'), familyName: value('last') }], ...(value('email') ? { emailAddresses: [{ value: value('email') }] } : {}), ...(value('phone') ? { phoneNumbers: [{ value: value('phone') }] } : {}) } }, true); }
      else { if (!item || !value('body')) throw new Error('Einen Space auswählen und die Nachricht eingeben.'); result = await invoke('chat_send', { space: item.id, message: { text: value('body') } }, true); message = `Nachricht an „${item.title}“ gesendet.`; }
      onSaved(message, url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen. Ihre Eingaben bleiben erhalten.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const field = (key: string, label: string, email = false, multiline = false) => <NativeField label={label} value={values[key] ?? ''} onChangeText={next => update(key, next)} editable={!busy} keyboardType={email ? 'email-address' : 'default'} autoCapitalize={email ? 'none' : 'sentences'} multiline={multiline} maxLength={multiline ? 20000 : 250} />;
  return <View style={ui.surface}>
    <Text accessibilityRole="header" style={ui.title}>{titles[service]}</Text>{error ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
    {service === 'drive' ? <View style={ui.row}><NativeAction label="Datei hochladen" selected={mode === 'upload'} disabled={busy} onPress={() => setMode('upload')} /><NativeAction label="Ordner anlegen" selected={mode === 'folder'} disabled={busy} onPress={() => setMode('folder')} /></View> : null}
    {service === 'gmail' ? field('to', 'Empfänger:in', true) : null}
    {!['contacts', 'chat'].includes(service) && !(service === 'drive' && mode === 'upload') ? field('title', service === 'gmail' ? 'Betreff' : 'Titel') : null}
    {service === 'drive' && mode === 'upload' ? <><NativeAction label={file?.name ?? 'Datei auswählen · bis 5 MB'} disabled={busy} onPress={() => void pickFile()} />{file?.size ? <Text style={ui.muted}>{Math.ceil(file.size / 1024)} KB</Text> : null}</> : null}
    {service === 'calendar' || service === 'meet' ? <><CareDateInput label="Beginn · Datum" value={value('startDate')} onChange={next => update('startDate', next)} onDarkSurface /><CareTimeInput label="Beginn · Ortszeit" value={value('startTime')} onChange={next => update('startTime', next)} onDarkSurface /><CareDateInput label="Ende · Datum" value={value('endDate')} onChange={next => update('endDate', next)} onDarkSurface /><CareTimeInput label="Ende · Ortszeit" value={value('endTime')} onChange={next => update('endTime', next)} onDarkSurface />{field('attendee', 'Teilnehmer:in einladen (optional)', true)}<Text style={ui.muted}>Google sendet der angegebenen Adresse eine Einladung.</Text>{service === 'calendar' ? <NativeAction label={meet ? '✓ Google-Meet-Link erstellen' : 'Google-Meet-Link erstellen'} selected={meet} disabled={busy} onPress={() => setMeet(!meet)} /> : null}</> : null}
    {service === 'tasks' ? <CareDateInput label="Fällig am (optional)" value={value('due')} onChange={next => update('due', next)} onDarkSurface /> : null}
    {service === 'contacts' ? <>{field('first', 'Vorname')}{field('last', 'Nachname')}{field('email', 'E-Mail (optional)', true)}{field('phone', 'Telefon (optional)')}</> : null}
    {['gmail', 'calendar', 'meet', 'tasks', 'chat'].includes(service) ? field('body', service === 'gmail' || service === 'chat' ? 'Nachricht' : 'Beschreibung (optional)', false, true) : null}
    <Text style={ui.muted}>{service === 'gmail' || service === 'chat' ? 'Mit „Senden“ wird die Nachricht an den angegebenen Empfänger übermittelt.' : 'Mit „Speichern“ wird der Eintrag im verbundenen Google-Konto angelegt.'}</Text>
    <View style={ui.row}><NativeAction label={service === 'gmail' || service === 'chat' ? 'Senden' : 'Speichern'} primary busy={busy} onPress={() => void save()} />{service === 'gmail' ? <NativeAction label="Als Entwurf speichern" disabled={busy} onPress={() => void save(true)} /> : null}<NativeAction label="Abbrechen" disabled={busy} onPress={onCancel} /></View>
  </View>;
}
