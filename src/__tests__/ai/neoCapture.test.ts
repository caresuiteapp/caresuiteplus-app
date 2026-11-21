// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNeoCapture } from '@/ai/neo/neoCapture.web';
let node: any, context: any;
const track = { stop: vi.fn(), onended: null as null | (() => void) }, stream = { getTracks: () => [track], getAudioTracks: () => [track] };
const getUserMedia = vi.fn();
const callbacks = () => ({ onText: vi.fn(), onStatus: vi.fn(), onError: vi.fn(), transcribe: vi.fn().mockResolvedValue('Ich nutze einen Rollator.') });
const captures: ReturnType<typeof createNeoCapture>[] = [];
const capture = (cb = callbacks(), source: 'own' | 'device' = 'own') => { const c = createNeoCapture(source, cb); captures.push(c); return { c, cb }; };
beforeEach(() => {
  vi.clearAllMocks(); Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true }); getUserMedia.mockResolvedValue(stream);
  vi.stubGlobal('AudioContext', class { sampleRate = 48000; destination = {}; audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) }; close = vi.fn().mockResolvedValue(undefined); resume = vi.fn().mockResolvedValue(undefined); constructor() { context = this; } createGain() { return { gain: { value: 1 }, connect: () => ({}) }; } createMediaStreamSource() { return { connect() {} }; } });
  vi.stubGlobal('AudioWorkletNode', class { port = { onmessage: null as any, postMessage: vi.fn((kind: string) => { if (kind === 'flush') this.port.onmessage?.({ data: { flushed: true } }); }) }; disconnect = vi.fn(); constructor() { node = this; } connect(target: any) { return target; } });
});
afterEach(() => { captures.splice(0).forEach(c => c.cancel()); vi.unstubAllGlobals(); });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
describe('NEO web capture ownership and finalization', () => {
  it('releases a microphone permission granted after cancellation', async () => {
    let grant!: (s: any) => void; getUserMedia.mockImplementation(() => new Promise(resolve => { grant = resolve; })); const { c, cb } = capture(); const start = c.start(); c.cancel(); grant(stream); await start;
    expect(track.stop).toHaveBeenCalled(); expect(cb.onText).not.toHaveBeenCalled();
  });
  it('flushes voiced PCM on stop, retains exact output and stops all microphone tracks', async () => {
    const { c, cb } = capture(); await c.start(); node.port.onmessage({ data: new Float32Array(12000).fill(.1) }); await c.stop();
    expect(cb.transcribe).toHaveBeenCalledTimes(1); expect(cb.onText).toHaveBeenCalledWith('Ich nutze einen Rollator.', expect.any(Number), expect.any(Number)); expect(track.stop).toHaveBeenCalled(); expect(context.close).toHaveBeenCalled();
  });
  it('aborts in-flight inference and rejects stale late text', async () => {
    const cb = callbacks(); let finish!: (text: string) => void; cb.transcribe.mockImplementation(() => new Promise(resolve => { finish = resolve; })); const { c } = capture(cb); await c.start();
    node.port.onmessage({ data: new Float32Array(12000).fill(.1) }); for (let i = 0; i < 3; i++) node.port.onmessage({ data: new Float32Array(12000) }); await tick();
    const signal = cb.transcribe.mock.calls[0][1] as AbortSignal; c.cancel(); expect(signal.aborted).toBe(true); finish('Alter Wortlaut'); await tick(); expect(cb.onText).not.toHaveBeenCalled();
  });
  it('stops a previous NEO microphone lease before a new capture starts', async () => {
    const first = capture(), second = capture(); await first.c.start(); await second.c.start(); expect(first.cb.onError).toHaveBeenCalledWith(expect.stringContaining('neue NEO-Aufnahme')); expect(track.stop).toHaveBeenCalled();
  });
  it('waits for the final device result when stopping instead of discarding it', async () => {
    class Recognition { processLocally = false; onresult: any; onend: any; start() {} abort() {} stop() { this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'Vollständiger letzter Satz' }], { isFinal: true })] }); this.onend(); } }
    (window as any).SpeechRecognition = Recognition;
    try { const { c, cb } = capture(callbacks(), 'device'); await c.start(); await c.stop(); expect(cb.onText).toHaveBeenCalledWith('Vollständiger letzter Satz', expect.any(Number), expect.any(Number)); }
    finally { delete (window as any).SpeechRecognition; }
  });
});
