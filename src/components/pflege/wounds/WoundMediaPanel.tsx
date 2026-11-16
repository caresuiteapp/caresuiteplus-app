import { WoundSection } from './WoundWorkspaceLayout';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { ErrorState, FilterChipGroup, InfoBanner, PremiumButton } from '@/components/ui';
import { CareSuiteImage } from '@/components/images/CareSuiteImage';
import { WoundMeasurementFrame } from '@/components/clinicalMedia/WoundMeasurementFrame';
import { currentMedicationEventTime, MedicationEventTimeInput, medicationEventInstant } from '@/components/pflege/MedicationEventTimeInput';
import { useVoiceMessage } from '@/hooks/office/useDocumentationVoice';
import { formatWoundDate, formatWoundNumber, validateWoundMeasurement, type WoundMedia, type WoundMediaKind } from '@/lib/pflege/woundRecordDomain';
import { chooseWoundFiles, prepareWoundFile, takeWoundPhoto, uploadWoundMedia, woundImageDataUrl, woundMediaUrl,
  type WoundFile, type WoundRecordData, type WoundRecordScope, type WoundRecordWrite } from '@/lib/pflege/woundRecordService';
import { woundMeasurementEditor } from '@/lib/pflege/woundMeasurementEditor';
import { TISSUE_LABELS, type WoundMeasurement } from '@/lib/pflege/woundPlanimetry';
import { useWoundRecordStyles } from './woundRecordStyles';

type AssessmentOption = { key: string; label: string };
type Props = {
  scope: WoundRecordScope; data: WoundRecordData; kind: WoundMediaKind; assessments: AssessmentOption[];
  canWrite: boolean; locked: boolean; refresh: () => Promise<boolean>;
  onAssessment?: () => void;
  onSave: (entry: WoundRecordWrite) => Promise<void>;
};

function AudioComment({ uri }: { uri: string }) {
  const styles = useWoundRecordStyles();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  return <View style={styles.row}>
    <PremiumButton title={status.playing ? 'Pause' : 'Abspielen'} size="sm" variant="secondary"
      onPress={() => { if (status.playing) player.pause(); else { if (status.didJustFinish) void player.seekTo(0); player.play(); } }} />
    <Text style={styles.muted}>{Math.floor(status.currentTime)} / {Math.floor(status.duration)} s</Text>
  </View>;
}

