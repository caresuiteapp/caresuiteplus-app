// Generated native presentation from src/screens/platformConsole/TenantDataTransfers.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window,nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeLabel,NativeTextarea,NativeButton,NativeSmall,NativeP,NativeSection,NativeH3,NativeSpan,NativeUl,NativeLi,NativeStrong} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConsolePanel } from "../../components/platformConsole/ConsoleWorkspaceUi.native.tsx";
import { TransferStyle } from "../../components/dataTransfers/TransferStyle.native.tsx";
import { downloadTransferFile, formatTransferSize, listTransferFiles, listTransfers, transferAction, type DataFile, type DataRequest } from '@/lib/dataTransfers/service';
const stateLabel = { open: 'Upload angefordert', submitted: 'Neue Daten', processed: 'Bearbeitet', cancelled: 'Anfrage beendet' };
const initialMessage = 'Wir unterstützen Sie bei der Übernahme Ihrer Klienten- und Personaldaten. Laden Sie die vereinbarten Unterlagen hier hoch und geben Sie sie anschließend mit „Daten übermitteln“ für CareSuite frei. Eine bestimmte Vorlage ist nicht erforderlich.';
export function TenantDataTransfers({ tenantId }: {
    tenantId: string;
}) {
    const [requests, setRequests] = useState<DataRequest[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [message, setMessage] = useState(initialMessage);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [revision, setRevision] = useState(0);
    const lock = useRef(false);
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const result = await listTransfers(tenantId, offset);
                if (!active)
                    return;
                if (result.items.some(row => row.tenant_id !== tenantId))
                    throw new Error('Die Daten gehören nicht zum geöffneten Unternehmen.');
                setRequests(result.items);
                setTotal(result.total);
                setLoading(false);
            }
            catch (cause) {
                if (active) {
                    setError(cause instanceof Error ? cause.message : 'Daten konnten nicht geladen werden.');
                    setLoading(false);
                }
            }
        };
        setLoading(true);
        void load();
        const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden')
            void load(); }, 15000);
        return () => { active = false; clearInterval(timer); };
    }, [tenantId, offset, revision]);
    async function action(name: string, requestId?: string) {
        if (lock.current)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            await transferAction(name, tenantId, { p_request_id: requestId, p_name: message.trim() });
            if (alive.current) {
                setNotice(name === 'create' ? 'Upload-Anfrage aktiviert. Das Popup erscheint beim Verwaltungskonto des Unternehmens innerhalb von etwa 15 Sekunden oder bei der nächsten Anmeldung.' : 'Der Status wurde gespeichert.');
                setRevision(value => value + 1);
            }
        }
        catch (cause) {
            if (alive.current)
                setError(cause instanceof Error ? cause.message : 'Aktion fehlgeschlagen.');
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    return <NativeDiv className="cs-console"><TransferStyle />
    <ConsolePanel title="Datenübernahme anfordern" description="Aktiviert ein Upload-Popup ausschließlich im ausgewählten Unternehmen.">
      <NativeDiv className="cs-panel-body"><NativeLabel className="cs-field">Nachricht an das Unternehmen<NativeTextarea value={message} maxLength={2000} disabled={busy} onChange={event => setMessage(event.target.value)}/></NativeLabel><NativeDiv className="cs-actions"><NativeButton className="cs-btn primary" disabled={busy || !message.trim()} onClick={() => void action('create')}>{busy ? 'Bitte warten…' : 'Upload-Popup beim Mandanten aktivieren'}</NativeButton><NativeSmall>Eine bereits offene Anfrage wird wiederverwendet. Gültigkeit: 30 Tage.</NativeSmall></NativeDiv></NativeDiv>
    </ConsolePanel>
    {notice && <NativeDiv role="status" className="cs-notice">{notice}</NativeDiv>}
    {error && <NativeDiv role="alert" className="cs-notice error">{error}</NativeDiv>}
    <ConsolePanel title="Neue Daten" description="Vollständig übermittelte Dateien für die Datenübernahme." actions={<NativeButton className="cs-btn" onClick={() => { setError(''); setRevision(value => value + 1); }}>Aktualisieren</NativeButton>}>
      <NativeDiv className="cs-panel-body">{loading ? <NativeP role="status">Anfragen werden geladen…</NativeP> : !requests.length ? <NativeP>Noch keine Upload-Anfragen. Aktivieren Sie das Popup, um Unterlagen anzufordern.</NativeP> : requests.map(request => <NativeSection key={request.id} className="cs-panel"><NativeDiv className="cs-panel-head"><NativeDiv><NativeH3>{stateLabel[request.state]}</NativeH3><NativeDiv className="cs-transfer-meta"><NativeSpan>{new Date(request.created_at).toLocaleString('de-DE')}</NativeSpan><NativeSpan>{request.file_count ?? 0} {request.file_count === 1 ? 'Datei' : 'Dateien'}</NativeSpan>{request.state === 'open' && <NativeSpan>Gültig bis {new Date(request.expires_at).toLocaleDateString('de-DE')}</NativeSpan>}</NativeDiv></NativeDiv><NativeDiv className="cs-actions">{request.state === 'open' && <NativeButton className="cs-btn" disabled={busy} onClick={() => void action('cancel', request.id)}>Anfrage beenden</NativeButton>}{request.state === 'submitted' && <NativeButton className="cs-btn" disabled={busy} onClick={() => void action('process', request.id)}>Als bearbeitet markieren</NativeButton>}</NativeDiv></NativeDiv><NativeDiv className="cs-panel-body">{request.state === 'submitted' || request.state === 'processed' ? <TransferDownloads request={request}/> : <NativeP>{request.state === 'open' ? 'Das Unternehmen hat noch keine Daten zur Übernahme freigegeben.' : 'Für diese Anfrage sind keine Downloads freigegeben.'}</NativeP>}</NativeDiv></NativeSection>)}</NativeDiv>
      {total > 25 && <NativeDiv className="cs-pager"><NativeButton className="cs-btn" disabled={offset === 0 || busy} onClick={() => setOffset(value => Math.max(0, value - 25))}>Zurück</NativeButton><NativeSpan>{offset + 1}–{Math.min(total, offset + 25)} von {total}</NativeSpan><NativeButton className="cs-btn" disabled={offset + 25 >= total || busy} onClick={() => setOffset(value => value + 25)}>Weiter</NativeButton></NativeDiv>}
    </ConsolePanel>
  </NativeDiv>;
}
function TransferDownloads({ request }: {
    request: DataRequest;
}) {
    const [files, setFiles] = useState<DataFile[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true);
        void listTransferFiles(request.tenant_id, request.id, offset).then(result => {
            if (!active)
                return;
            if (result.items.some(file => file.tenant_id !== request.tenant_id || file.request_id !== request.id || file.state !== 'ready'))
                throw new Error('Die Datei-Zuordnung konnte nicht bestätigt werden.');
            setFiles(result.items);
            setTotal(result.total);
            setError('');
        }).catch(cause => { if (active)
            setError(cause instanceof Error ? cause.message : 'Dateien konnten nicht geladen werden.'); }).finally(() => { if (active)
            setLoading(false); });
        return () => { active = false; };
    }, [request.id, request.tenant_id, offset, revision]);
    const download = useCallback(async (file: DataFile) => {
        setBusy(file.id);
        setError('');
        try {
            await downloadTransferFile(file);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Download fehlgeschlagen.');
        }
        finally {
            setBusy('');
        }
    }, []);
    return <>{error && <NativeDiv role="alert" className="cs-notice error">{error}<NativeButton className="cs-link" onClick={() => setRevision(value => value + 1)}>Erneut laden</NativeButton></NativeDiv>}{loading ? <NativeP role="status">Dateien werden geladen…</NativeP> : <NativeUl className="cs-transfer-list">{files.map(file => <NativeLi className="cs-transfer-file" key={file.id}><NativeDiv><NativeStrong>{file.name}</NativeStrong><NativeSmall>{formatTransferSize(Number(file.size))} · Vom Unternehmen übermittelt</NativeSmall></NativeDiv><NativeButton className="cs-btn" disabled={Boolean(busy)} onClick={() => void download(file)}>{busy === file.id ? 'Wird freigegeben…' : 'Herunterladen'}</NativeButton></NativeLi>)}</NativeUl>}{total > 50 && <NativeDiv className="cs-actions"><NativeButton className="cs-btn" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Zurück</NativeButton><NativeSpan>{offset + 1}–{Math.min(total, offset + 50)} von {total}</NativeSpan><NativeButton className="cs-btn" disabled={offset + 50 >= total} onClick={() => setOffset(value => value + 50)}>Weiter</NativeButton></NativeDiv>}<NativeSmall>Download-Links gelten 60 Sekunden. Dateien werden als Anhang heruntergeladen und nicht als Vorschau ausgeführt.</NativeSmall></>;
}
