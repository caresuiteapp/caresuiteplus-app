import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton } from '@/components/ui';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import { uploadEmployeePortalVisitAttachment } from '@/lib/portal/employeePortalVisitAttachmentService';
import { openEmployeePortalCamera, openEmployeePortalDocumentPicker, openEmployeePortalMediaLibrary,
  readEmployeePortalMediaBytes, releaseEmployeePortalMediaUri } from '@/lib/portal/employeePortalMediaPicker';
import { formatEmployeePortalMediaSize, validateEmployeePortalPickedMedia, type EmployeePortalPickedMedia } from '@/lib/portal/employeePortalMediaValidation';

type Props = {
  visible: boolean; tenantId: string | null; visitId: string | null; employeeId: string | null;
  existingReferences: string[]; onClose: () => void; onUploaded: (storagePaths: string[]) => void;
};
export function EmployeePortalVisitPhotoModal({ visible, tenantId, visitId, employeeId, existingReferences, onClose, onUploaded }: Props) {
  const [picked, setPicked] = useState<EmployeePortalPickedMedia | null>(null);
  const [phase, setPhase] = useState<'idle' | 'picking' | 'uploading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const selected = useRef<EmployeePortalPickedMedia | null>(null);
  const flight = useRef(false);
  const epoch = useRef(0);
  const refs = useRef(existingReferences); refs.current = existingReferences;
  const confirmLeave = useUnsavedWebChanges(visible && Boolean(picked && !savedPath), visible && phase === 'uploading');
  useEffect(() => {
    epoch.current += 1; flight.current = false;
    setPicked(null); setSavedPath(null); setError(null); setHelp(null); setPhase('idle');
    return () => { epoch.current += 1; releaseEmployeePortalMediaUri(selected.current?.uri); selected.current = null; };
  }, [visible, tenantId, visitId, employeeId]);
  const close = async () => {
    if (flight.current) return;
    if (await confirmLeave()) onClose();
  };
  const pick = async (source: 'camera' | 'library' | 'document') => {
    if (flight.current || savedPath) return;
    flight.current = true; setPhase('picking'); setError(null); setHelp(null);
    const generation = epoch.current;
    try {
      const result = source === 'camera' ? await openEmployeePortalCamera() : source === 'library'
        ? await openEmployeePortalMediaLibrary() : await openEmployeePortalDocumentPicker({ includeMediaFallback: true });
      if (epoch.current !== generation) { if (result.ok) releaseEmployeePortalMediaUri(result.media?.uri); return; }
      if (!result.ok) { setError(result.error); setHelp(result.permissionHelp ?? null); return; }
      if (!result.media) return;
      const valid = validateEmployeePortalPickedMedia(result.media, 'visit');
      if (!valid.ok) { releaseEmployeePortalMediaUri(result.media.uri); setError(valid.error); return; }
      releaseEmployeePortalMediaUri(selected.current?.uri);
      selected.current = result.media; setPicked(result.media);
    } catch { if (epoch.current === generation) setError('Die Auswahl konnte nicht geöffnet werden. Eine bereits ausgewählte Datei bleibt erhalten.'); }
    finally { if (epoch.current === generation) { flight.current = false; setPhase('idle'); } }
  };
  const upload = async () => {
    if (flight.current || !picked) return;
    if (!tenantId || !visitId || !employeeId) { setError('Die Datei kann diesem Einsatz noch nicht zugeordnet werden. Bitte die Einsatzdaten erneut laden.'); return; }
    flight.current = true; setPhase('uploading'); setError(null);
    const generation = epoch.current;
    try {
      let path = savedPath;
      if (!path) {
        const bytes = await readEmployeePortalMediaBytes(picked.uri);
        if (generation !== epoch.current) return;
        const valid = validateEmployeePortalPickedMedia({ ...picked, sizeBytes: bytes.length }, 'visit');
        if (!valid.ok) { setError(valid.error); return; }
        const result = await uploadEmployeePortalVisitAttachment({ tenantId, visitId, employeeId,
          fileName: picked.fileName, mimeType: picked.mimeType, bytes });
        if (generation !== epoch.current) return;
        if (!result.ok) { setError(result.error ?? 'Die Datei konnte nicht gespeichert werden. Bitte erneut versuchen.'); return; }
        path = result.data.storagePath; setSavedPath(path);
      }
      onUploaded([...new Set([...refs.current, path])]);
      onClose();
    } catch { if (generation === epoch.current) setError('Die Übernahme konnte nicht abgeschlossen werden. Die Auswahl bleibt für einen weiteren Versuch erhalten.'); }
    finally { if (generation === epoch.current) { flight.current = false; setPhase('idle'); } }
  };
  const busy = phase !== 'idle';
  return <PlatformModal visible={visible} title="Foto, Video oder PDF" subtitle="Medien zu diesem Einsatz"
    onClose={() => void close()} dismissOnBackdrop={!busy} maxWidth={760} surfaceScope="personal">
    <View style={styles.body}>
      <View style={styles.info}><Text style={styles.title}>Auswählen, ansehen und hochladen</Text>
        <Text style={styles.text}>Diese Dateien bleiben intern am Einsatz. Sie erscheinen nicht automatisch im Leistungsnachweis oder Klient:innenportal.</Text>
        <Text style={styles.meta}>Fotos und PDF bis 15 MB · Videos bis 50 MB</Text></View>
      <View style={styles.actions}>
        <PremiumButton title="Kamera" variant="secondary" onPress={() => void pick('camera')} disabled={busy || Boolean(savedPath)} />
        <PremiumButton title="Fotos & Videos" variant="secondary" onPress={() => void pick('library')} disabled={busy || Boolean(savedPath)} />
        <PremiumButton title="Datei auswählen" variant="secondary" onPress={() => void pick('document')} disabled={busy || Boolean(savedPath)} />
      </View>
      {picked ? <View style={styles.selection}>
        <Text style={styles.title}>{picked.fileName}</Text>
        <Text style={styles.meta}>{formatEmployeePortalMediaSize(picked.sizeBytes)} · {savedPath ? 'Datei gespeichert' : 'Ausgewählt, noch nicht hochgeladen'}</Text>
        {picked.kind === 'image' ? <Image source={{ uri: picked.uri }} resizeMode="contain" style={styles.preview} /> : null}
        {picked.kind === 'video' ? <video src={picked.uri} controls playsInline preload="metadata" aria-label="Vorschau der ausgewählten Aufnahme" style={{ width: '100%', maxHeight: 280, borderRadius: 12 }} /> : null}
        <View style={styles.actions}>
          <PremiumButton title={phase === 'uploading' ? 'Wird hochgeladen…' : savedPath ? 'Gespeicherte Datei übernehmen' : 'Datei hochladen'} loading={phase === 'uploading'} disabled={busy} onPress={() => void upload()} />
          {!savedPath ? <PremiumButton title="Auswahl entfernen" variant="ghost" disabled={busy} onPress={() => { releaseEmployeePortalMediaUri(selected.current?.uri); selected.current = null; setPicked(null); setError(null); }} /> : null}
        </View>
      </View> : <Text style={styles.text}>{phase === 'picking' ? 'Dateiauswahl geöffnet…' : 'Wählen Sie zuerst eine Datei aus. Danach können Sie die Auswahl ansehen und hochladen.'}</Text>}
      {help ? <Text style={styles.text}>{help}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {phase === 'uploading' ? <Text accessibilityLiveRegion="polite" style={styles.meta}>Bitte dieses Fenster bis zur Rückmeldung geöffnet lassen.</Text> : null}
    </View>
  </PlatformModal>;
}
const styles = StyleSheet.create({
  body: { gap: 16, minWidth: 0 }, info: { padding: 16, gap: 8, borderRadius: 16, backgroundColor: '#e8f3ff', borderWidth: 1, borderColor: '#bed9f4' },
  title: { fontSize: font(18), lineHeight: font(25), fontWeight: '700', color: '#123353' }, text: { fontSize: font(16), lineHeight: font(24), color: '#345670' },
  meta: { fontSize: font(14), lineHeight: font(21), color: '#45627a' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  selection: { gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#bad3ec', backgroundColor: '#fff' },
  preview: { width: '100%', height: 240, borderRadius: 12, backgroundColor: '#f1f6fc' }, error: { fontSize: font(15), lineHeight: font(23), color: '#ac2433' },
});
