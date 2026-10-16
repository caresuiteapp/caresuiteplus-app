import { useCallback, useEffect, useRef, useState } from 'react';
import { ConsolePanel } from '@/components/platformConsole/ConsoleWorkspaceUi.web';
import { TransferStyle } from '@/components/dataTransfers/TransferStyle.web';
import { downloadTransferFile, formatTransferSize, listTransferFiles, listTransfers, transferAction, type DataFile, type DataRequest } from '@/lib/dataTransfers/service';

const stateLabel = { open: 'Upload angefordert', submitted: 'Neue Daten', processed: 'Bearbeitet', cancelled: 'Anfrage beendet' };
const initialMessage = 'Wir unterstützen Sie bei der Übernahme Ihrer Klienten- und Personaldaten. Laden Sie die vereinbarten Unterlagen hier hoch und geben Sie sie anschließend mit „Daten übermitteln“ für CareSuite frei. Eine bestimmte Vorlage ist nicht erforderlich.';

export function TenantDataTransfers({ tenantId }: { tenantId: string }) {
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
        if (!active) return;
        if (result.items.some(row => row.tenant_id !== tenantId)) throw new Error('Die Daten gehören nicht zum geöffneten Unternehmen.');
        setRequests(result.items); setTotal(result.total); setLoading(false);
      } catch (cause) { if (active) { setError(cause instanceof Error ? cause.message : 'Daten konnten nicht geladen werden.'); setLoading(false); } }
    };
    setLoading(true); void load();
    const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden') void load(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [tenantId, offset, revision]);
  async function action(name: string, requestId?: string) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await transferAction(name, tenantId, { p_request_id: requestId, p_name: message.trim() });
      if (alive.current) { setNotice(name === 'create' ? 'Upload-Anfrage aktiviert. Das Popup erscheint beim Verwaltungskonto des Unternehmens innerhalb von etwa 15 Sekunden oder bei der nächsten Anmeldung.' : 'Der Status wurde gespeichert.'); setRevision(value => value + 1); }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Aktion fehlgeschlagen.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <div className="cs-console"><TransferStyle />
    <ConsolePanel title="Datenübernahme anfordern" description="Aktiviert ein Upload-Popup ausschließlich im ausgewählten Unternehmen.">
      <div className="cs-panel-body"><label className="cs-field">Nachricht an das Unternehmen<textarea value={message} maxLength={2000} disabled={busy} onChange={event => setMessage(event.target.value)} /></label><div className="cs-actions"><button className="cs-btn primary" disabled={busy || !message.trim()} onClick={() => void action('create')}>{busy ? 'Bitte warten…' : 'Upload-Popup beim Mandanten aktivieren'}</button><small>Eine bereits offene Anfrage wird wiederverwendet. Gültigkeit: 30 Tage.</small></div></div>
    </ConsolePanel>
    {notice && <div role="status" className="cs-notice">{notice}</div>}
    {error && <div role="alert" className="cs-notice error">{error}</div>}
    <ConsolePanel title="Neue Daten" description="Vollständig übermittelte Dateien für die Datenübernahme." actions={<button className="cs-btn" onClick={() => { setError(''); setRevision(value => value + 1); }}>Aktualisieren</button>}>
      <div className="cs-panel-body">{loading ? <p role="status">Anfragen werden geladen…</p> : !requests.length ? <p>Noch keine Upload-Anfragen. Aktivieren Sie das Popup, um Unterlagen anzufordern.</p> : requests.map(request => <section key={request.id} className="cs-panel"><div className="cs-panel-head"><div><h3>{stateLabel[request.state]}</h3><div className="cs-transfer-meta"><span>{new Date(request.created_at).toLocaleString('de-DE')}</span><span>{request.file_count ?? 0} {request.file_count === 1 ? 'Datei' : 'Dateien'}</span>{request.state === 'open' && <span>Gültig bis {new Date(request.expires_at).toLocaleDateString('de-DE')}</span>}</div></div><div className="cs-actions">{request.state === 'open' && <button className="cs-btn" disabled={busy} onClick={() => void action('cancel', request.id)}>Anfrage beenden</button>}{request.state === 'submitted' && <button className="cs-btn" disabled={busy} onClick={() => void action('process', request.id)}>Als bearbeitet markieren</button>}</div></div><div className="cs-panel-body">{request.state === 'submitted' || request.state === 'processed' ? <TransferDownloads request={request} /> : <p>{request.state === 'open' ? 'Das Unternehmen hat noch keine Daten zur Übernahme freigegeben.' : 'Für diese Anfrage sind keine Downloads freigegeben.'}</p>}</div></section>)}</div>
      {total > 25 && <div className="cs-pager"><button className="cs-btn" disabled={offset === 0 || busy} onClick={() => setOffset(value => Math.max(0, value - 25))}>Zurück</button><span>{offset + 1}–{Math.min(total, offset + 25)} von {total}</span><button className="cs-btn" disabled={offset + 25 >= total || busy} onClick={() => setOffset(value => value + 25)}>Weiter</button></div>}
    </ConsolePanel>
  </div>;
}
function TransferDownloads({ request }: { request: DataRequest }) {
  const [files, setFiles] = useState<DataFile[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true);
    void listTransferFiles(request.tenant_id, request.id, offset).then(result => {
      if (!active) return;
      if (result.items.some(file => file.tenant_id !== request.tenant_id || file.request_id !== request.id || file.state !== 'ready')) throw new Error('Die Datei-Zuordnung konnte nicht bestätigt werden.');
      setFiles(result.items); setTotal(result.total); setError('');
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Dateien konnten nicht geladen werden.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request.id, request.tenant_id, offset, revision]);
  const download = useCallback(async (file: DataFile) => {
    setBusy(file.id); setError('');
    try { await downloadTransferFile(file); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Download fehlgeschlagen.'); }
    finally { setBusy(''); }
  }, []);
  return <>{error && <div role="alert" className="cs-notice error">{error}<button className="cs-link" onClick={() => setRevision(value => value + 1)}>Erneut laden</button></div>}{loading ? <p role="status">Dateien werden geladen…</p> : <ul className="cs-transfer-list">{files.map(file => <li className="cs-transfer-file" key={file.id}><div><strong>{file.name}</strong><small>{formatTransferSize(Number(file.size))} · Vom Unternehmen übermittelt</small></div><button className="cs-btn" disabled={Boolean(busy)} onClick={() => void download(file)}>{busy === file.id ? 'Wird freigegeben…' : 'Herunterladen'}</button></li>)}</ul>}{total > 50 && <div className="cs-actions"><button className="cs-btn" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Zurück</button><span>{offset + 1}–{Math.min(total, offset + 50)} von {total}</span><button className="cs-btn" disabled={offset + 50 >= total} onClick={() => setOffset(value => value + 50)}>Weiter</button></div>}<small>Download-Links gelten 60 Sekunden. Dateien werden als Anhang heruntergeladen und nicht als Vorschau ausgeführt.</small></>;
}
