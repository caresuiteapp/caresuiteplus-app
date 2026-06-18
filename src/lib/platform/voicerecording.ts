import { Platform } from 'react-native';

export type VoiceRecordingCapture = {
  mimeType: string;
  fileName: string;
  bytes: Uint8Array;
  durationSeconds: number;
};

export type VoiceRecordingResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const UNSUPPORTED_NATIVE =
  'Sprachnachrichten sind derzeit nur im Browser verfügbar. Bitte nutzen Sie die Web-Version mit Mikrofon-Berechtigung.';
const PERMISSION_DENIED =
  'Sprachnachricht — Browser-Berechtigung erforderlich. Bitte erlauben Sie den Mikrofonzugriff in den Browser-Einstellungen.';
const NOT_SUPPORTED =
  'Sprachnachricht — Browser-Berechtigung erforderlich. Ihr Browser unterstützt keine Sprachaufnahme.';

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let chunks: BlobPart[] = [];
let startedAt: number | null = null;
let durationTimer: ReturnType<typeof setInterval> | null = null;
let durationSeconds = 0;
let onTick: ((seconds: number) => void) | null = null;

function clearDurationTimer(): void {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
}

function stopMediaTracks(): void {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('mpeg')) return 'mp3';
  return 'webm';
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

export function isVoiceRecordingSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

export function getVoiceRecordingUnsupportedMessage(): string {
  if (Platform.OS !== 'web') return UNSUPPORTED_NATIVE;
  if (!isVoiceRecordingSupported()) return NOT_SUPPORTED;
  return '';
}

export async function startVoiceRecording(
  onDurationTick?: (seconds: number) => void,
): Promise<VoiceRecordingResult<{ started: true }>> {
  if (Platform.OS !== 'web') {
    return { ok: false, error: UNSUPPORTED_NATIVE };
  }
  if (!isVoiceRecordingSupported()) {
    return { ok: false, error: NOT_SUPPORTED };
  }

  cancelVoiceRecording();
  onTick = onDurationTick ?? null;
  durationSeconds = 0;
  onTick?.(0);

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return { ok: false, error: PERMISSION_DENIED };
  }

  const mimeType = pickMimeType();
  chunks = [];
  startedAt = Date.now();

  try {
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
  } catch {
    stopMediaTracks();
    return { ok: false, error: NOT_SUPPORTED };
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  mediaRecorder.start(250);
  clearDurationTimer();
  durationTimer = setInterval(() => {
    durationSeconds = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0;
    onTick?.(durationSeconds);
  }, 500);

  return { ok: true, data: { started: true } };
}

export async function stopVoiceRecording(): Promise<VoiceRecordingResult<VoiceRecordingCapture>> {
  if (Platform.OS !== 'web' || !mediaRecorder || !startedAt) {
    return { ok: false, error: 'Keine aktive Aufnahme.' };
  }

  const recorder = mediaRecorder;
  const mimeType = recorder.mimeType || pickMimeType();
  const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

  return new Promise((resolve) => {
    recorder.onstop = async () => {
      clearDurationTimer();
      stopMediaTracks();
      mediaRecorder = null;
      startedAt = null;
      onTick = null;

      const blob = new Blob(chunks, { type: mimeType });
      chunks = [];

      if (blob.size === 0) {
        resolve({ ok: false, error: 'Aufnahme ist leer.' });
        return;
      }

      const bytes = await blobToBytes(blob);
      const ext = extensionForMime(mimeType);
      resolve({
        ok: true,
        data: {
          mimeType: mimeType.split(';')[0] ?? mimeType,
          fileName: `sprachnachricht-${Date.now()}.${ext}`,
          bytes,
          durationSeconds: elapsed,
        },
      });
    };

    if (recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      recorder.onstop?.(new Event('stop'));
    }
  });
}

export function cancelVoiceRecording(): void {
  clearDurationTimer();
  chunks = [];
  startedAt = null;
  durationSeconds = 0;
  onTick = null;

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch {
      // ignore
    }
  }
  mediaRecorder = null;
  stopMediaTracks();
}

export function getActiveVoiceRecordingDuration(): number {
  return durationSeconds;
}