function WoundPhotoThumbnail({ scope, file, onOpen, disabled }: {
  scope: WoundRecordScope; file: WoundMedia; onOpen: () => void; disabled: boolean;
}) {
  const styles = useWoundRecordStyles();
  const { tenantId, actorId, role, clientId, woundId } = scope;
  const [uri, setUri] = useState('');
  const [failed, setFailed] = useState(false);
  const canPreview = file.size_bytes <= 4 * 1024 * 1024;
  useEffect(() => {
    if (!canPreview) return;
    let active = true;
    void woundMediaUrl({ tenantId, actorId, role, clientId, woundId }, file)
      .then(url => { if (active) setUri(url); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [tenantId, actorId, role, clientId, woundId, file, canPreview]);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Wundfoto ${file.file_name} öffnen`}
    disabled={disabled} onPress={onOpen} style={[styles.thumbnail, !uri && styles.thumbnailState]}>
    {uri ? <CareSuiteImage source={{ uri }} style={styles.thumbnail} resizeMode="contain" onError={() => {
      setUri(''); setFailed(true);
    }} /> : <Text style={styles.muted}>{failed || !canPreview ? 'Original öffnen' : 'Vorschau wird geladen …'}</Text>}
  </Pressable>;
}

export function WoundMediaPanel({ scope, data, kind, assessments, canWrite, locked, refresh, onAssessment, onSave }: Props) {
  const styles = useWoundRecordStyles();
  const photo = kind !== 'voice', wound = kind === 'wound_photo';
  const title = kind === 'voice' ? 'Gesprochene Kommentare' : wound ? 'Wundfotos' : 'Bilder zur Pflegeanamnese';
  const [files, setFiles] = useState<WoundFile[]>([]);
  const [time, setTime] = useState(currentMedicationEventTime);
  const [assessment, setAssessment] = useState(''), [consent, setConsent] = useState('');
  const [upload, setUpload] = useState(false), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [count, setCount] = useState(6);
  const [selected, setSelected] = useState<{ file: WoundMedia; uri: string; editor: boolean } | null>(null);
  const [measurement, setMeasurement] = useState<WoundMeasurement | null>(null);
  const flight = useRef(false), alive = useRef(true);
  const voice = useVoiceMessage();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const observed = medicationEventInstant(time);
  const availableConsents = photo ? data.consents.filter(item => Date.parse(item.granted_at) <= Date.parse(observed)
    && (!item.expires_at || Date.parse(item.expires_at) > Date.now())) : [];
  const consentId = availableConsents.find(item => item.id === consent)?.id ?? (availableConsents.length === 1 ? availableConsents[0].id : null);
  const assessmentId = assessments.find(item => item.key === assessment)?.key ?? (assessments.length === 1 ? assessments[0].key : null);
  const items = data.media.filter(item => item.kind === kind);
  const shown = selected && items.some(item => item.id === selected.file.id) ? selected : null;
  const canUpload = canWrite && !locked && !!observed && (!wound || !!assessmentId) && (!photo || !!consentId);

  async function run(action: () => Promise<void>) {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Das Medium konnte nicht verarbeitet werden.');
    } finally { flight.current = false; if (alive.current) setBusy(false); }
  }

  async function chooseFiles() {
    const next = await chooseWoundFiles(kind);
    if (alive.current) setFiles(prev => [...prev, ...next]);
  }

  async function capturePhoto() {
    const next = await takeWoundPhoto();
    if (next && alive.current) setFiles(previous => [...previous, next]);
  }

  async function saveFiles() {
    if (!files.length || !canUpload || !observed) return;
    for (const file of files) {
      await uploadWoundMedia(scope, { file, kind, observedAt: observed, assessmentId: wound ? assessmentId : null, consentId: photo ? consentId : null });
      if (!alive.current) return;
      setFiles(current => current.filter(item => item.id !== file.id));
    }
    setNotice('Dateien der Akte zugeordnet.');
    setUpload(false);
    if (!await refresh()) setNotice('Dateien gespeichert. Lade die Akte erneut, um sie anzuzeigen.');
  }

  async function open(file: WoundMedia, editor: boolean) {
    const uri = editor ? woundMeasurementEditor(await woundImageDataUrl(scope, file)) : await woundMediaUrl(scope, file);
    if (alive.current) { setMeasurement(null); setSelected({ file, uri, editor }); }
  }

  async function finishVoice() {
    const result = await voice.stop();
    if (!result.ok) { setError(result.error); return; }
    const { fileName, bytes, mimeType } = result.data;
    const file = await prepareWoundFile(fileName, mimeType, new Uint8Array(bytes).buffer);
    if (alive.current) setFiles(previous => [...previous, file]);
  }

  return <WoundSection title={title} subtitle={wound ? 'Fotos der Wunde, Bildvorschau und digitale Vermessung' : undefined}
    actions={canWrite ? <PremiumButton
    title={upload ? 'Hinzufügen schließen' : photo ? 'Bilder hinzufügen' : 'Kommentar hinzufügen'}
    disabled={busy || locked || voice.isRecording || files.length > 0} size="sm" variant="secondary"
    onPress={() => {
      if (!upload) setTime(currentMedicationEventTime());
      setUpload(value => !value);
    }} /> : undefined}>
    <View style={styles.stack}>
      {wound && !assessments.length && <View style={styles.panel}>
        <Text style={styles.text}>Für die Zuordnung neuer Wundfotos wird zuerst ein Wundbefund benötigt.</Text>
        {onAssessment && <PremiumButton title="Wundbefund erfassen" size="sm" onPress={onAssessment} disabled={busy || locked} />}
      </View>}
      {upload && <View style={styles.panel}>
        <MedicationEventTimeInput label={photo ? 'Aufnahmezeitpunkt der ausgewählten Bilder' : 'Zeitpunkt des Kommentars'}
          value={time} onChange={setTime} disabled={busy || locked || files.length > 0} />
        {wound && !!assessments.length && <FilterChipGroup wrap options={assessments} value={assessmentId ?? ''}
          onChange={busy || files.length ? undefined : setAssessment} />}
        {photo && (!availableConsents.length ? <InfoBanner variant="warning" message="Für den Aufnahmezeitpunkt fehlt eine aktuell gültige Fotoeinwilligung in der Klientenakte." /> :
          <FilterChipGroup wrap value={consentId ?? ''} options={availableConsents.map(item => ({
            key: item.id, label: 'Fotoeinwilligung vom ' + formatWoundDate(item.granted_at),
          }))} onChange={busy || files.length ? undefined : setConsent} />)}
        <View style={styles.row}>
          {photo && <PremiumButton title="Foto aufnehmen" size="sm" onPress={() => run(capturePhoto)}
            disabled={busy || !canUpload} />}
          <PremiumButton title={photo ? 'Bilddateien auswählen' : 'Audiodateien auswählen'} size="sm" variant="secondary"
            onPress={() => run(chooseFiles)} disabled={busy || !canUpload || voice.isRecording} />
          {!photo && voice.isSupported && <PremiumButton title={voice.isRecording ? 'Aufnahme beenden' : 'Mikrofon starten'}
            size="sm" variant="secondary" disabled={busy || !canUpload}
            onPress={() => run(voice.isRecording ? finishVoice : async () => { await voice.start(); })} />}
        </View>
        {!photo && !!voice.error && <ErrorState message={voice.error} />}
        {voice.isRecording && <Text style={styles.text}>Aufnahme läuft · {voice.durationSeconds} s</Text>}
        {files.length > 0 && <>
          {files.map(file => <View key={file.id} style={styles.row}>
            <Text style={styles.text}>{file.name}</Text>
            <PremiumButton title="Aus Auswahl entfernen" size="sm" variant="secondary" disabled={busy}
              onPress={() => setFiles(current => current.filter(item => item.id !== file.id))} />
          </View>)}
          <PremiumButton title={busy ? 'Dateien werden gespeichert …' : 'Dateien zuordnen'} disabled={busy || !canUpload || voice.isRecording}
            onPress={() => run(saveFiles)} />
        </>}
      </View>}
      {!!error && <ErrorState message={error} />}
      {!!notice && <InfoBanner variant="success" message={notice} />}
      {!items.length && <Text style={styles.muted}>{photo ? 'Keine freigegebenen Bilder zugeordnet.' : 'Noch keine gesprochenen Kommentare.'}</Text>}
      {!!items.length && <View style={styles.row}>{items.slice(0, count).map(file => <View key={file.id} style={[styles.panel, styles.galleryCard]}>
        {photo && <WoundPhotoThumbnail scope={scope} file={file} disabled={busy || locked} onOpen={() => run(() => open(file, false))} />}
        <Text style={styles.title}>{file.file_name}</Text>
        <Text style={styles.muted}>{formatWoundDate(file.observed_at)} · {formatWoundNumber(file.size_bytes / 1024, 0)} KB</Text>
        <View style={styles.row}>
          <PremiumButton size="sm" title={photo ? 'Bild öffnen' : 'Kommentar öffnen'} variant="secondary" disabled={busy || locked} onPress={() => run(() => open(file, false))} />
          {wound && canWrite && <PremiumButton size="sm" title="Auf diesem Foto vermessen" variant="secondary" disabled={busy || locked}
            onPress={() => run(() => open(file, true))} />}
        </View>
      </View>)}</View>}
      {items.length > count && <View style={styles.row}><PremiumButton title="Weitere Dateien anzeigen" size="sm"
        variant="secondary" onPress={() => setCount(n => n + 15)} /></View>}
      {shown && <View style={styles.panel}>
        <View style={styles.toolbar}><Text style={styles.title}>{shown.file.file_name}</Text>
          <PremiumButton title="Datei schließen" size="sm" variant="secondary" disabled={locked}
            onPress={() => { setSelected(null); setMeasurement(null); }} />
        </View>
        {shown.editor ? <>
          <InfoBanner variant="info" message="Für eine Schätzung in cm einen Maßstab aus derselben Ebene wie der Wundrand verwenden. Länge ist die größte Ausdehnung zwischen zwei Randpunkten. Die Breite wird rechtwinklig dazu gemessen." />
          <WoundMeasurementFrame key={shown.file.id} html={shown.uri}
            onMeasurement={value => { if (!locked) setMeasurement(validateWoundMeasurement(value)); }} />
          {measurement && <View style={styles.panel}>
            <Text style={styles.title}>Messung zur Freigabe</Text>
            <Text style={styles.text}>{formatWoundNumber(measurement.areaCm2)} cm² · {formatWoundNumber(measurement.lengthCm)} × {formatWoundNumber(measurement.widthCm)} cm</Text>
            <Text style={styles.muted}>{Object.entries(measurement.shares).map(([k, v]) => TISSUE_LABELS[k as keyof typeof TISSUE_LABELS] + ' ' + formatWoundNumber(v) + ' %').join(' · ')}</Text>
            <PremiumButton title="Messung in Wundakte speichern" disabled={!canWrite || locked || busy}
              onPress={() => onSave({ kind: 'measurement', observedAt: shown.file.observed_at, payload: {
                photoId: shown.file.id, assessmentId: shown.file.assessment_id, trace: measurement, methodVersion: 1,
              } })} />
          </View>}
        </> : photo ? <CareSuiteImage source={{ uri: shown.uri }} style={styles.image} resizeMode="contain" /> :
          <AudioComment key={shown.uri} uri={shown.uri} />}
      </View>}
    </View>
  </WoundSection>;
}
