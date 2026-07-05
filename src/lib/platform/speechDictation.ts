import { Platform } from 'react-native';

export type SpeechDictationResult =
  | { ok: true; transcript: string }
  | { ok: false; error: string };

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } }; resultIndex: number }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechDictationSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

export function getSpeechDictationUnsupportedMessage(): string {
  if (Platform.OS !== 'web') {
    return 'Spracherfassung ist derzeit nur im Browser verfügbar.';
  }
  return 'Ihr Browser unterstützt keine Spracherfassung.';
}

export function runSpeechDictation(timeoutMs = 30_000): Promise<SpeechDictationResult> {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    return Promise.resolve({ ok: false, error: getSpeechDictationUnsupportedMessage() });
  }

  return new Promise((resolve) => {
    const recognition = new Ctor();
    recognition.lang = 'de-DE';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = '';
    let settled = false;

    const finish = (result: SpeechDictationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      if (finalText.trim()) {
        finish({ ok: true, transcript: finalText.trim() });
      } else {
        finish({ ok: false, error: 'Keine Sprache erkannt. Bitte erneut versuchen.' });
      }
    }, timeoutMs);

    recognition.onresult = (event) => {
      let chunk = '';
      for (let i = event.resultIndex; i < Object.keys(event.results).length; i += 1) {
        chunk += event.results[i]?.[0]?.transcript ?? '';
      }
      if (chunk.trim()) finalText = `${finalText} ${chunk}`.trim();
    };

    recognition.onerror = (event) => {
      const code = event.error ?? 'unknown';
      if (code === 'no-speech' && finalText.trim()) {
        finish({ ok: true, transcript: finalText.trim() });
        return;
      }
      finish({
        ok: false,
        error:
          code === 'not-allowed'
            ? 'Mikrofon-Berechtigung erforderlich. Bitte in den Browser-Einstellungen erlauben.'
            : 'Spracherfassung fehlgeschlagen. Bitte erneut versuchen.',
      });
    };

    recognition.onend = () => {
      if (finalText.trim()) {
        finish({ ok: true, transcript: finalText.trim() });
      }
    };

    try {
      recognition.start();
    } catch {
      finish({ ok: false, error: 'Spracherfassung konnte nicht gestartet werden.' });
    }
  });
}
