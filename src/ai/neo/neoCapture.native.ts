import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { File } from 'expo-file-system';
import { claimNeoMicrophone } from './neoMicrophone';
import type { NeoCapture, NeoCaptureCallbacks, NeoCaptureSource } from './neoCaptureTypes';

export function createNeoCapture(source: NeoCaptureSource, callbacks: NeoCaptureCallbacks): NeoCapture {
  let active = false, generation = 0, startedAt = 0, timer: ReturnType<typeof setTimeout> | undefined;
  let subscriptions: { remove(): void }[] = [], queue: Promise<void> = Promise.resolve(), queued = 0;
  let finishEnd: (() => void) | null = null;
  const requests = new Set<AbortController>();
  const ownedFiles = new Set<string>();
  let release: (() => void) | undefined;
  const remove = () => { clearTimeout(timer); subscriptions.forEach(item => item.remove()); subscriptions = []; };
  const discard = (uri: string | null) => { if (uri) { try { const file = new File(uri); if (file.exists) file.delete(); } catch {} } };
  const cancel = () => {
    generation++; active = false; remove(); release?.(); release = undefined;
    ExpoSpeechRecognitionModule.abort(); requests.forEach(request => request.abort()); requests.clear(); finishEnd?.(); finishEnd = null;
    const files = [...ownedFiles]; ownedFiles.clear(); files.forEach(discard);
    // Recheck only files owned by this recording after the OS writer has closed.
    if (files.length) setTimeout(() => files.forEach(discard), 2600);
    callbacks.onStatus('paused');
  };
  const begin = (serial: number) => {
    if (!active || serial !== generation) return;
    startedAt = Date.now();
    ExpoSpeechRecognitionModule.start({ lang: 'de-DE', requiresOnDeviceRecognition: true, interimResults: false, continuous: source === 'device', addsPunctuation: true,
      ...(source === 'own' ? { recordingOptions: { persist: true, outputSampleRate: 16000, outputEncoding: 'pcmFormatInt16' as const } } : {}),
      contextualStrings: ['Rollator', 'Inkontinenz', 'Sauerstoffsättigung', 'Pflegeanamnese', 'Leistungsnachweis'] });
    callbacks.onStatus('listening');
    if (source === 'own') timer = setTimeout(() => { if (active && serial === generation) ExpoSpeechRecognitionModule.stop(); }, 8000);
  };
  return {
    async start() {
      cancel(); release = claimNeoMicrophone(() => { cancel(); callbacks.onError('Die Aufnahme wurde durch eine neue NEO-Aufnahme beendet.'); }); const serial = generation; callbacks.onStatus('starting');
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable() || !ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) throw Error('Die lokale Mikrofon-/Spracherfassung ist auf diesem Gerät nicht verfügbar.');
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (serial !== generation) return;
      if (!permission.granted) throw Error('Bitte den Mikrofonzugriff für NEO freigeben.');
      active = true;
      subscriptions = [
        ExpoSpeechRecognitionModule.addListener('audiostart', event => { if (source === 'own' && serial === generation && event.uri) ownedFiles.add(event.uri); }),
        ExpoSpeechRecognitionModule.addListener('result', event => {
          if (source !== 'device' || !active || serial !== generation || !event.isFinal) return;
          const text = event.results[0]?.transcript?.trim(); if (text) { callbacks.onText(text, startedAt, Date.now()); startedAt = Date.now(); }
        }),
        ExpoSpeechRecognitionModule.addListener('audioend', event => {
          const uri = event.uri; if (source !== 'own' || !uri) return;
          if (serial !== generation || !ownedFiles.has(uri)) return;
          if (queued >= 3) { discard(uri); cancel(); callbacks.onError('Die NEO-Verarbeitung kommt nicht nach. Bitte den fehlenden Abschnitt erneut erfassen.'); return; }
          const start = startedAt, end = Date.now(); queued++;
          queue = queue.then(async () => {
            if (serial !== generation) { discard(uri); return; }
            const request = new AbortController(); requests.add(request);
            try {
              const bytes = await new File(uri).bytes(); if (serial !== generation) return;
              callbacks.onStatus('processing'); const text = await callbacks.transcribe(bytes, request.signal);
              if (serial === generation && text) callbacks.onText(text, start, end);
            } catch { if (serial === generation && !request.signal.aborted) { cancel(); callbacks.onError('Ein Audioabschnitt konnte nicht verarbeitet werden. Bitte erneut erfassen.'); } }
            finally { discard(uri); ownedFiles.delete(uri); requests.delete(request); if (active && serial === generation) callbacks.onStatus('listening'); }
          }).finally(() => { queued = Math.max(0, queued - 1); });
        }),
        ExpoSpeechRecognitionModule.addListener('end', () => {
          clearTimeout(timer); finishEnd?.(); finishEnd = null;
          if (active && serial === generation) timer = setTimeout(() => { try { begin(serial); } catch { cancel(); callbacks.onError('Die lokale Sprachaufnahme konnte nicht fortgesetzt werden.'); } }, 150);
        }),
        ExpoSpeechRecognitionModule.addListener('error', event => { if (active && serial === generation && !['aborted', 'no-speech'].includes(event.error)) { cancel(); callbacks.onError('Die lokale Sprachaufnahme wurde unterbrochen. Bitte Sprachpaket und Mikrofon prüfen.'); } }),
      ];
      try { begin(serial); } catch (error) { cancel(); remove(); throw error; }
    },
    async stop() {
      active = false; clearTimeout(timer);
      const ended = new Promise<void>(resolve => { const deadline = setTimeout(resolve, 2500); finishEnd = () => { clearTimeout(deadline); resolve(); }; });
      ExpoSpeechRecognitionModule.stop(); await ended; await queue;
      const files = [...ownedFiles]; ownedFiles.clear(); files.forEach(discard); remove(); release?.(); release = undefined; callbacks.onStatus('paused');
    },
    cancel,
  };
}
