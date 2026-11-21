import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Worker } from 'node:worker_threads';
const executeFile = promisify(execFile);
const READINESS_FIXTURE_SHA = '07834b6a84e35a9e8f6c803a24fbc2b4c5b0834fe8a6438024d40b4ba769fb66';
export const NEO_VERCEL_MODELS = Object.freeze({
  'ggml-base-q5_1.bin': { size: 59707625, sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898' },
  'ggml-small-q5_1.bin': { size: 190085487, sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb' },
});
export const NEO_VERCEL_WASM = Object.freeze({ file: 'whisper-main.js', size: 1770371, sha256: '9ef5bf71b5010dc28fe52dee39bcf10029af58f3e0f1fea2b0987efdacea276a' });

/** Same bounded 16 kHz mono PCM contract as NEO's local worker. */
export function validateNeoVercelWav(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 44 || bytes.length > 500000 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw Error('invalid-audio');
  let format, data, offset = 12;
  for (; offset + 8 <= bytes.length;) {
    const type = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > bytes.length) throw Error('invalid-audio');
    if (type === 'fmt ') { if (format || length < 16) throw Error('invalid-audio'); format = bytes.subarray(start, start + length); }
    if (type === 'data') { if (data) throw Error('invalid-audio'); data = bytes.subarray(start, start + length); }
    offset = start + length + length % 2;
  }
  if (offset !== bytes.length || !format || !data || format.readUInt16LE(0) !== 1 || format.readUInt16LE(2) !== 1 || format.readUInt32LE(4) !== 16000 || format.readUInt32LE(8) !== 32000 || format.readUInt16LE(12) !== 2 || format.readUInt16LE(14) !== 16 || data.length % 2 || data.length < 1600 || data.length > 384000) throw Error('invalid-audio');
  let sum = 0; for (let i = 0; i < data.length; i += 2) sum += (data.readInt16LE(i) / 32768) ** 2;
  return { seconds: data.length / 32000, rms: Math.sqrt(sum / (data.length / 2)) };
}
export function decodeNeoVercelSamples(bytes) {
  validateNeoVercelWav(bytes);
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (bytes.toString('ascii', offset, offset + 4) === 'data') { const samples = new Float32Array(length / 2); for (let i = 0; i < samples.length; i++) samples[i] = bytes.readInt16LE(start + 2 * i) / 32768; return samples; }
    offset = start + length + length % 2;
  }
  throw Error('invalid-audio');
}
async function digest(file) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }

/** Owns one model runtime and all jobs. Abort tears down the owner and its pthreads. */
export class NeoWasmClient {
  constructor(configuration, options = {}) { this.configuration = configuration; this.createWorker = options.createWorker ?? ((url, init) => new Worker(url, init)); this.timeoutMs = options.timeoutMs ?? 85000; this.worker = null; this.pending = new Map(); this.sequence = 0; this.prepared = false; this.closing = null; this.closedAck = null; }
  ensureWorker() {
    if (this.worker) return;
    const worker = this.createWorker(new URL('./neo-wasm-worker.cjs', import.meta.url), { workerData: this.configuration, stdout: true, stderr: true }); this.worker = worker;
    // Defense in depth: even an upstream runtime error must not print audio/text.
    // Piped but deliberately not forwarded/drained: a pending stdio read would
    // keep the owner alive after unref. Normal transcripts use private IPC.
    worker.unref?.();
    worker.on('message', message => {
      if (!message || typeof message.id !== 'string') return;
      if (message.kind === 'closed') { this.closedAck?.(message); return; }
      const pending = this.pending.get(message.id); if (!pending) return;
      if (message.kind === 'ready') { this.prepared = true; this.settle(message.id, null, undefined); }
      else if (message.kind === 'result') {
        if (typeof message.text !== 'string' || message.text.length > 6000 || message.engine !== 'whisper.cpp-vercel') void this.close(Error('invalid-transcript'));
        else this.settle(message.id, null, { text: message.text, engine: message.engine });
      } else if (message.kind === 'error') { const code = ['busy', 'invalid-audio', 'invalid-transcript', 'wasm-deadline-exceeded'].includes(message.code) ? message.code : 'wasm-unavailable'; void this.close(Error(code)); }
    });
    worker.on('error', () => { void this.close(Error('wasm-unavailable')); });
    worker.on('exit', () => { if (this.worker === worker) { this.worker = null; this.prepared = false; if (!this.closing) for (const id of [...this.pending.keys()]) this.settle(id, Error('wasm-unavailable')); } });
  }
  settle(id, error, value) { const pending = this.pending.get(id); if (!pending) return; this.pending.delete(id); if (!this.pending.size) this.worker?.unref?.(); clearTimeout(pending.timer); pending.signal?.removeEventListener('abort', pending.abort); error ? pending.reject(error) : pending.resolve(value); }
  request(operation, signal, samples) {
    if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    if (this.closing || this.pending.size) return Promise.reject(Error('busy'));
    this.ensureWorker(); this.worker.ref?.(); const id = String(++this.sequence);
    return new Promise((resolve, reject) => {
      const abort = () => { void this.close(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { void this.close(Error('wasm-deadline-exceeded')); }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, signal, abort, timer }); signal?.addEventListener('abort', abort, { once: true });
      try { this.worker.postMessage({ operation, id, ...(samples ? { samples } : {}) }, samples ? [samples.buffer] : []); }
      catch { void this.close(Error('wasm-unavailable')); }
    });
  }
  async prepare(signal) { if (!this.prepared) await this.request('prepare', signal); }
  async transcribe(samples, signal) { await this.prepare(signal); signal.throwIfAborted(); return this.request('transcribe', signal, samples); }
  async close(reason = Error('wasm-worker-closed')) {
    if (this.closing) return this.closing;
    const worker = this.worker; this.prepared = false;
    this.closing = (async () => {
      let result = { terminatedChildren: 0 };
      if (worker) {
        const acknowledgement = new Promise(resolve => { this.closedAck = resolve; }); let closeTimer;
        try { worker.postMessage({ operation: 'abort', id: 'close-' + ++this.sequence }); result = await Promise.race([acknowledgement, new Promise(resolve => { closeTimer = setTimeout(() => resolve(result), 300); })]); } catch {} finally { clearTimeout(closeTimer); }
        await worker.terminate().catch(() => {});
      }
      this.worker = null; this.closedAck = null;
      for (const id of [...this.pending.keys()]) this.settle(id, reason);
      return result;
    })();
    try { return await this.closing; } finally { this.closing = null; }
  }
}

