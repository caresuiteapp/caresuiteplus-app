// Generated native presentation from src/components/googleWorkspace/WorkspaceActionForm.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeForm,NativeDiv,NativeH3,NativeButton,NativeLabel,NativeSelect,NativeOption,NativeInput,NativeSpan,NativeTextarea,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { nativeBlobDataUrl } from '@/lib/platform/nativeInvoiceLogo.native';
import { useRef, useState } from 'react';
import { invokeGoogleWorkspaceAction as invoke } from '@/lib/googleWorkspace/googleWorkspaceService';
import { encodeMail, googleLink, type WorkspaceService, type WorkspaceItem } from '@/lib/googleWorkspace/workspaceModel';
type Props = {
    service: WorkspaceService;
    taskListId?: string;
    item?: WorkspaceItem;
    onSaved: (message: string, url?: string) => void;
    onCancel: () => void;
};
export function WorkspaceActionForm({ service, taskListId, item, onSaved, onCancel }: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const [mode, setMode] = useState(service === 'drive' ? 'upload' : 'create');
    const [values, setValues] = useState<Record<string, string>>({});
    const [pickedFile, setPickedFile] = useState<Blob & {
        name?: string;
    }>();
    const formRef = useRef<HTMLFormElement>(null);
    const update = (key: string, value: string) => setValues(previous => ({ ...previous, [key]: value }));
    const titles: Record<WorkspaceService, string> = { gmail: 'Neue E-Mail', calendar: 'Termin anlegen', meet: 'Videotermin planen', drive: 'Datei oder Ordner hinzufügen', docs: 'Dokument erstellen', sheets: 'Tabelle erstellen', slides: 'Präsentation erstellen', tasks: 'Aufgabe anlegen', contacts: 'Kontakt anlegen', chat: `Nachricht an ${item?.title ?? 'Space'}` };
    const submit = async (draft: boolean) => {
        if (lock.current || !formRef.current?.reportValidity())
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        const data = { get: (key: string) => key === 'file' ? pickedFile : values[key] };
        const value = (key: string) => (values[key] ?? '').trim();
        try {
            let result: any;
            let url: string | undefined;
            let message = 'Erfolgreich in Google gespeichert.';
            if (service === 'gmail') {
                result = await invoke(draft ? 'gmail_draft' : 'gmail_send', { raw: encodeMail(value('to'), value('title'), value('body')) }, true);
                message = draft ? 'Entwurf in Gmail gespeichert.' : `E-Mail an ${value('to')} gesendet.`;
            }
            else if (service === 'calendar' || service === 'meet') {
                const start = new Date(value('start')), end = new Date(value('end'));
                if (!(end.getTime() > start.getTime()))
                    throw new Error('Das Ende muss nach dem Beginn liegen.');
                const createMeet = service === 'meet' || data.get('meet') === 'on';
                result = await invoke<any>('calendar_create', { event: { summary: value('title'), description: value('body'), start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, ...(value('attendee') ? { attendees: [{ email: value('attendee') }] } : {}) }, createMeet, requestId: crypto.randomUUID(), sendUpdates: 'all' }, true);
                url = googleLink(result.htmlLink) ?? undefined;
                message = createMeet ? 'Videotermin gespeichert. Falls Google den Meet-Link noch erstellt, aktualisieren Sie die Terminliste in Kürze.' : 'Termin im Google-Kalender gespeichert.';
            }
            else if (service === 'drive') {
                if (mode === 'folder')
                    result = await invoke<any>('drive_create_folder', { name: value('title') }, true);
                else {
                    const file = data.get('file') as File;
                    if (!file?.size)
                        throw new Error('Bitte eine Datei auswählen.');
                    if (file.size > 5 * 1024 * 1024)
                        throw new Error('Die Datei darf höchstens 5 MB groß sein.');
                    const base64 = (await nativeBlobDataUrl(file)).split(',')[1];
                    result = await invoke<any>('drive_upload', { name: file.name, mimeType: file.type || 'application/octet-stream', base64 }, true);
                }
                url = googleLink(result.webViewLink) ?? `https://drive.google.com/open?id=${encodeURIComponent(result.id)}`;
            }
            else if (['docs', 'sheets', 'slides'].includes(service)) {
                result = await invoke<any>(`${service}_create`, { title: value('title') }, true);
                const id = result.documentId || result.spreadsheetId || result.presentationId;
                const path = service === 'docs' ? 'document' : service === 'sheets' ? 'spreadsheets' : 'presentation';
                url = `https://docs.google.com/${path}/d/${encodeURIComponent(id)}/edit`;
            }
            else if (service === 'tasks') {
                result = await invoke('tasks_create', { taskListId: taskListId || '@default', task: { title: value('title'), notes: value('body'), ...(value('due') ? { due: `${value('due')}T00:00:00.000Z` } : {}) } }, true);
            }
            else if (service === 'contacts') {
                result = await invoke('contacts_create', { person: { names: [{ givenName: value('first'), familyName: value('last') }], ...(value('email') ? { emailAddresses: [{ value: value('email') }] } : {}), ...(value('phone') ? { phoneNumbers: [{ value: value('phone') }] } : {}) } }, true);
            }
            else {
                if (!item)
                    throw new Error('Bitte zuerst einen Space auswählen.');
                result = await invoke('chat_send', { space: item.id, message: { text: value('body') } }, true);
                message = `Nachricht an „${item.title}“ gesendet.`;
            }
            onSaved(message, url);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    };
    return <NativeForm ref={formRef} className="cs-w-form cs-w-stack" onSubmit={e => { e.preventDefault(); void submit(false); }} aria-label={titles[service]}>
    <NativeDiv className="cs-w-row cs-w-between"><NativeH3>{titles[service]}</NativeH3><NativeButton className="cs-w-button small" type="button" disabled={busy} onClick={onCancel}>Abbrechen</NativeButton></NativeDiv>
    {error && <NativeDiv className="cs-w-notice error" role="alert">{error}</NativeDiv>}
    {service === 'drive' && <NativeLabel className="cs-w-field">Aktion<NativeSelect value={mode} onChange={e => setMode(e.target.value)} disabled={busy}><NativeOption value="upload">Datei hochladen (bis 5 MB)</NativeOption><NativeOption value="folder">Ordner anlegen</NativeOption></NativeSelect></NativeLabel>}
    <NativeDiv className="cs-w-form-grid">
      {service === 'gmail' && <NativeLabel className="cs-w-field full">Empfänger:in<NativeInput required type="email" name="to" value={values.to ?? ''} onChange={e => update('to', e.target.value)} autoComplete="off" maxLength={254}/></NativeLabel>}
      {!['contacts', 'chat'].includes(service) && !(service === 'drive' && mode === 'upload') && <NativeLabel className="cs-w-field full">{service === 'gmail' ? 'Betreff' : 'Titel'}<NativeInput name="title" value={values.title ?? ''} onChange={e => update('title', e.target.value)} required maxLength={250}/></NativeLabel>}
      {service === 'drive' && mode === 'upload' && <NativeLabel className="cs-w-field full">Datei<NativeInput type="file" name="file" onChange={e => setPickedFile(e.target.files?.[0])}/>{pickedFile && <NativeSpan className="cs-w-muted">{pickedFile.name}</NativeSpan>}</NativeLabel>}
      {(service === 'calendar' || service === 'meet') && <><NativeLabel className="cs-w-field">Beginn (Ortszeit)<NativeInput type="datetime-local" required name="start" value={values.start ?? ''} onChange={e => update('start', e.target.value)}/></NativeLabel><NativeLabel className="cs-w-field">Ende (Ortszeit)<NativeInput type="datetime-local" required name="end" value={values.end ?? ''} onChange={e => update('end', e.target.value)}/></NativeLabel><NativeLabel className="cs-w-field full">Teilnehmer:in einladen (optional)<NativeInput type="email" name="attendee" value={values.attendee ?? ''} onChange={e => update('attendee', e.target.value)}/><NativeSpan className="cs-w-muted">Google sendet dieser Adresse eine Einladung.</NativeSpan></NativeLabel>{service === 'calendar' && <NativeLabel className="cs-w-check full"><NativeInput type="checkbox" name="meet" checked={values.meet === 'on'} onChange={e => update('meet', e.target.checked ? 'on' : '')}/>Google-Meet-Link erstellen</NativeLabel>}</>}
      {service === 'tasks' && <NativeLabel className="cs-w-field full">Fällig am (optional)<NativeInput type="date" name="due" value={values.due ?? ''} onChange={e => update('due', e.target.value)}/></NativeLabel>}
      {service === 'contacts' && <><NativeLabel className="cs-w-field">Vorname<NativeInput name="first" value={values.first ?? ''} onChange={e => update('first', e.target.value)} required maxLength={100}/></NativeLabel><NativeLabel className="cs-w-field">Nachname<NativeInput name="last" value={values.last ?? ''} onChange={e => update('last', e.target.value)} maxLength={100}/></NativeLabel><NativeLabel className="cs-w-field">E-Mail<NativeInput type="email" name="email" value={values.email ?? ''} onChange={e => update('email', e.target.value)}/></NativeLabel><NativeLabel className="cs-w-field">Telefon<NativeInput type="tel" name="phone" value={values.phone ?? ''} onChange={e => update('phone', e.target.value)}/></NativeLabel></>}
      {['gmail', 'calendar', 'meet', 'tasks', 'chat'].includes(service) && <NativeLabel className="cs-w-field full">{service === 'gmail' || service === 'chat' ? 'Nachricht' : 'Beschreibung (optional)'}<NativeTextarea name="body" value={values.body ?? ''} onChange={e => update('body', e.target.value)} required={service === 'gmail' || service === 'chat'} maxLength={20000}/></NativeLabel>}
    </NativeDiv>
    <NativeP className="cs-w-muted">{service === 'gmail' || service === 'chat' ? 'Mit „Senden“ wird Ihre Nachricht an den angezeigten Empfänger übermittelt.' : 'Mit „Speichern“ wird der Eintrag im verbundenen Google-Konto angelegt.'}</NativeP>
    <NativeDiv className="cs-w-row"><NativeButton disabled={busy} className="cs-w-button primary" type="submit">{busy ? 'Wird verarbeitet …' : service === 'gmail' || service === 'chat' ? 'Senden' : 'Speichern'}</NativeButton>{service === 'gmail' && <NativeButton type="button" className="cs-w-button" disabled={busy} onClick={() => void submit(true)}>Als Entwurf speichern</NativeButton>}</NativeDiv>
  </NativeForm>;
}
