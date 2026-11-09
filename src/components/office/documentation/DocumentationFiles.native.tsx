// Generated native presentation from src/components/office/documentation/DocumentationFiles.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeDiv,NativeStrong,NativeSpan,NativeLabel,NativeInput,NativeButton,NativeP,NativeUl,NativeLi,NativeSmall,NativeArticle,NativeImg,NativeVideo,NativeAudio,NativeIframe,NativeA,NativeH3} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useRef, useState } from 'react';
import type { DocumentationActor, DocumentationEntry, DocumentationFile, DocumentationUpload } from '@/lib/office/documentation/model';
import { newDocumentationId } from '@/lib/office/documentation/model';
import { DOCUMENTATION_FILE_LIMIT, EMPLOYEE_DOCUMENTATION_FILE_ACCEPT, discardDocumentationFile, documentationFileUrl, employeeDocumentationFileMime, fileKind, fileSize, listDocumentationFiles, uploadDocumentationFile } from '@/lib/office/documentation/attachments';
import { useVoiceMessage } from '@/hooks/office/useDocumentationVoice';
export function DocumentationFilePicker({ files, onChange, disabled = false, mediaOnly = false, onRecording }: {
    files: DocumentationUpload[];
    onChange: (files: DocumentationUpload[]) => void;
    disabled?: boolean;
    mediaOnly?: boolean;
    onRecording?: (active: boolean) => void;
}) {
    const [error, setError] = useState('');
    const voice = useVoiceMessage();
    const [voiceBusy, setVoiceBusy] = useState(false);
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { onRecording?.(voice.isRecording || voiceBusy); return () => onRecording?.(false); }, [voice.isRecording, voiceBusy, onRecording]);
    const add = (incoming: DocumentationUpload['file'][]) => {
        if (disabled)
            return;
        if (files.length + incoming.length > 10) {
            setError('Bis zu zehn Anhänge pro Eintrag.');
            return;
        }
        if (incoming.some(f => f.size < 1 || f.size > DOCUMENTATION_FILE_LIMIT || f.name.length > 240 || /[\x00-\x1f/\\]/.test(f.name))) {
            setError('Bitte gültige, nicht leere Dateien bis jeweils 50 MB auswählen.');
            return;
        }
        if (mediaOnly && incoming.some(file => !employeeDocumentationFileMime(file))) {
            setError('Bitte nur Fotos, Videos oder PDFs auswählen.');
            return;
        }
        setError('');
        onChange([...files, ...incoming.map(file => ({ id: newDocumentationId(), file }))]);
    };
    const recording = async () => {
        if (voiceBusy || disabled)
            return;
        setVoiceBusy(true);
        setError('');
        try {
            if (voice.isRecording) {
                const r = await voice.stop();
                if (!alive.current)
                    return;
                if (r.ok) {
                    const d = r.data;
                    add([{ name: d.fileName, type: d.mimeType, size: d.bytes.byteLength, arrayBuffer: async () => new Uint8Array(d.bytes).buffer }]);
                }
                else
                    setError(r.error);
            }
            else {
                const r = await voice.start();
                if (!r.ok && alive.current)
                    setError(r.error);
            }
        }
        finally {
            if (alive.current)
                setVoiceBusy(false);
        }
    };
    return <NativeSection className="cs-doc-uploads" aria-label="Anhänge hinzufügen"><NativeDiv className="cs-doc-upload-heading"><NativeStrong>{mediaOnly ? 'Anhänge hinzufügen' : 'Dateien & Sprachnotizen'}</NativeStrong><NativeSpan>Bis zu 10 Dateien · je 50 MB</NativeSpan></NativeDiv>
    <NativeLabel className="cs-doc-dropzone">{mediaOnly ? 'Fotos, Videos und PDFs' : 'Fotos, Videos, PDFs oder andere Dateien'}
      <NativeInput type="file" multiple accept={mediaOnly ? EMPLOYEE_DOCUMENTATION_FILE_ACCEPT : undefined} disabled={disabled || voice.isRecording} aria-label="Dateien auswählen" onChange={e => { add(Array.from(e.target.files ?? [])); e.target.value = ''; }}/>
    </NativeLabel>
    {!mediaOnly && <>
      <NativeDiv className="cs-doc-actions"><NativeButton type="button" className={`cs-doc-btn${voice.isRecording ? ' recording' : ''}`} disabled={disabled || voiceBusy || (!voice.isSupported && !voice.isRecording) || files.length >= 10} onClick={() => void recording()}>{voice.isRecording ? `■ Aufnahme beenden · ${voice.durationSeconds} s` : '● Sprachnotiz aufnehmen'}</NativeButton>{voice.isRecording && <NativeButton type="button" className="cs-doc-btn" onClick={() => voice.cancel()}>Aufnahme verwerfen</NativeButton>}</NativeDiv>
      {!voice.isSupported && <NativeP className="cs-doc-hint">{voice.unsupportedMessage} Audiodateien können Sie auch als Datei anhängen.</NativeP>}
    </>}
    {(error || voice.error) && <NativeP role="alert" className="cs-doc-error">{error || voice.error}</NativeP>}
    {files.length > 0 && <NativeUl className="cs-doc-pending">{files.map(f => <NativeLi key={f.id}><NativeSpan className="cs-doc-file-icon">{f.done ? '✓' : fileKind(f.file.type) === 'audio' ? 'AUDIO' : f.file.name.split('.').pop()?.slice(0, 5).toUpperCase() || 'DATEI'}</NativeSpan><NativeSpan><NativeStrong>{f.file.name}</NativeStrong><NativeSmall>{fileSize(f.file.size)}{f.done ? ' · gespeichert' : ''}</NativeSmall></NativeSpan>{!f.done && <NativeButton type="button" className="cs-doc-btn icon" disabled={disabled || voice.isRecording} aria-label={`${f.file.name} entfernen`} onClick={() => onChange(files.filter(x => x.id !== f.id))}>×</NativeButton>}</NativeLi>)}</NativeUl>}
  </NativeSection>;
}
function FilePreview({ actor, file }: {
    actor: DocumentationActor;
    file: DocumentationFile;
}) {
    const [urls, setUrls] = useState<{
        preview: string;
        download: string;
    } | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const open = async () => {
        if (busy)
            return;
        setBusy(true);
        setError('');
        try {
            const [preview, download] = await Promise.all([documentationFileUrl(actor, file), documentationFileUrl(actor, file, true)]);
            if (alive.current)
                setUrls({ preview, download });
        }
        catch {
            if (alive.current)
                setError('Datei konnte nicht geladen werden. Bitte erneut versuchen.');
        }
        finally {
            if (alive.current)
                setBusy(false);
        }
    };
    const kind = fileKind(file.mime_type);
    return <NativeArticle className="cs-doc-file"><NativeDiv className="cs-doc-file-heading"><NativeSpan className="cs-doc-file-icon">{kind === 'audio' ? 'AUDIO' : file.file_name.split('.').pop()?.slice(0, 5).toUpperCase() || 'DATEI'}</NativeSpan><NativeDiv><NativeStrong>{file.file_name}</NativeStrong><NativeSmall>{fileSize(file.size_bytes)}</NativeSmall></NativeDiv><NativeButton type="button" className="cs-doc-btn" disabled={busy} onClick={() => urls ? setUrls(null) : void open()}>{busy ? 'Lädt …' : urls ? 'Schließen' : 'Öffnen'}</NativeButton></NativeDiv>
    {error && <NativeP role="alert" className="cs-doc-error">{error}</NativeP>}
    {urls && <NativeDiv className="cs-doc-file-preview">{kind === 'image' ? <NativeImg src={urls.preview} alt={file.file_name} onError={() => setError('Vorschau nicht verfügbar. Sie können das Original herunterladen.')}/> : kind === 'video' ? <NativeVideo controls playsInline preload="metadata" src={urls.preview} onError={() => setError('Dieses Video lässt sich hier nicht abspielen. Bitte das Original herunterladen.')}/> : kind === 'audio' ? <NativeAudio controls preload="metadata" src={urls.preview} onError={() => setError('Diese Aufnahme lässt sich hier nicht abspielen. Bitte das Original herunterladen.')}/> : kind === 'pdf' ? <NativeIframe title={file.file_name} src={urls.preview} referrerPolicy="no-referrer"/> : <NativeP>Originaldatei zum Herunterladen bereit.</NativeP>}
      <NativeA className="cs-doc-btn" href={urls.download} target="_blank" rel="noreferrer">Original herunterladen ↗</NativeA><NativeButton type="button" className="cs-doc-btn" disabled={busy} onClick={() => void open()}>Datei erneut laden</NativeButton></NativeDiv>}
  </NativeArticle>;
}
export function DocumentationFiles({ actor, entry, onState, onAttachmentTypesLoaded }: {
    actor: DocumentationActor;
    entry: DocumentationEntry;
    onState?: (state: {
        dirty: boolean;
        busy: boolean;
    }) => void;
    onAttachmentTypesLoaded?: (mimeTypes: string[]) => void;
}) {
    const [items, setItems] = useState<DocumentationFile[]>([]), [files, setFiles] = useState<DocumentationUpload[]>([]);
    const [allowed, setAllowed] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [recording, setRecording] = useState(false);
    const alive = useRef(true), locked = useRef(false);
    const pending = useRef(files);
    pending.current = files;
    useEffect(() => { onState?.({ dirty: files.some(f => !f.done), busy: busy || recording }); }, [files, busy, recording, onState]);
    useEffect(() => () => { for (const f of pending.current.filter(f => !f.done))
        void discardDocumentationFile(actor, entry, f).catch(() => { }); }, []);
    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await listDocumentationFiles(actor, entry);
            if (alive.current) {
                setItems(result.items);
                setAllowed(result.canUpload);
                onAttachmentTypesLoaded?.(result.items.map(file => file.mime_type));
            }
        }
        catch {
            if (alive.current)
                setError('Anhänge konnten nicht geladen werden. Bitte erneut versuchen.');
        }
        finally {
            if (alive.current)
                setLoading(false);
        }
    };
    useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [entry.id, entry.source, actor.tenantId, actor.userId]);
    const upload = async () => {
        if (locked.current || recording)
            return;
        locked.current = true;
        setBusy(true);
        setError('');
        let saved = false;
        try {
            for (const file of files.filter(item => !item.done)) {
                await uploadDocumentationFile(actor, entry, file);
                if (!alive.current)
                    return;
                saved = true;
                setFiles(current => current.map(item => item.id === file.id ? { ...item, done: true } : item));
            }
            setFiles([]);
            await load();
        }
        catch {
            if (saved && alive.current)
                await load();
            if (alive.current)
                setError('Ein Anhang wurde noch nicht gespeichert. Bereits bestätigte Dateien bleiben erhalten. Bitte erneut versuchen.');
        }
        finally {
            locked.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    return <NativeSection className="cs-doc-files" aria-label="Dateianhänge"><NativeH3>Anhänge <NativeSpan>{items.length}</NativeSpan></NativeH3>{loading && <NativeP role="status">Anhänge werden geladen …</NativeP>}{error && <NativeP role="alert" className="cs-doc-error">{error} <NativeButton type="button" className="cs-doc-btn" onClick={() => void load()}>Erneut laden</NativeButton></NativeP>}
    {items.map(file => <FilePreview key={file.id} actor={actor} file={file}/>)}
    {allowed && items.filter(f => f.storage_bucket !== 'office-documents').length < 10 && <><DocumentationFilePicker files={files} disabled={busy} mediaOnly={actor.mediaOnly} onChange={next => { for (const f of files.filter(f => !f.done && !next.some(n => n.id === f.id)))
        void discardDocumentationFile(actor, entry, f).catch(() => { }); setFiles(next); }} onRecording={setRecording}/>{files.length > 0 && <NativeButton type="button" className="cs-doc-btn primary" disabled={busy || recording} onClick={() => void upload()}>{busy ? 'Anhänge werden gespeichert …' : 'Anhänge speichern'}</NativeButton>}</>}
    {!loading && !error && !items.length && !allowed && <NativeP className="cs-doc-hint">Zu diesem Eintrag sind keine Anhänge hinterlegt.</NativeP>}
  </NativeSection>;
}
