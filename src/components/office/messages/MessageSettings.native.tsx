// Generated native presentation from src/components/office/messages/MessageSettings.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeForm,NativeDiv,NativeP,NativeLabel,NativeSpan,NativeStrong,NativeInput,NativeSmall,NativeFooter} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useRef, useState } from 'react';
import type { MessagingActor } from "../../../lib/office/messageWorkspaceService.native.ts";
import { saveMessagePreferences, type MessagePreferences } from "../../../lib/office/messageWorkspaceSettings.native.ts";
import { MessageButton, MessageDialog, MessageNotice } from "./MessagePrimitives.native.tsx";
const options: {
    key: keyof MessagePreferences;
    label: string;
    description: string;
}[] = [
    { key: 'attachmentsEnabled', label: 'Dateien anhängen', description: 'Dokumente, Fotos und Videos im Schreibbereich hinzufügen.' },
    { key: 'voiceMessagesEnabled', label: 'Sprachnachrichten aufnehmen', description: 'Mikrofonaufnahmen im Browser ermöglichen.' },
    { key: 'internalNotesEnabled', label: 'Interne Notizen verwenden', description: 'Zusätzliche Notizen für berechtigte Personen in der Verwaltung.' },
    { key: 'emojisEnabled', label: 'Emoji-Auswahl anzeigen', description: 'Eine kompakte Auswahl im Schreibbereich anbieten.' },
    { key: 'showReadReceipts', label: 'Gelesen-Status anzeigen', description: 'Vorhandene Lesebestätigungen neben gesendeten Nachrichten anzeigen.' },
];
export function MessageSettings({ actor, initial, onClose, onSaved, onDirtyChange, onBusyChange }: {
    actor: MessagingActor;
    initial: MessagePreferences;
    onClose: () => void;
    onSaved: () => void;
    onDirtyChange: (value: boolean) => void;
    onBusyChange: (value: boolean) => void;
}) {
    const [value, setValue] = useState(initial);
    const [baseline, setBaseline] = useState(JSON.stringify(initial));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const alive = useRef(true);
    const flight = useRef(false);
    const dirty = JSON.stringify(value) !== baseline;
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
    useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
    const close = async () => { if (!busy && (!dirty || await confirmNativeWorkspaceAction('Änderungen an den Nachrichteneinstellungen verwerfen?')))
        onClose(); };
    async function save(event: React.FormEvent) {
        event.preventDefault();
        if (flight.current)
            return;
        flight.current = true;
        setBusy(true);
        setError('');
        try {
            const result = await saveMessagePreferences(actor, value);
            if (!alive.current)
                return;
            if (!result.ok)
                setError(result.error);
            else {
                setBaseline(JSON.stringify(value));
                setNotice('Einstellungen gespeichert.');
                onSaved();
            }
        }
        catch {
            if (alive.current)
                setError('Speicherung nicht bestätigt. Bitte erneut versuchen.');
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    return <MessageDialog title="Nachrichteneinstellungen" busy={busy} onClose={close}><NativeForm onSubmit={event => void save(event)}><NativeDiv className="mw-dialog-scroll"><NativeP>Funktionen des Nachrichtenbereichs für Ihre Organisation festlegen. Vorhandene Inhalte bleiben lesbar.</NativeP>{error && <MessageNotice error>{error}</MessageNotice>}{notice && <MessageNotice>{notice}</MessageNotice>}<NativeDiv>{options.map(option => <NativeLabel className="mw-setting" key={option.key}><NativeSpan><NativeStrong>{option.label}</NativeStrong><NativeP>{option.description}</NativeP></NativeSpan><NativeInput type="checkbox" disabled={busy} checked={value[option.key]} onChange={event => setValue(current => ({ ...current, [option.key]: event.target.checked }))}/></NativeLabel>)}</NativeDiv><NativeSmall>Empfänger sehen Nachrichten in CareSuite. E-Mail und SMS sind keine Versandwege dieses Schreibbereichs.</NativeSmall></NativeDiv><NativeFooter className="mw-dialog-footer"><NativeP>{dirty ? 'Noch nicht gespeicherte Änderungen' : 'Ihre Rollen- und Zugriffsrechte bleiben maßgeblich.'}</NativeP><NativeDiv className="mw-actions"><MessageButton disabled={busy} onClick={close}>Schließen</MessageButton><MessageButton type="submit" tone="primary" icon="check" disabled={busy || !dirty}>{busy ? 'Wird gespeichert …' : 'Einstellungen speichern'}</MessageButton></NativeDiv></NativeFooter></NativeForm></MessageDialog>;
}
