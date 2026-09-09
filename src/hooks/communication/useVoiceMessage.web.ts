import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelVoiceRecording, getVoiceRecordingUnsupportedMessage, isVoiceRecordingSupported,
  startVoiceRecording, stopVoiceRecording, type VoiceRecordingCapture } from '@/lib/platform/voicerecording';
export type VoiceMessageStopResult = { ok: true; data: VoiceRecordingCapture } | { ok: false; error: string };
// The platform recorder is shared. An idle component must not cancel another component's recording.
let recorderOwner: symbol | null = null;
export function useVoiceMessage() {
  const owner = useRef(Symbol('voice-recording'));
  const alive = useRef(true);
  const flight = useRef(false);
  const cancelled = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const supported = isVoiceRecordingSupported();
  const unsupportedMessage = getVoiceRecordingUnsupportedMessage();
  const cancel = useCallback(() => {
    cancelled.current = true;
    if (recorderOwner === owner.current) { cancelVoiceRecording(); if (!flight.current) recorderOwner = null; }
    if (alive.current) { setIsRecording(false); setDurationSeconds(0); setError(null); }
  }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; cancel(); }; }, [cancel]);
  const start = useCallback(async () => {
    if (flight.current || recorderOwner !== null) return { ok: false as const, error: 'Es läuft bereits eine Sprachaufnahme. Bitte diese zuerst beenden.' };
    if (!supported) { setError(unsupportedMessage); return { ok: false as const, error: unsupportedMessage }; }
    flight.current = true; cancelled.current = false; recorderOwner = owner.current; setError(null);
    try {
      const result = await startVoiceRecording((seconds) => { if (alive.current && recorderOwner === owner.current) setDurationSeconds(seconds); });
      if (!alive.current || cancelled.current || recorderOwner !== owner.current) { if (recorderOwner === owner.current) { cancelVoiceRecording(); recorderOwner = null; } return { ok: false as const, error: 'Aufnahme abgebrochen.' }; }
      if (result.ok) { setIsRecording(true); setDurationSeconds(0); }
      else { recorderOwner = null; setError(result.error); }
      return result;
    } catch { if (recorderOwner === owner.current) { cancelVoiceRecording(); recorderOwner = null; } const message = 'Die Aufnahme konnte nicht gestartet werden.'; if (alive.current) setError(message); return { ok: false as const, error: message }; }
    finally { flight.current = false; }
  }, [supported, unsupportedMessage]);
  const stop = useCallback(async (): Promise<VoiceMessageStopResult> => {
    if (flight.current || recorderOwner !== owner.current) return { ok: false, error: 'Keine eigene Aufnahme verfügbar oder Aufnahme wird bereits beendet.' };
    flight.current = true;
    try {
      const result = await stopVoiceRecording();
      if (alive.current) { if (result.ok) setDurationSeconds(result.data.durationSeconds); else setError(result.error); }
      return result;
    } catch { const message = 'Die Aufnahme konnte nicht verarbeitet werden. Bitte erneut aufnehmen.'; if (alive.current) setError(message); return { ok: false, error: message }; }
    finally { if (recorderOwner === owner.current) { cancelVoiceRecording(); recorderOwner = null; } flight.current = false; if (alive.current) setIsRecording(false); }
  }, []);
  return { isRecording, durationSeconds, error, start, stop, cancel, isSupported: supported, unsupportedMessage, isPreparedOnly: !supported };
}
