export type SpeechDictationResult = { ok: true; transcript: string } | { ok: false; error: string };
type RecognitionResult = { [index: number]: { transcript: string }; isFinal?: boolean };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResult>; resultIndex: number }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecognitionCtor = new () => Recognition;
function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const host = window as Window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}
export function isSpeechDictationSupported() { return Boolean(getCtor()); }
export function getSpeechDictationUnsupportedMessage() { return 'Ihr Browser unterstützt kein Diktat. Sie können Text eingeben oder eine Audio-Aufnahme erstellen.'; }

/** Interim results replace the same result slot; they are never appended repeatedly. */
export function startSpeechDictation(timeoutMs = 30_000) {
  let stop = () => {};
  let cancel = () => {};
  const result = new Promise<SpeechDictationResult>((resolve) => {
    const Ctor = getCtor();
    if (!Ctor) { resolve({ ok: false, error: getSpeechDictationUnsupportedMessage() }); return; }
    let recognition: Recognition;
    try { recognition = new Ctor(); }
    catch { resolve({ ok: false, error: 'Diktat konnte nicht gestartet werden.' }); return; }
    recognition.lang = 'de-DE'; recognition.continuous = true; recognition.interimResults = true;
    const segments: string[] = [];
    let settled = false;
    let stopping = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    const transcript = () => segments.join(' ').replace(/\s+/g, ' ').trim();
    const finish = (value: SpeechDictationResult) => {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(stopTimer);
      recognition.onresult = null; recognition.onerror = null; recognition.onend = null;
      try { recognition.abort(); } catch { /* Already stopped. */ }
      resolve(value);
    };
    const finishText = () => {
      const text = transcript();
      finish(text ? { ok: true, transcript: text } : { ok: false, error: 'Keine Sprache erkannt. Bitte erneut versuchen oder Text eingeben.' });
    };
    stop = () => {
      if (settled || stopping) return;
      stopping = true;
      stopTimer = setTimeout(finishText, 1500);
      try { recognition.stop(); } catch { finishText(); }
    };
    cancel = () => finish({ ok: false, error: 'Diktat abgebrochen.' });
    recognition.onresult = (event) => {
      segments.length = event.results.length;
      for (let index = 0; index < event.results.length; index += 1) {
        segments[index] = event.results[index]?.[0]?.transcript?.trim() ?? '';
      }
    };
    recognition.onend = finishText;
    recognition.onerror = (event) => {
      if ((event.error === 'no-speech' || event.error === 'aborted') && transcript()) { finishText(); return; }
      // Keep already recognized words available for the user's review when recognition stops.
      if (transcript() && event.error !== 'not-allowed') { finishText(); return; }
      finish({ ok: false, error: event.error === 'not-allowed'
        ? 'Mikrofon-Berechtigung erforderlich. Bitte in den Browser-Einstellungen erlauben.'
        : 'Diktat wurde unterbrochen. Bitte erneut versuchen oder Text eingeben.' });
    };
    timer = setTimeout(() => stop(), Math.max(1000, timeoutMs));
    try { recognition.start(); } catch { finish({ ok: false, error: 'Diktat konnte nicht gestartet werden.' }); }
  });
  return { result, stop: () => stop(), cancel: () => cancel() };
}
export function runSpeechDictation(timeoutMs = 30_000): Promise<SpeechDictationResult> {
  return startSpeechDictation(timeoutMs).result;
}
