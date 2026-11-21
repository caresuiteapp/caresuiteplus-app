import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { normalizeNeoVercelPermissions } from '../../../scripts/prepare-neo-vercel.mjs';
import type { Worker } from 'node:worker_threads';
import { describe, expect, it, vi } from 'vitest';
import { NeoWasmClient, decodeNeoVercelSamples, createNeoVercelEngine, runNeoInferenceWithFallback } from '../../../api/_lib/neo-vercel-engine.mjs';
import { encodeNeoWav } from '@/ai/neo/neoAudio';
class FakeWorker extends EventEmitter {
  stdout = new EventEmitter(); stderr = new EventEmitter(); messages: any[] = []; terminated = false;
  postMessage(message: any) { this.messages.push(message); if (message.operation === 'abort') queueMicrotask(() => this.emit('message', { kind: 'closed', id: message.id, terminatedChildren: 3 })); }
  terminate = vi.fn(async () => { this.terminated = true; this.emit('exit', 1); return 1; });
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function fixture(timeoutMs = 5000) {
  const worker = new FakeWorker(); let options: any;
  const client = new NeoWasmClient({ source: '/verified/whisper-main.js', model: '/verified/ggml-base-q5_1.bin' }, { timeoutMs, createWorker(_url, init) { options = init; return worker as unknown as Worker; } });
  const ready = async () => { const promise = client.prepare(); await tick(); const message = worker.messages.at(-1); worker.emit('message', { kind: 'ready', id: message.id }); await promise; };
  return { worker, client, ready, options: () => options };
}
describe('NEO owned WASM engine lifecycle', () => {
  it('waits for a worker result instead of treating message dispatch as completion and retains the warm model', async () => {
    const f = fixture(); await f.ready(); let completed = false;
    const promise = f.client.transcribe(new Float32Array(1600), new AbortController().signal).then(result => { completed = true; return result; }); await tick();
    expect(completed).toBe(false); expect(f.worker.messages.filter(m => m.operation === 'prepare')).toHaveLength(1);
    f.worker.emit('message', { kind: 'result', id: 'unrelated', text: 'Must not resolve another job', engine: 'whisper.cpp-vercel' }); await tick(); expect(completed).toBe(false);
    f.worker.emit('message', { kind: 'result', id: f.worker.messages.at(-1).id, text: 'Ich habe keine Schmerzen.', engine: 'whisper.cpp-vercel' }); expect((await promise).text).toBe('Ich habe keine Schmerzen.');
    expect(f.options()).toMatchObject({ stdout: true, stderr: true }); expect(f.worker.stdout.listenerCount('data')).toBe(0); expect(f.worker.stderr.listenerCount('data')).toBe(0);
    await f.client.close(); expect(f.worker.terminated).toBe(true);
  });
  it('rejects overlapping jobs in the same model runtime', async () => {
    const f = fixture(); const first = f.client.prepare(); await expect(f.client.prepare()).rejects.toThrow('busy');
    const rejection = expect(first).rejects.toThrow('wasm-worker-closed'); await f.client.close(); await rejection;
  });
  it('terminates the owner and its acknowledged pthreads on abort before rejecting the job', async () => {
    const f = fixture(); await f.ready(); const controller = new AbortController();
    const result = f.client.transcribe(new Float32Array(1600), controller.signal); await tick(); const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await rejected; expect(f.worker.terminated).toBe(true); expect(f.worker.messages.at(-1).operation).toBe('abort');
  });
  it('does not create a worker for a request already cancelled', async () => {
    const f = fixture(), controller = new AbortController(); controller.abort(); await expect(f.client.transcribe(new Float32Array(1600), controller.signal)).rejects.toMatchObject({ name: 'AbortError' }); expect(f.worker.messages).toHaveLength(0);
  });
  it('closes a worker after deadline and rejects rather than returning a partial transcript', async () => {
    const f = fixture(15); const result = f.client.prepare(); await expect(result).rejects.toThrow('wasm-deadline-exceeded'); expect(f.worker.terminated).toBe(true);
  });
  it('does not accept arbitrary or oversized worker responses', async () => {
    const f = fixture(); await f.ready(); const result = f.client.transcribe(new Float32Array(1600), new AbortController().signal); await tick();
    const rejected = expect(result).rejects.toThrow('invalid-transcript'); f.worker.emit('message', { kind: 'result', id: f.worker.messages.at(-1).id, text: 'untrusted', engine: 'external-provider' }); await rejected; expect(f.worker.terminated).toBe(true);
  });
  it('rejects worker failures without including raw errors or conversation content', async () => {
    const f = fixture(); const result = f.client.prepare(); const rejected = expect(result).rejects.toThrow('wasm-unavailable'); f.worker.emit('error', Error('PRIVATE TRANSCRIPT')); await rejected;
  });
  it('decodes bounded genuine 16-bit mono WAV and rejects a corrupted header', () => {
    const bytes = Buffer.from(encodeNeoWav(new Float32Array(1600).fill(.25), 16000)); const samples = decodeNeoVercelSamples(bytes); expect(samples).toHaveLength(1600); expect(samples[0]).toBeCloseTo(.25, 3);
    bytes.writeUInt32LE(1, 4); expect(() => decodeNeoVercelSamples(bytes)).toThrow('invalid-audio');
  });
  it('fails closed without prepared assets while allowing explicit test/maintenance disable', async () => {
    const engine = createNeoVercelEngine({ assetDirectory: '/missing-neo-assets', enabled: false }); expect(await engine.status()).toMatchObject({ transcriptionReady: false, backend: 'unavailable' }); await engine.dispose();
  });
});


describe('NEO bounded same-request native recovery', () => {
  it('recovers a failed native startup with the verified portable path using the same deadline signal', async () => {
    const calls: AbortSignal[] = [], failed = vi.fn();
    const native = vi.fn(async (signal: AbortSignal): Promise<string> => { calls.push(signal); throw Error('ABI startup failed'); });
    const wasm = vi.fn(async (signal: AbortSignal) => { calls.push(signal); return 'Ich habe keine Schmerzen.'; });
    expect(await runNeoInferenceWithFallback({ native, wasm, signal: new AbortController().signal, onNativeFailure: failed })).toBe('Ich habe keine Schmerzen.');
    expect(failed).toHaveBeenCalledOnce(); expect(wasm).toHaveBeenCalledOnce(); expect(calls[0]).toBe(calls[1]);
  });
  it('does not retry or downgrade a healthy native engine after user cancellation', async () => {
    const controller = new AbortController(), wasm = vi.fn(async () => 'must not run'), failed = vi.fn();
    const native = async () => { controller.abort(); throw new DOMException('Aborted', 'AbortError'); };
    await expect(runNeoInferenceWithFallback({ native, wasm, signal: controller.signal, onNativeFailure: failed })).rejects.toMatchObject({ name: 'AbortError' });
    expect(wasm).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled();
  });
  it('does not launch another long job when too little of the shared budget remains', async () => {
    const wasm = vi.fn(async () => 'must not run'), failed = vi.fn(); let instant = 0;
    const native = async (): Promise<string> => { instant = 80; throw Error('native deadline'); };
    await expect(runNeoInferenceWithFallback({ native, wasm, signal: new AbortController().signal, budgetMs: 100, minimumFallbackMs: 25, now: () => instant, onNativeFailure: failed })).rejects.toThrow('native deadline');
    expect(wasm).not.toHaveBeenCalled(); expect(failed).toHaveBeenCalledOnce();
  });
  it('keeps the native result when it succeeds', async () => {
    const wasm = vi.fn(async () => 'unused'); expect(await runNeoInferenceWithFallback({ native: async () => 'native result', wasm, signal: new AbortController().signal })).toBe('native result'); expect(wasm).not.toHaveBeenCalled();
  });
  it('makes public bundled files readable by the Lambda user without changing temporary audio permissions', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'neo-asset-modes-'));
    const names = ['ggml-base-q5_1.bin', 'whisper-main.js', 'manifest.json', 'whisper-cli', 'native-build.json'];
    try {
      for (const name of names) await writeFile(path.join(directory, name), 'public fixture', { mode: 0o600 });
      await normalizeNeoVercelPermissions(directory, true);
      if (process.platform !== 'win32') {
        expect((await stat(directory)).mode & 0o777).toBe(0o755);
        for (const name of names) expect((await stat(path.join(directory, name))).mode & 0o777).toBe(name === 'whisper-cli' ? 0o755 : 0o644);
      }
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
