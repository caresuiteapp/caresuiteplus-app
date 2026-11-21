import { checkNeoLocalRecognition, neoLocalRecognitionError } from './neoLocalRecognition.web';
import { encodeNeoWav } from './neoAudio';
import { claimNeoMicrophone } from './neoMicrophone';
import type { NeoCapture, NeoCaptureCallbacks, NeoCaptureSource } from './neoCaptureTypes';

/** Each capture owns its microphone, generation and bounded audio queue. No global recording state. */
export function createNeoCapture(source: NeoCaptureSource, callbacks: NeoCaptureCallbacks, options: { manageMicrophone?: boolean } = {}): NeoCapture {
  let generation = 0, active = false, finishing = false;
  let stream: MediaStream | null = null, context: AudioContext | null = null, node: AudioWorkletNode | null = null;
  let recognition: any = null, restart: ReturnType<typeof setTimeout> | undefined;
  let chunks: Float32Array[] = [], samples = 0, voiced = 0, quiet = 0, startedAt = 0, rate = 48000;
  let queue: Promise<void> = Promise.resolve(), queued = 0;
  const requests = new Set<AbortController>();
  let release: (() => void) | undefined;
  let finishedEnd: (() => void) | undefined, finishedFrames: (() => void) | undefined;
  const cleanup = () => {
    release?.(); release = undefined;
    clearTimeout(restart); if (recognition) { recognition.onresult = recognition.onend = recognition.onerror = null; try { recognition.abort(); } catch {} recognition = null; }
    if (node) { node.port.onmessage = null; node.port.postMessage('stop'); node.disconnect(); node = null; }
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    void context?.close().catch(() => {}); context = null;
  };
  const flush = () => {
    if (!samples) return;
    const parts = chunks, length = samples, start = startedAt, end = Date.now(), serial = generation, voice = voiced;
    chunks = []; samples = voiced = quiet = 0; startedAt = end;
    if (voice < rate * 0.25) return;
    if (queued >= 3) { cancel(); callbacks.onError('Die Sprachverarbeitung kommt nicht nach. Das Mikrofon wurde gestoppt; bereits erfasster Text bleibt erhalten.'); return; }
    const pcm = new Float32Array(length); let offset = 0; for (const part of parts) { pcm.set(part, offset); offset += part.length; }
    const wav = encodeNeoWav(pcm, rate); queued++;
    queue = queue.then(async () => {
      if (serial !== generation) return;
      const request = new AbortController(); requests.add(request);
      try {
        callbacks.onStatus('processing'); const text = await callbacks.transcribe(wav, request.signal);
        if (serial === generation && text) callbacks.onText(text, start, end);
      } catch { if (serial === generation && !request.signal.aborted) { cancel(); callbacks.onError('Ein Sprachabschnitt konnte nicht verarbeitet werden. Das Mikrofon wurde gestoppt. Bitte den fehlenden Abschnitt erneut erfassen.'); } }
      finally { requests.delete(request); if (serial === generation && active) callbacks.onStatus('listening'); }
    }).finally(() => { queued = Math.max(0, queued - 1); });
  };
  const cancel = () => { generation++; active = finishing = false; finishedEnd?.(); finishedEnd = undefined; finishedFrames?.(); finishedFrames = undefined; cleanup(); chunks = []; samples = voiced = quiet = 0; for (const request of requests) request.abort(); requests.clear(); callbacks.onStatus('paused'); };
  const beginRecognition = (serial: number) => {
    const Constructor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Constructor) throw Error('Die Geräte-/Browsererkennung ist hier nicht verfügbar. Bitte den eigenen Sprachdienst verwenden.');
    const instance = new Constructor(); recognition = instance; let empty = true;
    if (!('processLocally' in instance)) throw Error('Die lokale Browsererkennung ist hier nicht verfügbar. Bitte den eigenen NEO-Sprachdienst wählen.');
    instance.processLocally = true;
    instance.lang = 'de-DE'; instance.continuous = true; instance.interimResults = false;
    instance.onresult = (event: any) => {
      if ((!active && !finishing) || serial !== generation) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]; if (!result.isFinal) continue;
        const text = String(result[0]?.transcript ?? '').trim();
        if (text) { empty = false; const now = Date.now(); callbacks.onText(text, startedAt, now); startedAt = now; }
      }
    };
    instance.onerror = (event: any) => { if (serial !== generation) return; if (event.error !== 'no-speech' && event.error !== 'aborted') { cancel(); const issue = neoLocalRecognitionError(event.error); callbacks.onError(issue.message + ' [' + issue.code + ']'); } };
    instance.onend = () => { finishedEnd?.(); finishedEnd = undefined; if (active && serial === generation) restart = setTimeout(() => { if (active && serial === generation) { try { beginRecognition(serial); } catch { cancel(); callbacks.onError('Die Browsererkennung konnte nicht fortgesetzt werden.'); } } }, empty ? 500 : 120); };
    instance.start(); callbacks.onStatus('listening');
  };
  return {
    async start() {
      cancel(); if (options.manageMicrophone !== false) release = claimNeoMicrophone(() => { cancel(); callbacks.onError('Die Aufnahme wurde durch eine neue NEO-Aufnahme beendet.'); }); active = true; const serial = generation; startedAt = Date.now(); callbacks.onStatus('starting');
      try {
        if (!window.isSecureContext) throw Error('NEO benötigt eine sichere Verbindung für das Mikrofon.');
        if (source === 'device') {
          const Constructor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
          const request = new AbortController(); requests.add(request);
          let status;
          try { status = await checkNeoLocalRecognition(Constructor, request.signal); }
          finally { requests.delete(request); }
          if (!active || serial !== generation || request.signal.aborted) return;
          if (!status.canStart) throw Error(status.message + (status.code ? ` [${status.code}]` : ''));
          beginRecognition(serial); return;
        }
        const granted = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        if (!active || serial !== generation) { granted.getTracks().forEach(track => track.stop()); return; }
        stream = granted; const audio = new AudioContext(); context = audio; rate = audio.sampleRate;
        await audio.audioWorklet.addModule('/neo/neo-capture-processor.js');
        if (!active || serial !== generation) { await audio.close().catch(() => {}); return; }
        node = new AudioWorkletNode(audio, 'neo-capture');
        const mute = audio.createGain(); mute.gain.value = 0; audio.createMediaStreamSource(granted).connect(node); node.connect(mute).connect(audio.destination);
        node.port.onmessage = ({ data }: MessageEvent<unknown>) => {
          if (data && typeof data === 'object' && 'flushed' in data) { finishedFrames?.(); finishedFrames = undefined; return; }
          if (!active || serial !== generation || !(data instanceof Float32Array) || data.length > rate) return;
          let energy = 0; for (const sample of data) energy += sample * sample;
          const isVoice = Math.sqrt(energy / data.length) > 0.009;
          if (!samples) startedAt = Date.now() - data.length / rate * 1000;
          chunks.push(data); samples += data.length;
          if (isVoice) { voiced += data.length; quiet = 0; } else quiet += data.length;
          if (samples >= rate * 8 || voiced && quiet >= rate * 0.75) flush();
          else if (!voiced && samples >= rate) { chunks = chunks.slice(-1); samples = data.length; quiet = data.length; }
        };
        for (const track of granted.getAudioTracks()) track.onended = () => { if (active && serial === generation) { cancel(); callbacks.onError('Die Mikrofonverbindung wurde beendet.'); } };
        await audio.resume(); if (active && serial === generation) callbacks.onStatus('listening');
      } catch (error) { if (serial === generation) { cancel(); throw error; } }
    },
    async stop() {
      if (finishing) return queue; finishing = true; const serial = generation;
      if (source === 'own' && node) {
        await new Promise<void>(resolve => { const timer = setTimeout(resolve, 300); finishedFrames = () => { clearTimeout(timer); resolve(); }; node!.port.postMessage('flush'); });
        finishedFrames = undefined; if (serial !== generation) return; flush();
      }
      active = false;
      if (source === 'device' && recognition) {
        await new Promise<void>(resolve => { const timer = setTimeout(resolve, 1200); finishedEnd = () => { clearTimeout(timer); resolve(); }; try { recognition.stop(); } catch { clearTimeout(timer); resolve(); } });
        finishedEnd = undefined;
      }
      if (serial !== generation) return; cleanup(); await queue; finishing = false; callbacks.onStatus('paused');
    },
    cancel,
  };
}
