import { loadLocalRobotVoice } from './robotVoice.web';
import { ROBOT_AUDIO_IDS } from './robotAudioBank.web';
import { NEO_FIXED_AUDIO } from './neoFixedAudio.web';

type Pending = { resolve: (audio: ArrayBuffer) => void; reject: (error: Error) => void; cleanup: () => void };

/** One worker per signed-in assistant. Profile-derived audio stays in memory. */
export function createNeoSpeech() {
  let worker: Worker | null = null;
  let nextId = 0;
  let disposed = false;
  const pending = new Map<number, Pending>();
  const audioCache = new Map<string, ArrayBuffer>();
  let cacheBytes = 0;
  const getWorker = () => {
    if (disposed) throw new Error('voice-disposed');
    if (!worker) {
      worker = new Worker('/neo-voice/v1/neo-worker.js', { name: 'CareSuite Neo' });
      worker.onmessage = ({ data }) => {
        const request = pending.get(data.id); if (!request) return;
        pending.delete(data.id); request.cleanup();
        if (data.error || !(data.audio instanceof ArrayBuffer) && !data.ready) request.reject(new Error('voice-unavailable'));
        else request.resolve(data.audio ?? new ArrayBuffer(0));
      };
      worker.onerror = () => {
        for (const request of pending.values()) { request.cleanup(); request.reject(new Error('voice-worker-unavailable')); }
        pending.clear(); worker?.terminate(); worker = null;
      };
    }
    return worker;
  };
  const request = (type: 'prepare' | 'speak', text: string, signal: AbortSignal) => new Promise<ArrayBuffer>((resolve, reject) => {
    signal.throwIfAborted();
    const active = getWorker(), id = ++nextId;
    const abort = () => { pending.delete(id); cleanup(); active.postMessage({ type: 'cancel', id }); reject(new DOMException('Aborted', 'AbortError')); };
    const timeout = setTimeout(() => {
      active.terminate(); if (worker === active) worker = null;
      for (const value of pending.values()) { value.cleanup(); value.reject(new Error('voice-timeout')); }
      pending.clear();
    }, 90_000);
    const cleanup = () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); };
    pending.set(id, { resolve, reject, cleanup }); signal.addEventListener('abort', abort, { once: true });
    active.postMessage({ type, id, text });
  });
  return {
    prepare: () => { if (!worker && !disposed) void request('prepare', '', new AbortController().signal).catch(() => {}); },
    loadVoice: async (id: string, signal: AbortSignal, text?: string): Promise<ArrayBuffer> => {
      signal.throwIfAborted();
      if (Object.prototype.hasOwnProperty.call(ROBOT_AUDIO_IDS, id)) return loadLocalRobotVoice(id, signal);
      if (!id.startsWith('neo:') || !text || text.length > 360) throw new Error('voice-invalid-reply');
      if (Object.prototype.hasOwnProperty.call(NEO_FIXED_AUDIO, text)) {
        const raw = atob(NEO_FIXED_AUDIO[text]), bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        return bytes.buffer;
      }
      const cached = audioCache.get(text); if (cached) return cached.slice(0);
      const audio = await request('speak', text, signal); signal.throwIfAborted();
      if (cacheBytes + audio.byteLength > 8_000_000) { audioCache.clear(); cacheBytes = 0; }
      if (audio.byteLength <= 8_000_000) { audioCache.set(text, audio); cacheBytes += audio.byteLength; }
      return audio.slice(0);
    },
    dispose: () => {
      disposed = true; worker?.terminate(); worker = null;
      for (const value of pending.values()) { value.cleanup(); value.reject(new DOMException('Aborted', 'AbortError')); }
      pending.clear(); audioCache.clear(); cacheBytes = 0;
    },
  };
}
