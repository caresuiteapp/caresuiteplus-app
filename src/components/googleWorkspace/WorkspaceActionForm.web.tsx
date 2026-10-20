import { useRef, useState } from 'react';
import { invokeGoogleWorkspaceAction as invoke } from '@/lib/googleWorkspace/googleWorkspaceService';
import { encodeMail, googleLink, type WorkspaceService, type WorkspaceItem } from '@/lib/googleWorkspace/workspaceModel';

type Props = { service: WorkspaceService; taskListId?: string; item?: WorkspaceItem; onSaved: (message: string, url?: string) => void; onCancel: () => void };
export function WorkspaceActionForm({ service, taskListId, item, onSaved, onCancel }: Props) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const [mode, setMode] = useState(service === 'drive' ? 'upload' : 'create');
  const titles: Record<WorkspaceService, string> = { gmail: 'Neue E-Mail', calendar: 'Termin anlegen', meet: 'Videotermin planen', drive: 'Datei oder Ordner hinzufügen', docs: 'Dokument erstellen', sheets: 'Tabelle erstellen', slides: 'Präsentation erstellen', tasks: 'Aufgabe anlegen', contacts: 'Kontakt anlegen', chat: `Nachricht an ${item?.title ?? 'Space'}` };
  const submit = async (form: HTMLFormElement, draft: boolean) => {
    if (lock.current || !form.reportValidity()) return;
    lock.current = true; setBusy(true); setError('');
    const data = new FormData(form); const value = (key: string) => String(data.get(key) ?? '').trim();
    try {
      let result: any; let url: string | undefined; let message = 'Erfolgreich in Google gespeichert.';
      if (service === 'gmail') {
        result = await invoke(draft ? 'gmail_draft' : 'gmail_send', { raw: encodeMail(value('to'), value('title'), value('body')) }, true);
        message = draft ? 'Entwurf in Gmail gespeichert.' : `E-Mail an ${value('to')} gesendet.`;
      } else if (service === 'calendar' || service === 'meet') {
        const start = new Date(value('start')), end = new Date(value('end'));
        if (!(end.getTime() > start.getTime())) throw new Error('Das Ende muss nach dem Beginn liegen.');
        const createMeet = service === 'meet' || data.get('meet') === 'on';
        result = await invoke<any>('calendar_create', { event: { summary: value('title'), description: value('body'), start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, ...(value('attendee') ? { attendees: [{ email: value('attendee') }] } : {}) }, createMeet, requestId: crypto.randomUUID(), sendUpdates: 'all' }, true);
        url = googleLink(result.htmlLink) ?? undefined;
        message = createMeet ? 'Videotermin gespeichert. Falls Google den Meet-Link noch erstellt, aktualisieren Sie die Terminliste in Kürze.' : 'Termin im Google-Kalender gespeichert.';
      } else if (service === 'drive') {
        if (mode === 'folder') result = await invoke<any>('drive_create_folder', { name: value('title') }, true);
        else {
          const file = data.get('file') as File;
          if (!file?.size) throw new Error('Bitte eine Datei auswählen.');
          if (file.size > 5 * 1024 * 1024) throw new Error('Die Datei darf höchstens 5 MB groß sein.');
          const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.')); reader.readAsDataURL(file); });
          result = await invoke<any>('drive_upload', { name: file.name, mimeType: file.type || 'application/octet-stream', base64 }, true);
        }
        url = googleLink(result.webViewLink) ?? `https://drive.google.com/open?id=${encodeURIComponent(result.id)}`;
      } else if (['docs', 'sheets', 'slides'].includes(service)) {
        result = await invoke<any>(`${service}_create`, { title: value('title') }, true);
        const id = result.documentId || result.spreadsheetId || result.presentationId;
        const path = service === 'docs' ? 'document' : service === 'sheets' ? 'spreadsheets' : 'presentation';
        url = `https://docs.google.com/${path}/d/${encodeURIComponent(id)}/edit`;
      } else if (service === 'tasks') {
        result = await invoke('tasks_create', { taskListId: taskListId || '@default', task: { title: value('title'), notes: value('body'), ...(value('due') ? { due: `${value('due')}T00:00:00.000Z` } : {}) } }, true);
      } else if (service === 'contacts') {
        result = await invoke('contacts_create', { person: { names: [{ givenName: value('first'), familyName: value('last') }], ...(value('email') ? { emailAddresses: [{ value: value('email') }] } : {}), ...(value('phone') ? { phoneNumbers: [{ value: value('phone') }] } : {}) } }, true);
      } else {
        if (!item) throw new Error('Bitte zuerst einen Space auswählen.');
        result = await invoke('chat_send', { space: item.id, message: { text: value('body') } }, true); message = `Nachricht an „${item.title}“ gesendet.`;
      }
      onSaved(message, url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <form className="cs-w-form cs-w-stack" onSubmit={e => { e.preventDefault(); void submit(e.currentTarget, false); }} aria-label={titles[service]}>
    <div className="cs-w-row cs-w-between"><h3>{titles[service]}</h3><button className="cs-w-button small" type="button" disabled={busy} onClick={onCancel}>Abbrechen</button></div>
    {error && <div className="cs-w-notice error" role="alert">{error}</div>}
    {service === 'drive' && <label className="cs-w-field">Aktion<select value={mode} onChange={e => setMode(e.target.value)} disabled={busy}><option value="upload">Datei hochladen (bis 5 MB)</option><option value="folder">Ordner anlegen</option></select></label>}
    <div className="cs-w-form-grid">
      {service === 'gmail' && <label className="cs-w-field full">Empfänger:in<input required type="email" name="to" autoComplete="off" maxLength={254}/></label>}
      {!['contacts', 'chat'].includes(service) && !(service === 'drive' && mode === 'upload') && <label className="cs-w-field full">{service === 'gmail' ? 'Betreff' : 'Titel'}<input name="title" required maxLength={250}/></label>}
      {service === 'drive' && mode === 'upload' && <label className="cs-w-field full">Datei<input type="file" name="file" required/></label>}
      {(service === 'calendar' || service === 'meet') && <><label className="cs-w-field">Beginn (Ortszeit)<input type="datetime-local" required name="start"/></label><label className="cs-w-field">Ende (Ortszeit)<input type="datetime-local" required name="end"/></label><label className="cs-w-field full">Teilnehmer:in einladen (optional)<input type="email" name="attendee"/><span className="cs-w-muted">Google sendet dieser Adresse eine Einladung.</span></label>{service === 'calendar' && <label className="cs-w-check full"><input type="checkbox" name="meet"/>Google-Meet-Link erstellen</label>}</>}
      {service === 'tasks' && <label className="cs-w-field full">Fällig am (optional)<input type="date" name="due"/></label>}
      {service === 'contacts' && <><label className="cs-w-field">Vorname<input name="first" required maxLength={100}/></label><label className="cs-w-field">Nachname<input name="last" maxLength={100}/></label><label className="cs-w-field">E-Mail<input type="email" name="email"/></label><label className="cs-w-field">Telefon<input type="tel" name="phone"/></label></>}
      {['gmail', 'calendar', 'meet', 'tasks', 'chat'].includes(service) && <label className="cs-w-field full">{service === 'gmail' || service === 'chat' ? 'Nachricht' : 'Beschreibung (optional)'}<textarea name="body" required={service === 'gmail' || service === 'chat'} maxLength={20000}/></label>}
    </div>
    <p className="cs-w-muted">{service === 'gmail' || service === 'chat' ? 'Mit „Senden“ wird Ihre Nachricht an den angezeigten Empfänger übermittelt.' : 'Mit „Speichern“ wird der Eintrag im verbundenen Google-Konto angelegt.'}</p>
    <div className="cs-w-row"><button disabled={busy} className="cs-w-button primary" type="submit">{busy ? 'Wird verarbeitet …' : service === 'gmail' || service === 'chat' ? 'Senden' : 'Speichern'}</button>{service === 'gmail' && <button type="button" className="cs-w-button" disabled={busy} onClick={e => { const form = e.currentTarget.form; if (form) void submit(form, true); }}>Als Entwurf speichern</button>}</div>
  </form>;
}
