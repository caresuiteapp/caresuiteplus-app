import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Text, View } from 'react-native';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { discardTransferFile, formatTransferSize, listTransferFiles, transferAction, type DataFile, type DataRequest } from '@/lib/dataTransfers/service';
import { uploadTransferFile, type NativeTransferFile } from '@/lib/dataTransfers/upload.native';
import { MAX_TRANSFER_FILE_SIZE, TRANSFER_SIZE_ERROR } from '@/lib/dataTransfers/limits';
import { MobileButton, MobileCard, MobileSheet, MobileState, m } from '@/components/mobile/MobileWorkspace';
type LocalFile = { id: string; file: NativeTransferFile; record?: DataFile; progress: number; error?: string };
export function TenantDataUploadDialog({ request, userId, onClose, onSubmitted }: { request: DataRequest; userId: string; onClose: () => void; onSubmitted: () => void }) {
  const [files, setFiles] = useState<DataFile[]>([]); const [local, setLocal] = useState<LocalFile[]>([]); const [total, setTotal] = useState(0); const [offset, setOffset] = useState(0); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [success, setSuccess] = useState(false); const [consent, setConsent] = useState(false); const [revision, setRevision] = useState(0);
  const controller = useRef<AbortController | null>(null); const lock = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; const listener = AppState.addEventListener('change', value => { if (value !== 'active') controller.current?.abort(); }); return () => { mounted.current = false; controller.current?.abort(); listener.remove(); }; }, []);
  useEffect(() => { let active = true; setLoading(true); void listTransferFiles(request.tenant_id, request.id, offset).then(result => { if (!active) return; if (result.items.some(file => file.tenant_id !== request.tenant_id || file.request_id !== request.id)) throw new Error('Die Zuordnung der Dateien ist ungültig.'); setFiles(result.items); setTotal(result.total); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Die Dateiliste konnte nicht geladen werden.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [request.id, request.tenant_id, offset, revision]);
  const pick = async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true }); if (result.canceled || !mounted.current) return; const selected = result.assets.map(asset => ({ uri: asset.uri, name: asset.name, size: new File(asset.uri).size })); if (selected.some(file => file.size > MAX_TRANSFER_FILE_SIZE)) throw new Error(TRANSFER_SIZE_ERROR); if (selected.some(file => !Number.isSafeInteger(file.size) || file.name.length > 255 || /[\x00-\x1f\x7f]/.test(file.name))) throw new Error('Bitte gültige Dateien mit Namen bis 255 Zeichen wählen.'); setLocal(current => [...current, ...selected.filter(file => !current.some(item => item.file.name === file.name && item.file.size === file.size)).map(file => { const pending = files.find(item => item.state === 'pending' && item.created_by === userId && item.name === file.name && Number(item.size) === file.size); return { id: pending?.id ?? randomUUID(), file, record: pending, progress: 0 }; })]); } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Die Dateien konnten nicht ausgewählt werden.'); } finally { lock.current = false; if (mounted.current) setBusy(false); } };
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
  const close = () => { if (busy) return; if (success) { onSubmitted(); return; } if (!local.length) { onClose(); return; } Alert.alert('Später fortfahren?', 'Unvollständige Dateien bleiben in der Anfrage. Beim erneuten Öffnen müssen Sie die Originaldateien wieder auswählen.', [{ text: 'Hier bleiben', style: 'cancel' }, { text: 'Später fortfahren', onPress: onClose }]); };
  return <MobileSheet visible title="Daten sicher übermitteln" onClose={close} footer={success ? <MobileButton primary label="Fertig" onPress={onSubmitted} /> : <MobileButton primary label="Daten übermitteln" icon="send" busy={busy} disabled={loading || !consent || !total || local.length > 0 || files.some(file => file.state === 'pending')} onPress={() => void submit()} />}>
    {success ? <MobileState title="Daten erfolgreich übermittelt" message="CareSuite kann Ihre Dateien jetzt für die vereinbarte Datenübernahme herunterladen." /> : <><Text style={m.body}>{request.message}</Text><MobileButton label="Dateien auswählen" icon="paperclip" disabled={busy} onPress={() => void pick()} /><Text style={m.muted}>Alle Dateiformate · maximal 2 GB pro Datei. Große Dateien werden in Abschnitten übertragen. Lassen Sie die App geöffnet; beim Wechsel in den Hintergrund wird der Upload pausiert.</Text>
      {local.map(item => <MobileCard key={item.id}><Text style={m.section}>{item.file.name}</Text><Text style={m.body}>{formatTransferSize(item.file.size)} · {item.progress}%</Text>{item.error ? <Text style={m.error}>{item.error}</Text> : null}<MobileButton label="Entfernen" disabled={busy} onPress={() => item.record ? void remove(item.record) : setLocal(old => old.filter(row => row.id !== item.id))} /></MobileCard>)}{local.length ? <MobileButton label="Hochladen / fortsetzen" icon="upload" busy={busy} onPress={() => void upload()} /> : null}{busy && controller.current ? <MobileButton label="Upload pausieren" onPress={() => controller.current?.abort()} /> : null}
      <Text style={m.section}>Ihre Dateien ({total})</Text>{loading ? <MobileState loading title="Dateiliste wird geladen" /> : files.filter(file => !local.some(item => item.id === file.id)).map(file => <MobileCard key={file.id}><Text style={m.section}>{file.name}</Text><Text style={m.muted}>{formatTransferSize(Number(file.size))} · {file.state === 'ready' ? 'Hochgeladen · noch nicht übermittelt' : 'Unvollständig · Originaldatei erneut auswählen oder entfernen'}</Text>{file.created_by === userId ? <MobileButton label="Entfernen" disabled={busy} onPress={() => void remove(file)} /> : null}</MobileCard>)}{total > 50 ? <View style={m.wrap}><MobileButton label="Zurück" disabled={busy || offset === 0} onPress={() => setOffset(n => Math.max(0, n - 50))} /><Text style={m.muted}>{offset + 1}–{Math.min(total, offset + 50)} von {total}</Text><MobileButton label="Weiter" disabled={busy || offset + 50 >= total} onPress={() => setOffset(n => n + 50)} /></View> : null}
      <MobileButton label="Ich bin zur Übermittlung berechtigt und beauftrage CareSuite mit der vereinbarten Datenübernahme." selected={consent} disabled={busy} icon={consent ? 'check-square' : 'square'} onPress={() => setConsent(!consent)} /><Text style={m.muted}>Erst „Daten übermitteln“ gibt die vollständig hochgeladenen Dateien für CareSuite frei. Gültig bis {new Date(request.expires_at).toLocaleDateString('de-DE')}.</Text></>}{error ? <MobileState title="Übermittlung prüfen" message={error} onRetry={() => setRevision(n => n + 1)} /> : null}
  </MobileSheet>;
}
