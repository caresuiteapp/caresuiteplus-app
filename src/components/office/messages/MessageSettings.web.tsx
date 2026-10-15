import { useEffect, useRef, useState } from 'react';
import type { MessagingActor } from '@/lib/office/messageWorkspaceService.web';
import { saveMessagePreferences, type MessagePreferences } from '@/lib/office/messageWorkspaceSettings.web';
import { MessageButton, MessageDialog, MessageNotice } from './MessagePrimitives.web';

const options: { key: keyof MessagePreferences; label: string; description: string }[] = [
  { key: 'attachmentsEnabled', label: 'Dateien anhängen', description: 'Dokumente, Fotos und Videos im Schreibbereich hinzufügen.' },
  { key: 'voiceMessagesEnabled', label: 'Sprachnachrichten aufnehmen', description: 'Mikrofonaufnahmen im Browser ermöglichen.' },
  { key: 'internalNotesEnabled', label: 'Interne Notizen verwenden', description: 'Zusätzliche Notizen für berechtigte Personen in der Verwaltung.' },
  { key: 'emojisEnabled', label: 'Emoji-Auswahl anzeigen', description: 'Eine kompakte Auswahl im Schreibbereich anbieten.' },
  { key: 'showReadReceipts', label: 'Gelesen-Status anzeigen', description: 'Vorhandene Lesebestätigungen neben gesendeten Nachrichten anzeigen.' },
];
export function MessageSettings({ actor, initial, onClose, onSaved, onDirtyChange, onBusyChange }: { actor: MessagingActor; initial: MessagePreferences; onClose: () => void; onSaved: () => void; onDirtyChange: (value: boolean) => void; onBusyChange: (value: boolean) => void }) {
  const [value, setValue] = useState(initial); const [baseline, setBaseline] = useState(JSON.stringify(initial)); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const alive = useRef(true); const flight = useRef(false);
  const dirty = JSON.stringify(value) !== baseline;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const close = () => { if (!busy && (!dirty || window.confirm('Änderungen an den Nachrichteneinstellungen verwerfen?'))) onClose(); };
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (flight.current) return; flight.current = true; setBusy(true); setError('');
    try { const result = await saveMessagePreferences(actor, value); if (!alive.current) return; if (!result.ok) setError(result.error); else { setBaseline(JSON.stringify(value)); setNotice('Einstellungen gespeichert.'); onSaved(); } } catch { if (alive.current) setError('Speicherung nicht bestätigt. Bitte erneut versuchen.'); } finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  return <MessageDialog title="Nachrichteneinstellungen" busy={busy} onClose={close}><form onSubmit={event => void save(event)}><div className="mw-dialog-scroll"><p>Funktionen des Nachrichtenbereichs für Ihre Organisation festlegen. Vorhandene Inhalte bleiben lesbar.</p>{error && <MessageNotice error>{error}</MessageNotice>}{notice && <MessageNotice>{notice}</MessageNotice>}<div>{options.map(option => <label className="mw-setting" key={option.key}><span><strong>{option.label}</strong><p>{option.description}</p></span><input type="checkbox" disabled={busy} checked={value[option.key]} onChange={event => setValue(current => ({ ...current, [option.key]: event.target.checked }))} /></label>)}</div><small>Empfänger sehen Nachrichten in CareSuite. E-Mail und SMS sind keine Versandwege dieses Schreibbereichs.</small></div><footer className="mw-dialog-footer"><p>{dirty ? 'Noch nicht gespeicherte Änderungen' : 'Ihre Rollen- und Zugriffsrechte bleiben maßgeblich.'}</p><div className="mw-actions"><MessageButton disabled={busy} onClick={close}>Schließen</MessageButton><MessageButton type="submit" tone="primary" icon="check" disabled={busy || !dirty}>{busy ? 'Wird gespeichert …' : 'Einstellungen speichern'}</MessageButton></div></footer></form></MessageDialog>;
}
