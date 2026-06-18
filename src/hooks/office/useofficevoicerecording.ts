import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type VoiceRecordingResult = {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileData: Uint8Array;
};

export const MIC_PERMISSION_DENIED_ERROR =
  'Mikrofonzugriff verweigert. Bitte erlauben Sie den Zugriff in den Browser-Einstellungen.';

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/mpeg',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

export function useOfficeVoiceRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = null;
  }, []);

  const start = useCallback(async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    setError(null);

    if (Platform.OS !== 'web') {
      const msg = 'Sprachaufnahme ist derzeit nur im Web verfügbar.';
      setError(msg);
      return { ok: false, error: msg };
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const msg = 'Mikrofon wird in dieser Umgebung nicht unterstützt.';
      setError(msg);
      return { ok: false, error: msg };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      startedAtRef.current = Date.now();
      setIsRecording(true);
      setDurationSeconds(0);
      timerRef.current = setInterval(() => {
        if (startedAtRef.current) {
          setDurationSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }
      }, 500);
      return { ok: true };
    } catch (err) {
      cleanup();
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError(MIC_PERMISSION_DENIED_ERROR);
        return { ok: false, error: MIC_PERMISSION_DENIED_ERROR };
      }
      const msg = 'Mikrofon konnte nicht gestartet werden.';
      setError(msg);
      return { ok: false, error: msg };
    }
  }, [cleanup]);

  const stop = useCallback(async (): Promise<
    { ok: true; data: VoiceRecordingResult } | { ok: false; error: string }
  > => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return { ok: false, error: 'Keine aktive Aufnahme.' };
    }

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || pickMimeType();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = extensionForMime(mimeType);
        const fileName = `sprachnachricht-${Date.now()}.${ext}`;
        const buffer = await blob.arrayBuffer();
        const fileData = new Uint8Array(buffer);

        cleanup();
        setIsRecording(false);
        setDurationSeconds(0);

        if (fileData.length === 0) {
          resolve({ ok: false, error: 'Aufnahme ist leer.' });
          return;
        }

        resolve({
          ok: true,
          data: { fileName, mimeType, fileSizeBytes: fileData.length, fileData },
        });
      };
      recorder.stop();
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    setIsRecording(false);
    setDurationSeconds(0);
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    isRecording,
    durationSeconds,
    error,
    start,
    stop,
    cancel,
    isSupported: Platform.OS === 'web',
  };
}
