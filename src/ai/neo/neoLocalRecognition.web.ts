export type NeoLocalRecognitionAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';
export type NeoLocalRecognitionInstance = { processLocally?: boolean };
export type NeoLocalRecognitionConstructor = {
  new(): NeoLocalRecognitionInstance;
  available?: (options: { langs: string[]; processLocally: true }) => Promise<NeoLocalRecognitionAvailability>;
  install?: (options: { langs: string[]; processLocally: true }) => Promise<boolean>;
};
export type NeoLocalRecognitionStatus = {
  state: 'ready' | 'unverified' | 'installable' | 'downloading' | 'unsupported' | 'error';
  locale: 'de-DE'; canStart: boolean; canInstall: boolean; message: string; code?: string;
};
export type NeoLocalRecognitionIssue = {
  code: string; message: string;
  recovery: 'retry' | 'install' | 'permission' | 'device' | 'unsupported' | 'none';
  retryable: boolean;
};

const options = () => ({ langs: ['de-DE'], processLocally: true as const });
const status = (state: NeoLocalRecognitionStatus['state'], message: string, extra: Partial<NeoLocalRecognitionStatus> = {}): NeoLocalRecognitionStatus =>
  ({ state, locale: 'de-DE', canStart: false, canInstall: false, message, ...extra });
const aborted = () => new DOMException('Die Sprachvorbereitung wurde abgebrochen.', 'AbortError');
function waitLocal<T>(operation: Promise<T>, signal: AbortSignal | undefined, timeout: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: unknown, value?: T) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve(value as T);
    };
    const cancel = () => finish(aborted());
    const timer = setTimeout(() => finish(new Error('local-recognition-timeout')), timeout);
    operation.then(value => finish(null, value), error => finish(error));
    if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
  });
}
function checkFailure(error: unknown): NeoLocalRecognitionStatus {
  if (error instanceof Error && ['NotAllowedError', 'SecurityError'].includes(error.name)) return status('unsupported',
    'Der Browser oder seine Richtlinie sperrt die lokale Spracherkennung. Die Freigabe „on-device-speech-recognition“ und die Browser-Einstellungen müssen diese Funktion erlauben.', { code: 'local-policy-blocked' });
  return status('error', error instanceof Error && error.message === 'local-recognition-timeout'
    ? 'Der Browser beantwortet die Sprachpaketprüfung gerade nicht. Bitte die Prüfung erneut starten.'
    : 'Der Browser konnte das deutsche lokale Sprachpaket nicht prüfen. Bitte die Prüfung erneut starten.', { code: 'local-check-failed' });
}

/** Does not request a microphone, download a model, or enable provider-side ASR. */
export async function checkNeoLocalRecognition(Constructor: NeoLocalRecognitionConstructor | undefined, signal?: AbortSignal, instance?: NeoLocalRecognitionInstance): Promise<NeoLocalRecognitionStatus> {
  signal?.throwIfAborted();
  if (!Constructor) return status('unsupported', 'Dieser Browser stellt keine Spracherkennung bereit.', { code: 'recognition-unavailable' });
  try {
    const probe = instance ?? new Constructor();
    if (!('processLocally' in probe)) return status('unsupported', 'Dieser Browser unterstützt keine lokale Spracherkennung. Es wird kein fremder Sprachdienst als Ersatz gestartet.', { code: 'local-api-unavailable' });
    if (typeof Constructor.available !== 'function') return status('unverified',
      'Der Browser unterstützt den lokalen Modus, kann das deutsche Sprachpaket aber nicht vorab prüfen. Der Start erfolgt ausschließlich lokal.', { canStart: true, code: 'local-availability-unverified' });
    const availability = await waitLocal(Constructor.available.call(Constructor, options()), signal, 8000);
    signal?.throwIfAborted();
    if (availability === 'available') return status('ready', 'Das deutsche lokale Sprachpaket ist bereit.', { canStart: true });
    if (availability === 'downloadable') {
      if (typeof Constructor.install === 'function') return status('installable', 'Das deutsche lokale Sprachpaket fehlt. „Deutsches Sprachpaket laden“ lädt es im Browser; danach wird die Erkennung erneut geprüft.', { canInstall: true, code: 'local-language-pack-missing' });
      return status('unsupported', 'Das deutsche Sprachpaket fehlt. Dieser Browser bietet keine Möglichkeit, es hier zu laden.', { code: 'local-install-api-unavailable' });
    }
    if (availability === 'downloading') return status('downloading', 'Der Browser lädt das deutsche Sprachpaket noch. Nach dem Download die Sprachpaketprüfung erneut starten.', { code: 'local-language-pack-downloading' });
    if (availability === 'unavailable') return status('unsupported', 'Dieser Browser stellt derzeit kein lokales deutsches Sprachpaket bereit. Erneutes Anklicken von NEO behebt das nicht.', { code: 'local-language-unavailable' });
    return status('error', 'Der Browser hat keinen gültigen Status für das deutsche Sprachpaket geliefert.', { code: 'local-status-invalid' });
  } catch (error) {
    if (signal?.aborted) throw aborted();
    return checkFailure(error);
  }
}

