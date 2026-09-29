/* Neo's local synthesis worker. All model/runtime files are served by CareSuite.
 * No transcript, profile name or generated audio is sent over the network.
 */
const rawFetch = self.fetch.bind(self);
self.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url, self.location.href);
  if (url.origin !== self.location.origin || (init?.method && init.method !== 'GET')) {
    return Promise.reject(new Error('local-assets-only'));
  }
  return rawFetch(input, { ...init, credentials: 'omit', referrerPolicy: 'no-referrer' });
};
importScripts('./ort.wasm.min.js', './piper_phonemize.js');
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = new URL('./', self.location.href).href;
ort.env.logLevel = 'error';
let session, phonemizer, config, readyPromise, phonemeResult;
const canceled = new Set();
let queue = Promise.resolve();

async function fileBytes(file) {
  const url = new URL(file, self.location.href).href;
  let cache;
  try { cache = await caches.open('caresuite-neo-voice-v1'); } catch { /* private browsing */ }
  const saved = await cache?.match(url);
  if (saved) return saved.arrayBuffer();
  const response = await fetch(url);
  if (!response.ok) throw new Error('voice-asset-unavailable');
  const copy = response.clone();
  const data = await response.arrayBuffer();
  try { await cache?.put(url, copy); } catch { /* quota: keep session-only copy */ }
  return data;
}
function ready() {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    const manifest = await (await fetch('./voice-manifest.json')).json();
    config = await (await fetch('./voice-config.json')).json();
    const model = new Uint8Array(manifest.parts.reduce((n, p) => n + p.bytes, 0));
    let offset = 0;
    for (const part of manifest.parts) {
      const data = await fileBytes(part.file);
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(x => x.toString(16).padStart(2, '0')).join('');
      if (data.byteLength !== part.bytes || digest !== part.sha256) {
        try { await (await caches.open('caresuite-neo-voice-v1')).delete(new URL(part.file, self.location.href).href); } catch { /* cache unavailable */ }
        throw new Error('voice-model-integrity');
      }
      model.set(new Uint8Array(data), offset); offset += data.byteLength;
    }
    session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    phonemizer = await createPiperPhonemize({
      noInitialRun: true,
      print: line => { try { const result = JSON.parse(line); if (Array.isArray(result.phoneme_ids)) phonemeResult = result; } catch { /* non-result runtime message */ } },
      printErr: () => {},
      locateFile: path => new URL(path.split('/').pop(), self.location.href).href,
      getPreloadedPackage: () => undefined,
    });
  })().catch(async error => { readyPromise = undefined; try { await session?.release(); } catch { /* initialization failed */ } session = undefined; throw error; });
  return readyPromise;
}
function phonemize(text, language) {
  phonemeResult = undefined;
  phonemizer.callMain(['-l', language, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']);
  if (!phonemeResult?.phoneme_ids?.length) throw new Error('voice-invalid-phonemes');
  return phonemeResult;
}
// The written brand stays unchanged. Its pronunciation uses English phonemes
// inside the same German speaker and a single continuous synthesis pass.
function speechIds(text) {
  const brand = /\b(?:Care\s*Suite\s+Health\s*OS|Care\s*Suite|Health\s*OS)\b/gi;
  const matches = [...text.matchAll(brand)];
  if (!matches.length) return phonemize(text, config.espeak.voice).phoneme_ids;
  const segments = [];
  let offset = 0;
  for (const match of matches) {
    if (match.index > offset) segments.push({ raw: text.slice(offset, match.index), language: config.espeak.voice });
    segments.push({ raw: match[0], language: 'en-us', spoken: match[0].replace(/Care\s*Suite/i, 'Care Suite').replace(/Health\s*OS/i, 'Health O S') });
    offset = match.index + match[0].length;
  }
  if (offset < text.length) segments.push({ raw: text.slice(offset), language: config.espeak.voice });
  const phones = [];
  let previous = '';
  for (const segment of segments) {
    if (!segment.raw.trim()) { previous += segment.raw; continue; }
    if (phones.length && (/\s$/.test(previous) || /^\s/.test(segment.raw)) && phones.at(-1) !== ' ') phones.push(' ');
    let part;
    if (/^[.,!?:;]+$/.test(segment.raw.trim())) part = [...segment.raw.trim()];
    else {
      part = [...phonemize(segment.spoken ?? segment.raw, segment.language).phonemes];
      // eSpeak adds an end-of-sentence marker even to a mid-sentence fragment.
      if (!/[.!?]\s*$/.test(segment.raw) && part.at(-1) === '.') part.pop();
    }
    phones.push(...part); previous = segment.raw;
  }
  const map = config.phoneme_id_map, pad = map['_'];
  const ids = [...map['^'], ...pad];
  for (const phone of phones) {
    if (!Object.prototype.hasOwnProperty.call(map, phone)) throw new Error('voice-brand-phoneme-unsupported');
    ids.push(...map[phone], ...pad);
  }
  ids.push(...map['$']);
  return ids;
}
function wav(pcm, rate) {
  const buffer = new ArrayBuffer(44 + pcm.length * 2), view = new DataView(buffer);
  const label = (at, value) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
  label(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); label(8, 'WAVE'); label(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  label(36, 'data'); view.setUint32(40, pcm.length * 2, true);
  let peak = 0, sum = 0;
  for (const v of pcm) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  if (peak < 0.001) throw new Error('voice-empty-audio');
  const gain = Math.min(0.65 / peak, 0.08 / Math.max(0.001, Math.sqrt(sum / pcm.length)));
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + 2 * i, Math.max(-1, Math.min(1, pcm[i] * gain)) * 32767, true);
  return buffer;
}
self.onmessage = ({ data }) => {
  if (data.type === 'cancel') { canceled.add(data.id); return; }
  queue = queue.then(async () => {
    if (canceled.delete(data.id)) return;
    try {
      await ready();
      if (canceled.delete(data.id)) return;
      if (data.type === 'prepare') { self.postMessage({ id: data.id, ready: true }); return; }
      if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 360) throw new Error('voice-invalid-text');
      const ids = speechIds(data.text);
      if (!ids?.length || ids.length > 1800) throw new Error('voice-invalid-phonemes');
      const feeds = {
        input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
        input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
        scales: new ort.Tensor('float32', Float32Array.from([0.60, 1.18, 0.70]), [3]),
      };
      const output = await session.run(feeds);
      if (canceled.delete(data.id)) return;
      const audio = wav(output.output.data, config.audio.sample_rate);
      self.postMessage({ id: data.id, audio }, [audio]);
    } catch { self.postMessage({ id: data.id, error: 'local-voice-unavailable' }); }
  });
};
