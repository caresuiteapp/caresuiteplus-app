import { useEffect, useRef, useState } from 'react';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import type { VoiceMessageStopResult } from '@/hooks/communication/useVoiceMessage.web';

/** Native microphone capture; the presentation and upload contract remain shared. */
export function useVoiceMessage() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 300);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true), flight = useRef(false), cancelled = useRef(false), owns = useRef(false);
  const release = async () => { if (owns.current) { owns.current = false; await setAudioModeAsync({ allowsRecording: false }).catch(() => {}); } };
  useEffect(() => { alive.current = true; return () => { alive.current = false; cancelled.current = true; void release(); }; }, []);
  const cancel = () => { cancelled.current = true; if (recorder.isRecording) void recorder.stop().then(release).catch(release); setError(null); };
  const start = async () => {
    if (flight.current || recorder.isRecording) return { ok: false as const, error: 'Aufnahme wird bereits vorbereitet.' };
    flight.current = true; cancelled.current = false; setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Bitte den Mikrofonzugriff in den App-Einstellungen erlauben.');
      if (!alive.current || cancelled.current) throw new Error('Aufnahme abgebrochen.');
      owns.current = true; await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!alive.current || cancelled.current) throw new Error('Aufnahme abgebrochen.');
      recorder.record(); return { ok: true as const, data: { started: true } };
    } catch (e) { const message = e instanceof Error ? e.message : 'Aufnahme konnte nicht gestartet werden.'; if (alive.current) setError(message); await release(); return { ok: false as const, error: message }; }
    finally { flight.current = false; }
  };
  const stop = async (): Promise<VoiceMessageStopResult> => {
    if (flight.current || !recorder.isRecording) return { ok: false, error: 'Keine eigene Aufnahme verfügbar.' };
    flight.current = true;
    try {
      const durationSeconds = Math.max(1, Math.round(state.durationMillis / 1000));
      await recorder.stop();
      if (!recorder.uri || cancelled.current || !alive.current) throw new Error('Aufnahme abgebrochen.');
      const file = new File(recorder.uri), bytes = new Uint8Array(await file.arrayBuffer());
      try { file.delete(); } catch { /* Expo also manages the recording cache. */ }
      if (!bytes.length) throw new Error('Die Aufnahme ist leer. Bitte erneut aufnehmen.');
      return { ok: true, data: { bytes, fileName: `sprachnotiz-${Date.now()}.m4a`, mimeType: 'audio/mp4', durationSeconds } };
    } catch (e) { const message = e instanceof Error ? e.message : 'Aufnahme konnte nicht gelesen werden.'; if (alive.current) setError(message); return { ok: false, error: message }; }
    finally { flight.current = false; await release(); }
  };
  return { start, stop, cancel, error, isRecording: state.isRecording, durationSeconds: Math.floor(state.durationMillis / 1000), isSupported: true, unsupportedMessage: '', isPreparedOnly: false };
}
