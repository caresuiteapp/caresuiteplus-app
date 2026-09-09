import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { useVoiceMessage } from '@/hooks/communication/useVoiceMessage';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import { isSpeechDictationSupported, startSpeechDictation } from '@/lib/platform/speechDictation.web';
import type { VoiceRecordingCapture } from '@/lib/platform/voicerecording';
import { uploadEmployeePortalVisitAttachment } from '@/lib/portal/employeePortalVisitAttachmentService';

type Props = { visible: boolean; tenantId: string | null; visitId: string | null; employeeId: string | null;
  onClose: () => void; onAppendText: (text: string) => void; onAudioUploaded?: (storagePath: string) => void };
export function EmployeePortalVisitVoiceNoteModal({ visible, tenantId, visitId, employeeId, onClose, onAppendText, onAudioUploaded }: Props) {
  const voice = useVoiceMessage();
  const [phase, setPhase] = useState<'idle' | 'starting' | 'stopping' | 'uploading' | 'dictating'>('idle');
  const [capture, setCapture] = useState<VoiceRecordingCapture | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const epoch = useRef(0);
  const flight = useRef(false);
  const dictation = useRef<ReturnType<typeof startSpeechDictation> | null>(null);
  const busy = phase === 'starting' || phase === 'stopping' || phase === 'uploading';
  const dirty = Boolean(capture && !savedPath) || Boolean(transcript.trim()) || voice.isRecording || phase === 'dictating';
  const confirmLeave = useUnsavedWebChanges(visible && dirty, visible && busy,
    'Die Aufnahme oder der diktierte Text wurde noch nicht übernommen. Möchten Sie diese Eingaben verwerfen?');
  useEffect(() => {
    epoch.current += 1; flight.current = false;
    setPhase('idle'); setCapture(null); setTranscript(''); setError(null); setSavedPath(null);
    return () => { epoch.current += 1; dictation.current?.cancel(); dictation.current = null; voice.cancel(); };
  }, [visible, tenantId, visitId, employeeId, voice.cancel]);
  useEffect(() => {
    if (!capture) { setAudioUri(null); return; }
    const bytes = new Uint8Array(capture.bytes);
    const uri = URL.createObjectURL(new Blob([bytes.buffer], { type: capture.mimeType }));
    setAudioUri(uri); return () => URL.revokeObjectURL(uri);
  }, [capture]);
  const close = async () => {
    if (busy) return;
    if (await confirmLeave()) { dictation.current?.cancel(); voice.cancel(); onClose(); }
  };
  const dictate = async () => {
    if (flight.current || voice.isRecording || capture || transcript.trim()) return;
    flight.current = true; setPhase('dictating'); setError(null);
    const generation = epoch.current;
    const session = startSpeechDictation(); dictation.current = session;
    try {
      const result = await session.result;
      if (generation !== epoch.current) return;
      if (result.ok) setTranscript(result.transcript); else setError(result.error);
    } catch { if (generation === epoch.current) setError('Diktat konnte nicht übernommen werden. Bitte erneut versuchen.'); }
    finally { if (generation === epoch.current) { dictation.current = null; flight.current = false; setPhase('idle'); } }
  };
  const record = async () => {
    if (flight.current || capture || transcript.trim() || voice.isRecording) return;
    flight.current = true; setPhase('starting'); setError(null);
    const generation = epoch.current;
    try { const result = await voice.start(); if (generation === epoch.current && !result.ok) setError(result.error); }
    finally { if (generation === epoch.current) { flight.current = false; setPhase('idle'); } }
  };
  const stopRecording = async () => {
    if (flight.current || !voice.isRecording) return;
    flight.current = true; setPhase('stopping'); setError(null);
    const generation = epoch.current;
    try {
      const result = await voice.stop();
      if (generation !== epoch.current) return;
      if (result.ok) setCapture(result.data); else setError(result.error);
    } finally { if (generation === epoch.current) { flight.current = false; setPhase('idle'); } }
  };
  const upload = async () => {
    if (flight.current || !capture) return;
    if (!tenantId || !visitId || !employeeId) { setError('Die Aufnahme kann dem Einsatz noch nicht zugeordnet werden. Sie bleibt hier erhalten.'); return; }
    flight.current = true; setPhase('uploading'); setError(null);
    const generation = epoch.current;
    try {
      let path = savedPath;
      if (!path) {
        const result = await uploadEmployeePortalVisitAttachment({ tenantId, visitId, employeeId,
          fileName: capture.fileName, mimeType: capture.mimeType, bytes: capture.bytes });
        if (generation !== epoch.current) return;
        if (!result.ok) { setError(result.error ?? 'Die Aufnahme konnte nicht gespeichert werden. Bitte erneut versuchen.'); return; }
        path = result.data.storagePath; setSavedPath(path);
      }
      onAudioUploaded?.(path);
      // Audio is a separate attachment; do not insert a placeholder into unsaved care documentation.
      onClose();
    } catch { if (generation === epoch.current) setError('Der Upload konnte nicht abgeschlossen werden. Die Aufnahme bleibt in diesem Fenster zum erneuten Senden erhalten.'); }
    finally { if (generation === epoch.current) { flight.current = false; setPhase('idle'); } }
  };
  const adoptText = () => {
    if (flight.current || !transcript.trim()) return;
    try { onAppendText(transcript.trim()); setTranscript(''); onClose(); }
    catch { setError('Der Text konnte nicht in die Dokumentation übernommen werden. Er bleibt hier erhalten.'); }
  };
  return <PlatformModal visible={visible} title="Sprachnotiz" subtitle="Text diktieren oder Audio aufnehmen" onClose={() => void close()}
    dismissOnBackdrop={!busy && !voice.isRecording && phase !== 'dictating'} maxWidth={760} surfaceScope="personal">
    <View style={styles.body}>
      <Text style={styles.text}>Ein Diktat wird als bearbeitbarer Text in Ihre Dokumentation übernommen. Eine Audio-Aufnahme wird als interner Anhang am Einsatz gespeichert.</Text>
      {!capture && !transcript.trim() && phase !== 'dictating' && !voice.isRecording ? <View style={styles.actions}>
        {isSpeechDictationSupported() ? <PremiumButton title="Diktat starten" onPress={() => void dictate()} disabled={busy} /> : <Text style={styles.meta}>Diktat ist in diesem Browser nicht verfügbar.</Text>}
        {voice.isSupported ? <PremiumButton title={phase === 'starting' ? 'Mikrofon wird geöffnet…' : 'Audio aufnehmen'} variant="secondary" onPress={() => void record()} disabled={busy} /> : <Text style={styles.meta}>{voice.unsupportedMessage}</Text>}
      </View> : null}
      {phase === 'dictating' ? <View style={styles.card}>
        <Text accessibilityLiveRegion="polite" style={styles.title}>Diktat läuft…</Text>
        <Text style={styles.text}>Sprechen Sie deutlich. Nach dem Beenden können Sie den erkannten Text bearbeiten.</Text>
        <PremiumButton title="Diktat beenden" onPress={() => dictation.current?.stop()} />
      </View> : null}
      {voice.isRecording ? <View style={styles.card}>
        <Text style={styles.title}>Aufnahme · {voice.durationSeconds} Sek.</Text>
        <View style={styles.actions}><PremiumButton title={phase === 'stopping' ? 'Aufnahme wird verarbeitet…' : 'Aufnahme beenden'} loading={phase === 'stopping'} disabled={busy} onPress={() => void stopRecording()} />
          <PremiumButton title="Aufnahme verwerfen" variant="ghost" disabled={busy} onPress={() => { voice.cancel(); setError(null); }} /></View>
      </View> : null}
      {transcript.length > 0 ? <View style={styles.card}>
        <PremiumInput label="Erkannten Text prüfen und bearbeiten" value={transcript} onChangeText={setTranscript} multiline editable={!busy} />
        <Text style={styles.meta}>Nach dem Übernehmen muss die Dokumentation noch gespeichert werden.</Text>
        <View style={styles.actions}><PremiumButton title="In Dokumentation übernehmen" disabled={busy || !transcript.trim()} onPress={adoptText} />
          <PremiumButton title="Text verwerfen" variant="ghost" disabled={busy} onPress={() => setTranscript('')} /></View>
      </View> : null}
      {capture ? <View style={styles.card}>
        <Text style={styles.title}>{savedPath ? 'Audio gespeichert' : 'Aufnahme bereit · noch nicht gespeichert'}</Text>
        <Text style={styles.meta}>{capture.durationSeconds} Sek. · {(capture.bytes.length / 1024 / 1024).toFixed(1).replace('.', ',')} MB</Text>
        {audioUri ? <audio controls src={audioUri} preload="metadata" aria-label="Sprachnotiz anhören" style={{ width: '100%' }} /> : null}
        <View style={styles.actions}><PremiumButton title={phase === 'uploading' ? 'Audio wird hochgeladen…' : savedPath ? 'Gespeicherten Anhang übernehmen' : 'Audio am Einsatz speichern'} loading={phase === 'uploading'} disabled={busy} onPress={() => void upload()} />
          {!savedPath ? <PremiumButton title="Aufnahme verwerfen" variant="ghost" disabled={busy} onPress={() => { setCapture(null); setError(null); }} /> : null}</View>
        {audioUri && error ? <a href={audioUri} download={capture.fileName} style={{ color: '#0866bd', fontSize: 15 }}>Aufnahme auf diesem Gerät sichern</a> : null}
      </View> : null}
      {error || voice.error ? <Text accessibilityRole="alert" style={styles.error}>{error ?? voice.error}</Text> : null}
      {phase === 'uploading' ? <Text accessibilityLiveRegion="polite" style={styles.meta}>Bitte bis zur Rückmeldung geöffnet lassen. Bei einem Fehler bleibt die Aufnahme für einen weiteren Versuch erhalten.</Text> : null}
    </View>
  </PlatformModal>;
}
const styles = StyleSheet.create({
  body: { gap: 16, minWidth: 0 }, text: { fontSize: font(16), lineHeight: font(24), color: '#345670' }, meta: { fontSize: font(14), lineHeight: font(21), color: '#45627a' },
  title: { fontSize: font(18), lineHeight: font(25), fontWeight: '700', color: '#123353' }, card: { padding: 16, gap: 12, borderWidth: 1, borderColor: '#bad3ec', borderRadius: 16, backgroundColor: '#f4f9ff' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, error: { fontSize: font(15), lineHeight: font(23), color: '#ac2433' },
});