/** Call only from the explicit language-pack download action. No automatic install. */
export async function installNeoLocalRecognition(Constructor: NeoLocalRecognitionConstructor | undefined, signal?: AbortSignal): Promise<NeoLocalRecognitionStatus> {
  const current = await checkNeoLocalRecognition(Constructor, signal);
  if (!current.canInstall || typeof Constructor?.install !== 'function') return current;
  try {
    const installed = await waitLocal(Constructor.install.call(Constructor, options()), signal, 120000);
    signal?.throwIfAborted();
    if (installed !== true) return status('error', 'Der Browser hat das deutsche Sprachpaket nicht fertig geladen. Bitte Verbindung und Browser-Freigabe prüfen und den Download erneut starten.', { canInstall: true, code: 'local-install-incomplete' });
    // A true installation result alone is not evidence that the package is ready.
    return await checkNeoLocalRecognition(Constructor, signal);
  } catch (error) {
    if (signal?.aborted) throw aborted();
    if (error instanceof Error && ['NotAllowedError', 'SecurityError'].includes(error.name)) return status('unsupported',
      'Der Browser hat das Laden des lokalen Sprachpakets gesperrt. Bitte die Browser-Freigabe prüfen und den Download über den sichtbaren Ladebutton starten.', { code: 'local-install-blocked' });
    return status('error', 'Das deutsche Sprachpaket konnte nicht fertig geladen werden. Bitte den Download erneut starten.', { canInstall: true, code: 'local-install-failed' });
  }
}

/** Browser codes only: no raw exception messages, audio, or transcript enters the UI. */
export function neoLocalRecognitionError(value: unknown): NeoLocalRecognitionIssue {
  const code = typeof value === 'string' && /^[a-z][a-z-]{0,59}$/.test(value) ? value : 'unknown';
  const issue = (message: string, recovery: NeoLocalRecognitionIssue['recovery'], retryable = false) => ({ code, message, recovery, retryable });
  switch (code) {
    case 'language-not-supported': return issue('Das deutsche lokale Sprachpaket fehlt oder dieser Browser unterstützt die lokale deutsche Erkennung nicht. Bitte den Sprachpaketstatus prüfen; erneutes Anklicken allein behebt diesen Fehler nicht.', 'install');
    case 'not-allowed': return issue('Der Mikrofonzugriff wurde nicht freigegeben. Bitte den Mikrofonzugriff für CareSuite in den Browser-Einstellungen erlauben.', 'permission');
    case 'service-not-allowed': return issue('Der Browser oder eine Verwaltungsrichtlinie erlaubt den lokalen Sprachdienst nicht. Bitte die lokale Spracherkennung in den Browser-Einstellungen prüfen.', 'unsupported');
    case 'audio-capture': return issue('Der Browser kann das Mikrofon nicht verwenden. Bitte Eingabegerät und Betriebssystem-Freigabe prüfen.', 'device');
    case 'network': return issue('Der lokale Sprachdienst des Browsers konnte nicht gestartet oder erreicht werden. Bitte den Sprachpaketstatus und die Browser-Verbindung prüfen.', 'retry', true);
    case 'aborted': return issue('Der Browser hat die lokale Spracherkennung abgebrochen. Die Sitzung kann erneut gestartet werden.', 'retry', true);
    case 'no-speech': return issue('Es wurde noch keine Sprache erkannt. NEO bleibt während der aktiven Sitzung zum Zuhören bereit.', 'retry', true);
    case 'phrases-not-supported': return issue('Dieser Browser unterstützt die angeforderten Fachwortvorgaben nicht.', 'unsupported');
    case 'bad-grammar': return issue('Der Browser unterstützt die konfigurierte Sprachgrammatik nicht.', 'unsupported');
    default: return issue(`Die lokale Spracherkennung wurde beendet. Browsercode: ${code}. Bitte den Sprachpaketstatus prüfen.`, 'retry', true);
  }
}
