import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNeoCapture } from '@/ai/neo/neoCapture.native';
const api = vi.hoisted(() => ({ listeners: new Map<string, Set<(event: any) => void>>(), start: vi.fn(), stop: vi.fn(), abort: vi.fn(), delete: vi.fn(), bytes: vi.fn(), permission: vi.fn() }));
vi.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: {
  isRecognitionAvailable: () => true, supportsOnDeviceRecognition: () => true, requestPermissionsAsync: api.permission, start: api.start, stop: api.stop, abort: api.abort,
  addListener: (name: string, fn: (event: any) => void) => { const items = api.listeners.get(name) ?? new Set(); items.add(fn); api.listeners.set(name, items); return { remove() { items.delete(fn); } }; },
} }));
vi.mock('expo-file-system', () => ({ File: class { uri: string; exists = true; constructor(uri: string) { this.uri = uri; } bytes() { return api.bytes(); } delete() { api.delete(this.uri); } } }));
const emit = (event: string, data?: unknown) => [...(api.listeners.get(event) ?? [])].forEach(fn => fn(data));
const captures: ReturnType<typeof createNeoCapture>[] = [];
const create = (source: 'own' | 'device' = 'own') => { const callbacks = { onText: vi.fn(), onStatus: vi.fn(), onError: vi.fn(), transcribe: vi.fn().mockResolvedValue('Geprüfter Wortlaut') }, c = createNeoCapture(source, callbacks); captures.push(c); return { c, callbacks }; };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); api.listeners.clear(); api.permission.mockResolvedValue({ granted: true }); api.bytes.mockResolvedValue(new Uint8Array(200)); });
afterEach(() => { captures.splice(0).forEach(c => c.cancel()); vi.clearAllTimers(); vi.useRealTimers(); });
describe('native NEO recording lifecycle', () => {
  it('requires on-device capture and deletes only its own recorded file after processing', async () => {
    const { c, callbacks } = create(); await c.start(); expect(api.start).toHaveBeenCalledWith(expect.objectContaining({ requiresOnDeviceRecognition: true, recordingOptions: expect.objectContaining({ persist: true, outputSampleRate: 16000 }) }));
    emit('audiostart', { uri: 'file:///own.wav' }); api.stop.mockImplementation(() => { emit('audioend', { uri: 'file:///own.wav' }); emit('end'); }); await c.stop();
    expect(callbacks.onText).toHaveBeenCalledWith('Geprüfter Wortlaut', expect.any(Number), expect.any(Number)); expect(api.delete).toHaveBeenCalledWith('file:///own.wav'); expect([...api.listeners.values()].every(set => !set.size)).toBe(true);
  });
  it('removes subscriptions on cancellation and never deletes a later recording belonging to another session', async () => {
    const first = create(); await first.c.start(); emit('audiostart', { uri: 'file:///old.wav' }); first.c.cancel();
    const second = create(); await second.c.start(); emit('audiostart', { uri: 'file:///new.wav' }); emit('audioend', { uri: 'file:///new.wav' }); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(first.callbacks.onText).not.toHaveBeenCalled(); expect(api.delete.mock.calls.filter(args => args[0] === 'file:///new.wav')).toHaveLength(1);
  });
  it('does not start recording after permission resolves for a cancelled session', async () => {
    let grant!: (value: unknown) => void; api.permission.mockImplementation(() => new Promise(resolve => { grant = resolve; })); const { c } = create(); const promise = c.start(); c.cancel(); grant({ granted: true }); await promise; expect(api.start).not.toHaveBeenCalled();
  });
});
