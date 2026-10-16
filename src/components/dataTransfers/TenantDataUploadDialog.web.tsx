import { useEffect, useRef, useState } from 'react';
import { discardTransferFile, formatTransferSize, listTransferFiles, transferAction, type DataFile, type DataRequest } from '@/lib/dataTransfers/service';
import { uploadTransferFile } from '@/lib/dataTransfers/upload.web';
import { MAX_TRANSFER_FILE_SIZE, TRANSFER_SIZE_ERROR } from '@/lib/dataTransfers/limits';
import { TransferStyle } from './TransferStyle.web';

type LocalFile = { id: string; file: File; record?: DataFile; progress: number; error?: string };
export function TenantDataUploadDialog({ request, userId, onClose, onSubmitted }: { request: DataRequest; userId: string; onClose: () => void; onSubmitted: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [files, setFiles] = useState<DataFile[]>([]);
  const [local, setLocal] = useState<LocalFile[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [consent, setConsent] = useState(false);
  const [revision, setRevision] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true; const element = dialog.current; element?.showModal();
    return () => { mounted.current = false; controller.current?.abort(); element?.close(); };
  }, []);
  useEffect(() => {
    let active = true; setLoading(true);
    void listTransferFiles(request.tenant_id, request.id, offset).then(result => {
      if (!active) return;
      if (result.items.some(file => file.tenant_id !== request.tenant_id || file.request_id !== request.id)) throw new Error('Die Zuordnung der Dateien ist ungültig.');
      setFiles(result.items); setTotal(result.total);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Dateien konnten nicht geladen werden.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request.id, request.tenant_id, offset, revision]);
  useEffect(() => {
    if (!busy && !local.length) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [busy, local.length]);
  function select(selected: File[]) {
    if (lock.current) return;
    setError('');
    if (selected.some(file => file.size > MAX_TRANSFER_FILE_SIZE)) {
      setError(TRANSFER_SIZE_ERROR); return;
    }
    if (selected.some(file => !Number.isSafeInteger(file.size) || file.name.length > 255 || /[\x00-\x1f\x7f]/.test(file.name))) {
      setError('Bitte Dateinamen ohne Steuerzeichen und mit höchstens 255 Zeichen verwenden.'); return;
    }
    setLocal(current => [...current, ...selected.filter(file => !current.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)).map(file => {
      const pending = files.find(item => item.state === 'pending' && item.created_by === userId && item.name === file.name && Number(item.size) === file.size);
      return { id: pending?.id ?? crypto.randomUUID(), file, record: pending, progress: 0 };
    })]);
  }
  const update = (id: string, patch: Partial<LocalFile>) => { if (mounted.current) setLocal(current => current.map(item => item.id === id ? { ...item, ...patch } : item)); };
  async function upload() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    const abort = new AbortController(); controller.current = abort;
    try {
      for (const item of local) {
        if (abort.signal.aborted) break;
        try {
          update(item.id, { error: undefined });
          const record = item.record ?? await transferAction<DataFile>('begin', request.tenant_id, { p_request_id: request.id, p_file_id: item.id, p_name: item.file.name, p_size: item.file.size });
          update(item.id, { record });
          await uploadTransferFile(item.file, record, abort.signal, progress => update(item.id, { progress }));
          if (mounted.current) setLocal(current => current.filter(entry => entry.id !== item.id));
        } catch (cause) {
          update(item.id, { error: cause instanceof Error && cause.name === 'AbortError' ? 'Pausiert. Sie können den Upload fortsetzen.' : cause instanceof Error ? cause.message : 'Upload fehlgeschlagen.' });
          break;
        }
      }
    } finally {
      lock.current = false; controller.current = null;
      if (mounted.current) { setBusy(false); setRevision(value => value + 1); }
    }
  }
  async function remove(record: DataFile) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await discardTransferFile(record); setLocal(current => current.filter(item => item.id !== record.id)); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Datei konnte nicht entfernt werden.'); }
    finally { lock.current = false; if (mounted.current) { setBusy(false); setRevision(value => value + 1); } }
  }
  async function submit() {
    if (lock.current || !consent || local.length) return; lock.current = true; setBusy(true); setError('');
    try { await transferAction('submit', request.tenant_id, { p_request_id: request.id }); if (mounted.current) setSuccess(true); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Die Übermittlung konnte nicht bestätigt werden. Bitte erneut versuchen.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const close = () => { if (!busy) { if (success) onSubmitted(); else onClose(); } };
  return <dialog ref={dialog} className="cs-dialog" aria-label="Daten sicher übermitteln" onCancel={event => { event.preventDefault(); close(); }}>
    <div className="cs-console"><TransferStyle />
      <div className="cs-dialog-head"><div><div className="cs-eyebrow">CareSuite · Datenübernahme</div><h2>Daten sicher übermitteln</h2><p>Ihre Unterlagen bleiben Ihrem Unternehmen zugeordnet.</p></div><button className="cs-btn" aria-label="Dialog schließen" disabled={busy} onClick={close}>✕</button></div>
      <div className="cs-dialog-body">
        {success ? <div className="cs-notice" role="status"><h3>Daten erfolgreich übermittelt</h3><p>CareSuite kann Ihre Dateien jetzt für die vereinbarte Datenübernahme herunterladen.</p></div> : <>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{request.message}</p>
          <div className="cs-transfer-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); select(Array.from(event.dataTransfer.files)); }}>
            <label htmlFor="cs-transfer-files">Dateien auswählen oder hier ablegen</label>
            <input id="cs-transfer-files" type="file" multiple disabled={busy} onChange={event => { select(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
            <small>Alle Dateiformate, auch ZIP-Archive, Bilder und Datenexporte. Maximal 2 GB pro Datei; mehrere Dateien sind möglich. Große Dateien werden in Abschnitten übertragen. Bitte dieses Fenster bis zum Abschluss geöffnet lassen.</small>
          </div>
          {local.length > 0 && <><ul className="cs-transfer-list">{local.map(item => <li className="cs-transfer-file" key={item.id}><div><strong>{item.file.name}</strong><small>{formatTransferSize(item.file.size)} · {item.progress}%</small><progress max={100} value={item.progress} aria-label={`Upload ${item.file.name}`} />{item.error && <p role="alert">{item.error}</p>}</div><button className="cs-btn" disabled={busy} onClick={() => item.record ? void remove(item.record) : setLocal(current => current.filter(entry => entry.id !== item.id))}>Entfernen</button></li>)}</ul><div className="cs-actions"><button className="cs-btn primary" disabled={busy} onClick={() => void upload()}>Dateien hochladen / fortsetzen</button>{busy && controller.current && <button className="cs-btn" onClick={() => controller.current?.abort()}>Upload pausieren</button>}</div></>}
          <section aria-label="Hochgeladene Dateien"><h3>Ihre Dateien ({total})</h3>
            {loading ? <p role="status">Dateien werden geladen…</p> : <ul className="cs-transfer-list">{files.filter(file => !local.some(item => item.id === file.id)).map(file => <li className="cs-transfer-file" key={file.id}><div><strong>{file.name}</strong><small>{formatTransferSize(Number(file.size))} · {file.state === 'ready' ? 'Hochgeladen · noch nicht übermittelt' : 'Unvollständig · Originaldatei erneut auswählen oder entfernen'}</small></div>{file.created_by === userId && <button className="cs-btn" disabled={busy} onClick={() => void remove(file)}>Entfernen</button>}</li>)}</ul>}
            {!loading && !total && <p>Noch keine Dateien hochgeladen.</p>}
            {total > 50 && <div className="cs-actions"><button className="cs-btn" disabled={busy || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Zurück</button><span>{offset + 1}–{Math.min(offset + 50, total)} von {total}</span><button className="cs-btn" disabled={busy || offset + 50 >= total} onClick={() => setOffset(value => value + 50)}>Weiter</button></div>}
          </section>
          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><input type="checkbox" checked={consent} disabled={busy} style={{ width: 20, flexShrink: 0 }} onChange={event => setConsent(event.target.checked)} /><span>Ich bin zur Übermittlung berechtigt und beauftrage CareSuite, diese Dateien für die vereinbarte Datenübernahme zu verwenden.</span></label>
          <small>Erst „Daten übermitteln“ gibt die vollständig hochgeladenen Dateien für CareSuite frei. Die Anfrage ist bis {new Date(request.expires_at).toLocaleDateString('de-DE')} gültig.</small>
        </>}
        {error && <div className="cs-notice error" role="alert">{error}<button className="cs-link" onClick={() => setRevision(value => value + 1)}>Dateiliste erneut laden</button></div>}
      </div>
      <div className="cs-dialog-footer">{success ? <button className="cs-btn primary" onClick={onSubmitted}>Fertig</button> : <><button className="cs-btn" disabled={busy} onClick={onClose}>Später fortfahren</button><button className="cs-btn primary" disabled={busy || loading || !consent || !total || local.length > 0 || files.some(file => file.state === 'pending')} onClick={() => void submit()}>{busy ? 'Bitte warten…' : 'Daten übermitteln'}</button></>}</div>
    </div>
  </dialog>;
}
