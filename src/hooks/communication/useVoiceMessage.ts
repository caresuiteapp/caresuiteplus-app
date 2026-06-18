import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelVoiceRecording as cancelPlatformRecording,
  getVoiceRecordingUnsupportedMessage,
  isVoiceRecordingSupported,
  startVoiceRecording,
  stopVoiceRecording,
  type VoiceRecordingCapture,
} from '@/lib/platform/voicerecording';

export type VoiceMessageStopResult =
  | { ok: true; data: VoiceRecordingCapture }
  | { ok: false; error: string };

export function useVoiceMessage() {
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = isVoiceRecordingSupported();
  const unsupportedMessage = getVoiceRecordingUnsupportedMessage();
  const stoppingRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelPlatformRecording();
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      const message = unsupportedMessage || 'Sprachaufnahme nicht verfügbar.';
      setError(message);
      return { ok: false as const, error: message };
    }

    const result = await startVoiceRecording(setDurationSeconds);
    if (result.ok) {
      setIsRecording(true);
      setDurationSeconds(0);
    } else {
      setError(result.error);
    }
    return result;
  }, [supported, unsupportedMessage]);

  const stop = useCallback(async (): Promise<VoiceMessageStopResult> => {
    if (stoppingRef.current) return { ok: false, error: 'Aufnahme wird beendet…' };
    stoppingRef.current = true;
    const result = await stopVoiceRecording();
    stoppingRef.current = false;
    setIsRecording(false);
    if (!result.ok) {
      setError(result.error);
      return result;
    }
    setDurationSeconds(result.data.durationSeconds);
    return result;
  }, []);

  const cancel = useCallback(() => {
    cancelPlatformRecording();
    setIsRecording(false);
    setDurationSeconds(0);
    setError(null);
  }, []);

  return {
    isRecording,
    durationSeconds,
    error,
    start,
    stop,
    cancel,
    isSupported: supported,
    unsupportedMessage,
    isPreparedOnly: !supported,
  };
}
