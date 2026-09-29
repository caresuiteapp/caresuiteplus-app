export type LocalReaderProgress = { message: string; progress: number; page: number; pages: number };
export type LocalReaderOptions = { signal?: AbortSignal; onProgress?: (progress: LocalReaderProgress) => void; forceOcr?: boolean; rotation?: number };
export type LocalReaderResult = { text: string; pages: number; ocrPages: number; lowConfidence: boolean };
type Reader = { read: (file: Blob, options: LocalReaderOptions) => Promise<LocalReaderResult> };
declare global { interface Window { CareSuitePlanReaderV1?: Reader } }
let pending: Promise<Reader> | undefined;
export async function readLocalPlan(file: Blob, options: LocalReaderOptions): Promise<LocalReaderResult> {
  if (typeof window === 'undefined') throw new Error('Die lokale Texterkennung benötigt einen Webbrowser.');
  if (options.signal?.aborted) throw new DOMException('Analyse abgebrochen.', 'AbortError');
  if (!pending) pending = new Promise<Reader>((resolve, reject) => {
    if (window.CareSuitePlanReaderV1) { resolve(window.CareSuitePlanReaderV1); return; }
    const script = document.createElement('script');
    script.type = 'module'; script.src = '/calendar-reader/v1/reader.mjs';
    const timer = setTimeout(() => fail(), 30_000);
    const fail = () => { clearTimeout(timer); script.remove(); pending = undefined; reject(new Error('Lokale Texterkennung konnte nicht geladen werden. Bitte Verbindung prüfen und erneut versuchen.')); };
    script.onerror = fail;
    script.onload = () => { clearTimeout(timer); if (window.CareSuitePlanReaderV1) resolve(window.CareSuitePlanReaderV1); else fail(); };
    document.head.appendChild(script);
  });
  // Allow cancellation while browser assets are loading, not just during OCR.
  const reader = await new Promise<Reader>((resolve, reject) => {
    const cancel = () => reject(new DOMException('Analyse abgebrochen.', 'AbortError'));
    options.signal?.addEventListener('abort', cancel, { once: true });
    pending!.then(resolve, reject).finally(() => options.signal?.removeEventListener('abort', cancel));
  });
  if (options.signal?.aborted) throw new DOMException('Analyse abgebrochen.', 'AbortError');
  return reader.read(file, options);
}
