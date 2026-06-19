import { Platform } from 'react-native';

export type MicrophoneAccessResult =
  | { ok: true; stream: MediaStream | null }
  | { ok: false; error: string; reason: 'denied' | 'unavailable' | 'unsupported' };

function isMobileWebUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function getMicrophoneDeniedMessage(): string {
  if (Platform.OS === 'ios') {
    return (
      'Mikrofon-Zugriff wurde verweigert. Bitte öffne Einstellungen → CareSuite+ → Mikrofon, ' +
      'aktiviere den Zugriff und starte die Sprachsteuerung erneut.'
    );
  }

  if (Platform.OS === 'android') {
    return (
      'Mikrofon-Zugriff wurde verweigert. Bitte öffne Einstellungen → Apps → CareSuite+ → ' +
      'Berechtigungen → Mikrofon, erlaube den Zugriff und versuche es erneut.'
    );
  }

  if (isMobileWebUserAgent()) {
    return (
      'Mikrofon-Zugriff wurde verweigert. Safari (iOS): Einstellungen → Safari → Mikrofon. ' +
      'Chrome (Android): Menü (⋮) → Einstellungen → Website-Einstellungen → Mikrofon. ' +
      'Danach diese Seite neu laden und erneut auf „Mikro“ tippen.'
    );
  }

  return (
    'Mikrofon-Zugriff wurde verweigert. Bitte erlaube den Zugriff über das Schloss-Symbol ' +
    'in der Adressleiste (Website-Einstellungen → Mikrofon), lade die Seite neu und versuche es erneut.'
  );
}

function getUnsupportedMessage(): string {
  if (Platform.OS === 'web') {
    return (
      'Mikrofon-Zugriff wird in diesem Browser nicht unterstützt. ' +
      'Bitte nutze einen aktuellen Browser (Chrome, Firefox, Safari oder Edge).'
    );
  }
  return 'Mikrofon-Zugriff konnte auf diesem Gerät nicht angefordert werden.';
}

function loadExpoAv(): typeof import('expo-av') {
  // Lazy load — vermeidet react-native Pull in Vitest bei reinen Source-Tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-av') as typeof import('expo-av');
}

async function requestNativeMicrophonePermission(): Promise<MicrophoneAccessResult> {
  try {
    const { Audio } = loadExpoAv();
    const existing = await Audio.getPermissionsAsync();
    const permission =
      existing.status === 'granted' ? existing : await Audio.requestPermissionsAsync();

    if (permission.status !== 'granted') {
      return { ok: false, error: getMicrophoneDeniedMessage(), reason: 'denied' };
    }

    return { ok: true, stream: null };
  } catch {
    return { ok: false, error: getUnsupportedMessage(), reason: 'unavailable' };
  }
}

async function requestWebMicrophoneAccess(): Promise<MicrophoneAccessResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: getUnsupportedMessage(), reason: 'unsupported' };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      stream.getTracks().forEach((track) => track.stop());
      return {
        ok: false,
        error: 'Kein Mikrofon-Audiokanal verfügbar. Bitte prüfe die Geräteeinstellungen.',
        reason: 'unavailable',
      };
    }
    return { ok: true, stream };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    const message = error instanceof Error ? error.message : String(error ?? '');

    if (
      name === 'NotAllowedError' ||
      name === 'PermissionDeniedError' ||
      /permission denied|not allowed/i.test(message)
    ) {
      return { ok: false, error: getMicrophoneDeniedMessage(), reason: 'denied' };
    }

    if (name === 'NotFoundError' || /Requested device not found/i.test(message)) {
      return {
        ok: false,
        error: 'Kein Mikrofon gefunden. Bitte schließe ein Mikrofon an oder prüfe die Geräteeinstellungen.',
        reason: 'unavailable',
      };
    }

    return {
      ok: false,
      error: message.trim() || 'Mikrofon-Zugriff fehlgeschlagen.',
      reason: 'unavailable',
    };
  }
}

/** Fordert Mikrofon-Zugriff an — immer beim Start der Sprachsteuerung aufrufen. */
export async function requestMicrophoneAccess(): Promise<MicrophoneAccessResult> {
  if (Platform.OS === 'web') {
    return requestWebMicrophoneAccess();
  }
  return requestNativeMicrophonePermission();
}

export function isRealtimeVoiceEnvironmentSupported(): boolean {
  return Platform.OS === 'web' && typeof RTCPeerConnection !== 'undefined';
}

export function getRealtimeVoiceUnsupportedMessage(): string {
  if (Platform.OS === 'web') {
    return 'Live-Sprachverbindung wird in diesem Browser nicht unterstützt. Bitte nutze den Text-Chat.';
  }
  return (
    'Live-Sprachverbindung ist in der mobilen App derzeit nur im Browser verfügbar. ' +
    'Mikrofon-Berechtigung ist aktiv — bitte öffne CareSuite+ im Browser für VoiceCore.'
  );
}