/** Same-request recovery is safe for read-only inference, within one shared deadline. */
export async function runNeoInferenceWithFallback({ native, wasm, signal, onNativeFailure = () => {}, budgetMs = 90000, minimumFallbackMs = 25000, now = () => performance.now() }) {
  signal.throwIfAborted(); const started = now(), bounded = AbortSignal.any([signal, AbortSignal.timeout(budgetMs)]);
  if (native) {
    try { const result = await native(bounded); bounded.throwIfAborted(); return result; }
    catch (error) {
      if (signal.aborted) throw error;
      onNativeFailure();
      if (bounded.aborted || budgetMs - (now() - started) < minimumFallbackMs) throw error;
    }
  }
  bounded.throwIfAborted(); const result = await wasm(bounded); bounded.throwIfAborted(); return result;
}

export function createNeoVercelEngine(options = {}) {
  const directory = options.assetDirectory ?? resolve('api/_lib/neo-assets'), run = options.execute ?? executeFile;
  const enabled = options.enabled !== false;
  let active = 0, verified = null, wasm = null, nativeFailed = false;
  async function artifacts() {
    if (!enabled) return null;
    try {
      const manifestPath = join(directory, 'manifest.json'), manifestStat = await lstat(manifestPath);
      if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 16384) return null;
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      if (manifest.version !== 'neo-asr-v2') return null;
      if (!options.allowUnvalidatedArtifacts && (manifest.selfTest?.passed !== true || manifest.selfTest.fixtureSha256 !== READINESS_FIXTURE_SHA || manifest.selfTest.modelSha256 !== manifest.model?.sha256 || manifest.selfTest.wasmSha256 !== manifest.wasm?.sha256 || (manifest.selfTest.nativeSha256 ?? null) !== (manifest.native?.sha256 ?? null))) return null;
      const modelDefinition = NEO_VERCEL_MODELS[manifest.model?.file];
      if (!modelDefinition || manifest.model.size !== modelDefinition.size || manifest.model.sha256 !== modelDefinition.sha256) return null;
      const model = join(directory, manifest.model.file), modelStat = await lstat(model);
      if (!modelStat.isFile() || modelStat.isSymbolicLink() || modelStat.size !== modelDefinition.size) return null;
      const native = manifest.native, wasmDefinition = manifest.wasm;
      const stamps = [manifestStat.mtimeMs, manifestStat.size, modelStat.mtimeMs, modelStat.size];
      let nativeFile, wasmFile;
      if (native?.file === 'whisper-cli' && native.version === 'whisper.cpp-v1.8.4' && /^[a-f0-9]{64}$/.test(native.sha256) && Number.isInteger(native.size) && native.size >= 64 && native.size <= 40000000 && process.platform === 'linux' && process.arch === 'x64' && !nativeFailed && !options.forceWasm) {
        const file = join(directory, 'whisper-cli'); const stat = await lstat(file).catch(() => null);
        if (stat?.isFile() && !stat.isSymbolicLink() && stat.size === native.size && stat.mode & 0o111) { nativeFile = file; stamps.push(stat.mtimeMs, stat.size); }
      }
      if (wasmDefinition?.file === NEO_VERCEL_WASM.file && wasmDefinition.size === NEO_VERCEL_WASM.size && wasmDefinition.sha256 === NEO_VERCEL_WASM.sha256 && typeof SharedArrayBuffer !== 'undefined') {
        const file = join(directory, NEO_VERCEL_WASM.file), stat = await lstat(file).catch(() => null);
        if (stat?.isFile() && !stat.isSymbolicLink() && stat.size === NEO_VERCEL_WASM.size) { wasmFile = file; stamps.push(stat.mtimeMs, stat.size); }
      }
      const key = stamps.join(':') + ':' + nativeFailed; if (verified?.key === key) return verified;
      if (await digest(model) !== modelDefinition.sha256) return null;
      if (nativeFile) {
        const flags = await readFile('/proc/cpuinfo', 'utf8').catch(() => '');
        if (!['avx2', 'fma', 'f16c'].every(flag => new RegExp('(?:^|\\s)' + flag + '(?:\\s|$)').test(flags)) || await digest(nativeFile) !== native.sha256) nativeFile = null;
        else {
          const header = (await readFile(nativeFile)).subarray(0, 20);
          if (header[0] !== 0x7f || header.toString('ascii', 1, 4) !== 'ELF' || header[4] !== 2 || header[5] !== 1 || header.readUInt16LE(18) !== 62) nativeFile = null;
          else try { await run(nativeFile, ['--help'], { timeout: 3000, maxBuffer: 65536, windowsHide: true }); } catch { nativeFile = null; }
        }
      }
      if (wasmFile && await digest(wasmFile) !== NEO_VERCEL_WASM.sha256) wasmFile = null;
      if (!nativeFile && !wasmFile) return null;
      verified = { key, binary: nativeFile, source: wasmFile, model, backend: nativeFile ? 'native' : 'wasm' }; return verified;
    } catch { return null; }
  }
  return {
    async status() { const paths = await artifacts(); return { transcriptionReady: Boolean(paths), backend: paths?.backend ?? 'unavailable' }; },
    async transcribe(encoded, signal) {
      if (typeof encoded !== 'string' || encoded.length > 666668 || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw Error('invalid-audio');
      const bytes = Buffer.from(encoded, 'base64'); if (bytes.toString('base64') !== encoded) throw Error('invalid-audio');
      const audio = validateNeoVercelWav(bytes); signal.throwIfAborted();
      if (active >= 1) throw Error('busy'); active++;
      let temporary;
      try {
        const paths = await artifacts(); if (!paths) throw Error('transcription-not-configured'); signal.throwIfAborted();
        if (audio.rms < 0.003) return { text: '', engine: 'whisper.cpp-vercel' };
        const portable = async bounded => {
          const fallback = paths.binary ? await artifacts() : paths;
          if (!fallback?.source) throw Error('transcription-not-configured');
          wasm ??= new NeoWasmClient({ source: fallback.source, model: fallback.model }, options.wasmOptions);
          try { return await wasm.transcribe(decodeNeoVercelSamples(bytes), bounded); }
          catch (error) { await wasm.close(error).catch(() => {}); wasm = null; throw error; }
        };
        const native = paths.binary ? async bounded => {
          temporary = await mkdtemp(join(tmpdir(), 'caresuite-neo-vercel-')); await chmod(temporary, 0o700);
          try {
            const input = join(temporary, 'input.wav'), output = join(temporary, 'result'); await writeFile(input, bytes, { mode: 0o600 });
            await run(paths.binary, ['-m', paths.model, '-f', input, '-l', 'de', '-oj', '-of', output, '-nt', '-np', '-t', '2', '-bs', '1'], { signal: bounded, timeout: 85000, maxBuffer: 1024 * 1024, windowsHide: true });
            bounded.throwIfAborted(); const result = JSON.parse(await readFile(output + '.json', 'utf8'));
            if (!Array.isArray(result.transcription) || result.transcription.length > 200) throw Error('invalid-transcript');
            const text = result.transcription.map(item => { if (typeof item.text !== 'string') throw Error('invalid-transcript'); return item.text; }).join(' ').replace(/\s+/g, ' ').trim();
            if (text.length > 6000) throw Error('invalid-transcript');
            return { text: /^\s*(?:\[[^\]]*\]|\([^)]*\))\s*$/.test(text) ? '' : text, engine: 'whisper.cpp-vercel' };
          } finally { if (temporary) { await rm(temporary, { recursive: true, force: true }); temporary = null; } }
        } : undefined;
        return await runNeoInferenceWithFallback({ native, wasm: portable, signal, onNativeFailure: () => { nativeFailed = true; verified = null; }, minimumFallbackMs: basename(paths.model) === 'ggml-small-q5_1.bin' ? 65000 : 25000 });
      } finally { active--; if (temporary) await rm(temporary, { recursive: true, force: true }); }
    },
    async dispose() { if (wasm) await wasm.close(); wasm = null; },
  };
}
