import { useEffect, useRef, useState } from 'react';
import type { DocumentationActor, DocumentationEntry, DocumentationFile, DocumentationUpload } from '@/lib/office/documentation/model';
import { newDocumentationId } from '@/lib/office/documentation/model';
import { DOCUMENTATION_FILE_LIMIT, discardDocumentationFile, documentationFileUrl, fileKind, fileSize, listDocumentationFiles, uploadDocumentationFile } from '@/lib/office/documentation/attachments';
import { useVoiceMessage } from '@/hooks/office/useDocumentationVoice';

export function DocumentationFilePicker({ files, onChange, disabled = false, onRecording }: { files: DocumentationUpload[]; onChange: (files: DocumentationUpload[]) => void; disabled?: boolean; onRecording?: (active: boolean) => void }) {
  const [error, setError] = useState('');
  const voice = useVoiceMessage();
  const [voiceBusy, setVoiceBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onRecording?.(voice.isRecording || voiceBusy); return () => onRecording?.(false); }, [voice.isRecording, voiceBusy, onRecording]);
  const add = (incoming: DocumentationUpload['file'][]) => {
    if (disabled) return;
    if (files.length + incoming.length > 10) { setError('Bis zu zehn Anhänge pro Eintrag.'); return; }
    if (incoming.some(f => f.size < 1 || f.size > DOCUMENTATION_FILE_LIMIT || f.name.length > 240 || /[\x00-\x1f/\\]/.test(f.name))) { setError('Bitte gültige, nicht leere Dateien bis jeweils 50 MB auswählen.'); return; }
    setError(''); onChange([...files, ...incoming.map(file => ({ id: newDocumentationId(), file }))]);
  };
  const recording = async () => {
    if (voiceBusy || disabled) return;
    setVoiceBusy(true); setError('');
    try {
      if (voice.isRecording) {
        const r = await voice.stop();
        if (!alive.current) return;
        if (r.ok) { const d = r.data; add([{ name: d.fileName, type: d.mimeType, size: d.bytes.byteLength, arrayBuffer: async () => new Uint8Array(d.bytes).buffer }]); }
        else setError(r.error);
      } else { const r = await voice.start(); if (!r.ok && alive.current) setError(r.error); }
    } finally { if (alive.current) setVoiceBusy(false); }
  };
  return <section className="cs-doc-uploads" aria-label="Anhänge hinzufügen"><div className="cs-doc-upload-heading"><strong>Dateien & Sprachnotizen</strong><span>Bis zu 10 Dateien · je 50 MB</span></div>
    <label className="cs-doc-dropzone">Fotos, Videos, PDFs oder andere Dateien<input type="file" multiple disabled={disabled || voice.isRecording} aria-label="Dateien auswählen" onChange={e => { add(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label>
    <div className="cs-doc-actions"><button type="button" className={`cs-doc-btn${voice.isRecording ? ' recording' : ''}`} disabled={disabled || voiceBusy || (!voice.isSupported && !voice.isRecording) || files.length >= 10} onClick={() => void recording()}>{voice.isRecording ? `■ Aufnahme beenden · ${voice.durationSeconds} s` : '● Sprachnotiz aufnehmen'}</button>{voice.isRecording && <button type="button" className="cs-doc-btn" onClick={() => voice.cancel()}>Aufnahme verwerfen</button>}</div>
    {!voice.isSupported && <p className="cs-doc-hint">{voice.unsupportedMessage} Audiodateien können Sie auch als Datei anhängen.</p>}
    {(error || voice.error) && <p role="alert" className="cs-doc-error">{error || voice.error}</p>}
    {files.length > 0 && <ul className="cs-doc-pending">{files.map(f => <li key={f.id}><span className="cs-doc-file-icon">{f.done ? '✓' : fileKind(f.file.type) === 'audio' ? 'AUDIO' : f.file.name.split('.').pop()?.slice(0, 5).toUpperCase() || 'DATEI'}</span><span><strong>{f.file.name}</strong><small>{fileSize(f.file.size)}{f.done ? ' · gespeichert' : ''}</small></span>{!f.done && <button type="button" className="cs-doc-btn icon" disabled={disabled || voice.isRecording} aria-label={`${f.file.name} entfernen`} onClick={() => onChange(files.filter(x => x.id !== f.id))}>×</button>}</li>)}</ul>}
  </section>;
}
function FilePreview({ actor, file }: { actor: DocumentationActor; file: DocumentationFile }) {
  const [urls, setUrls] = useState<{ preview: string; download: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const open = async () => {
    if (busy) return; setBusy(true); setError('');
    try { const [preview, download] = await Promise.all([documentationFileUrl(actor, file), documentationFileUrl(actor, file, true)]); if (alive.current) setUrls({ preview, download }); }
    catch { if (alive.current) setError('Datei konnte nicht geladen werden. Bitte erneut versuchen.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const kind = fileKind(file.mime_type);
  return <article className="cs-doc-file"><div className="cs-doc-file-heading"><span className="cs-doc-file-icon">{kind === 'audio' ? 'AUDIO' : file.file_name.split('.').pop()?.slice(0, 5).toUpperCase() || 'DATEI'}</span><div><strong>{file.file_name}</strong><small>{fileSize(file.size_bytes)}</small></div><button type="button" className="cs-doc-btn" disabled={busy} onClick={() => urls ? setUrls(null) : void open()}>{busy ? 'Lädt …' : urls ? 'Schließen' : 'Öffnen'}</button></div>
    {error && <p role="alert" className="cs-doc-error">{error}</p>}
    {urls && <div className="cs-doc-file-preview">{kind === 'image' ? <img src={urls.preview} alt={file.file_name} onError={() => setError('Vorschau nicht verfügbar. Sie können das Original herunterladen.')} /> : kind === 'video' ? <video controls playsInline preload="metadata" src={urls.preview} onError={() => setError('Dieses Video lässt sich hier nicht abspielen. Bitte das Original herunterladen.')} /> : kind === 'audio' ? <audio controls preload="metadata" src={urls.preview} onError={() => setError('Diese Aufnahme lässt sich hier nicht abspielen. Bitte das Original herunterladen.')} /> : kind === 'pdf' ? <iframe title={file.file_name} src={urls.preview} referrerPolicy="no-referrer" /> : <p>Originaldatei zum Herunterladen bereit.</p>}
      <a className="cs-doc-btn" href={urls.download} target="_blank" rel="noreferrer">Original herunterladen ↗</a><button type="button" className="cs-doc-btn" disabled={busy} onClick={() => void open()}>Datei erneut laden</button></div>}
  </article>;
}
export function DocumentationFiles({ actor, entry, onState }: { actor: DocumentationActor; entry: DocumentationEntry; onState?: (state: { dirty: boolean; busy: boolean }) => void }) {
  const [items, setItems] = useState<DocumentationFile[]>([]), [files, setFiles] = useState<DocumentationUpload[]>([]);
  const [allowed, setAllowed] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [recording, setRecording] = useState(false);
  const alive = useRef(true), locked = useRef(false);
  const pending = useRef(files); pending.current = files;
  useEffect(() => { onState?.({ dirty: files.some(f => !f.done), busy: busy || recording }); }, [files, busy, recording, onState]);
  useEffect(() => () => { for (const f of pending.current.filter(f => !f.done)) void discardDocumentationFile(actor, entry, f).catch(() => {}); }, []);
  const load = async () => { setLoading(true); setError(''); try { const r = await listDocumentationFiles(actor, entry); if (alive.current) { setItems(r.items); setAllowed(r.canUpload); } } catch { if (alive.current) setError('Anhänge konnten nicht geladen werden. Bitte erneut versuchen.'); } finally { if (alive.current) setLoading(false); } };
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [entry.id, entry.source, actor.tenantId, actor.userId]);
  const upload = async () => {
    if (locked.current || recording) return; locked.current = true; setBusy(true); setError('');
    try { for (const f of files.filter(f => !f.done)) { await uploadDocumentationFile(actor, entry, f); if (!alive.current) return; setFiles(current => current.map(item => item.id === f.id ? { ...item, done: true } : item)); } setFiles([]); await load(); }
    catch { if (alive.current) setError('Ein Anhang wurde noch nicht gespeichert. Bereits bestätigte Dateien bleiben erhalten. Bitte erneut versuchen.'); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  return <section className="cs-doc-files" aria-label="Dateianhänge"><h3>Anhänge <span>{items.length}</span></h3>{loading && <p role="status">Anhänge werden geladen …</p>}{error && <p role="alert" className="cs-doc-error">{error} <button type="button" className="cs-doc-btn" onClick={() => void load()}>Erneut laden</button></p>}
    {items.map(file => <FilePreview key={file.id} actor={actor} file={file} />)}
    {allowed && items.filter(f => f.storage_bucket !== 'office-documents').length < 10 && <><DocumentationFilePicker files={files} disabled={busy} onChange={next => { for (const f of files.filter(f => !f.done && !next.some(n => n.id === f.id))) void discardDocumentationFile(actor, entry, f).catch(() => {}); setFiles(next); }} onRecording={setRecording} />{files.length > 0 && <button type="button" className="cs-doc-btn primary" disabled={busy || recording} onClick={() => void upload()}>{busy ? 'Anhänge werden gespeichert …' : 'Anhänge speichern'}</button>}</>}
    {!loading && !error && !items.length && !allowed && <p className="cs-doc-hint">Zu diesem Eintrag sind keine Anhänge hinterlegt.</p>}
  </section>;
}
