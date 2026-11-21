// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://www.caresuiteplus.app/Desktop"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountRobotAssistant, type RobotDependencies } from '@/ai/robot/robotAssistantDom';
import { claimNeoMicrophone } from '@/ai/neo/neoMicrophone';
const recording = vi.hoisted(() => ({ instances: [] as any[], factory: vi.fn() }));
vi.mock('@/ai/neo/neoCapture.web', () => ({ createNeoCapture: (source: unknown, callbacks: any, options: unknown) => {
  const engine = { start: vi.fn(async () => callbacks.onStatus('listening')), cancel: vi.fn(), stop: vi.fn(), callbacks };
  recording.instances.push(engine); recording.factory(source, options); return engine;
} }));
class LocalUnavailable {
  static instances: LocalUnavailable[] = [];
  static startError: Error | undefined;
  processLocally = false; lang = ''; continuous = false; interimResults = false;
  onstart: any; onend: any; onerror: any; onresult: any;
  static available = vi.fn().mockResolvedValue('unavailable');
  constructor() { LocalUnavailable.instances.push(this); }
  start = vi.fn(() => { if (LocalUnavailable.startError) throw LocalUnavailable.startError; }); abort = vi.fn();
}
class Audio {
  static sources: any[] = []; state = 'running'; destination = {};
  resume = vi.fn().mockResolvedValue(undefined); close = vi.fn().mockResolvedValue(undefined);
  decodeAudioData = vi.fn().mockResolvedValue({ duration: 1 });
  createBufferSource() { const source = { onended: null, start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), buffer: null }; Audio.sources.push(source); return source; }
}
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const button = () => document.querySelector<HTMLButtonElement>('.cs-robot-button')!;
const status = () => document.querySelector<HTMLElement>('.cs-neo-voice-status')!;
let dispose: (() => void) | undefined, deps: RobotDependencies;
beforeEach(() => {
  vi.useFakeTimers(); recording.instances = []; recording.factory.mockReset(); Audio.sources = [];
  LocalUnavailable.instances = []; LocalUnavailable.startError = undefined; LocalUnavailable.available.mockReset().mockResolvedValue('unavailable');
  vi.stubGlobal('SpeechRecognition', LocalUnavailable); vi.stubGlobal('AudioContext', Audio);
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  deps = { robotUrl: '/robot.png', navigate: vi.fn(), back: vi.fn(), canNavigate: () => true, canSearchClients: () => true,
    searchClients: vi.fn().mockResolvedValue([]), loadVoice: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    ownVoice: { check: vi.fn().mockResolvedValue(true), transcribe: vi.fn().mockResolvedValue('NEO, wie spät ist es?') } };
});
afterEach(() => { dispose?.(); dispose = undefined; vi.unstubAllGlobals(); vi.clearAllTimers(); vi.useRealTimers(); document.body.innerHTML = ''; });
describe('NEO own desktop recognition', () => {
  it('uses the own recorder when German local browser speech is unavailable', async () => {
    dispose = mountRobotAssistant(deps); button().click(); await flush();
    expect(deps.ownVoice!.check).toHaveBeenCalledOnce(); expect(recording.factory).toHaveBeenCalledWith('own', { manageMicrophone: false });
    expect(status().textContent).toContain('Eigene CareSuite-Spracherkennung'); expect(recording.instances[0].start).toHaveBeenCalledOnce();
    await recording.instances[0].callbacks.transcribe(new Uint8Array(120), new AbortController().signal); expect(deps.ownVoice!.transcribe).toHaveBeenCalledOnce();
  });
  it('recovers through its own service when the local engine throws on start despite reporting available', async () => {
    LocalUnavailable.available.mockResolvedValue('available'); LocalUnavailable.startError = new DOMException('Local engine cannot start', 'NotSupportedError');
    dispose = mountRobotAssistant(deps); button().click(); await flush();
    expect(LocalUnavailable.instances[0].start).toHaveBeenCalledOnce(); expect(LocalUnavailable.instances[0].abort).toHaveBeenCalled();
    expect(recording.instances[0].start).toHaveBeenCalledOnce(); expect(status().textContent).toContain('Eigene CareSuite-Spracherkennung');
    expect(button().getAttribute('aria-pressed')).toBe('true');
  });
  it('retains background silence and routes only an addressed utterance into a response', async () => {
    dispose = mountRobotAssistant(deps); button().click(); await flush(); const engine = recording.instances[0];
    engine.callbacks.onText('Wir besprechen den Kalender.', 0, 1); await flush(); expect(deps.loadVoice).not.toHaveBeenCalled(); expect(engine.cancel).not.toHaveBeenCalled();
    engine.callbacks.onText('NEO, wie spät ist es?', 1, 2); await flush(); expect(deps.loadVoice).toHaveBeenCalled(); expect(engine.cancel).toHaveBeenCalled();
    expect(vi.mocked(deps.loadVoice).mock.calls.map(call => call[2]).join(' ')).toContain('Uhr');
  });
  it('resumes its own recorder after speaking and ignores callbacks from the previous recorder', async () => {
    dispose = mountRobotAssistant(deps); button().click(); await flush(); const previous = recording.instances[0];
    previous.callbacks.onText('NEO, wie spät ist es?', 0, 1); await flush();
    expect(previous.cancel).toHaveBeenCalled(); expect(recording.instances).toHaveLength(1);
    for (const source of Audio.sources) { source.onended?.(); await flush(); }
    await vi.advanceTimersByTimeAsync(120); await flush();
    expect(recording.instances).toHaveLength(2); expect(recording.instances[1].start).toHaveBeenCalledOnce();
    expect(deps.ownVoice!.check).toHaveBeenCalledOnce(); expect(button().getAttribute('aria-pressed')).toBe('true');
    const replies = vi.mocked(deps.loadVoice).mock.calls.length;
    previous.callbacks.onText('NEO, hallo', 0, 1); previous.callbacks.onError('Alte Aufnahme'); await flush();
    expect(deps.loadVoice).toHaveBeenCalledTimes(replies); expect(recording.instances[1].cancel).not.toHaveBeenCalled();
    expect(button().getAttribute('aria-pressed')).toBe('true');
  });
  it('keeps microphone ownership during own speech and cancels when another workspace claims it', async () => {
    dispose = mountRobotAssistant(deps); button().click(); await flush(); const engine = recording.instances[0];
    engine.callbacks.onText('NEO, wie spät ist es?', 0, 1); await flush(); const audio = Audio.sources.at(-1)!;
    const release = claimNeoMicrophone(() => {}); await flush();
    expect(audio.stop).toHaveBeenCalled(); expect(button().getAttribute('aria-pressed')).toBe('false'); release();
  });
  it('drops a pending own-service readiness reply after explicit cancellation', async () => {
    let finish!: (value: boolean) => void; deps.ownVoice!.check = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    dispose = mountRobotAssistant(deps); button().click(); await flush(); button().click(); finish(true); await flush();
    expect(recording.instances).toHaveLength(0); expect(button().getAttribute('aria-pressed')).toBe('false');
  });
  it.each([
    ['unavailable browser package', false, 'false'], ['unavailable browser package', false, 'reject'],
    ['missing browser API', true, 'false'], ['missing browser API', true, 'reject'],
  ] as const)('keeps the new session after %s (missing API: %s) returns %s for an old check', async (_name, missing, outcome) => {
    if (missing) { vi.stubGlobal('SpeechRecognition', undefined); vi.stubGlobal('webkitSpeechRecognition', undefined); }
    let finish!: (value: boolean) => void, fail!: (reason: Error) => void;
    const pending = new Promise<boolean>((resolve, reject) => { finish = resolve; fail = reject; });
    deps.ownVoice!.check = vi.fn().mockImplementationOnce(() => pending).mockResolvedValue(true);
    dispose = mountRobotAssistant(deps); button().click(); await flush();
    button().click(); button().click(); await flush(); const current = recording.instances[0];
    expect(current.start).toHaveBeenCalledOnce();
    if (outcome === 'false') finish(false); else fail(new Error('Old request failed'));
    await flush(); expect(current.cancel).not.toHaveBeenCalled();
    expect(button().getAttribute('aria-pressed')).toBe('true'); expect(status().textContent).toContain('Eigene CareSuite-Spracherkennung');
  });
  it.each(['false', 'reject'] as const)('keeps a restarted local session when an old runtime fallback settles with %s', async outcome => {
    LocalUnavailable.available.mockResolvedValue('available');
    let finish!: (value: boolean) => void, fail!: (reason: Error) => void;
    deps.ownVoice!.check = vi.fn(() => new Promise<boolean>((resolve, reject) => { finish = resolve; fail = reject; }));
    dispose = mountRobotAssistant(deps); button().click(); await flush();
    LocalUnavailable.instances.at(-1)!.onerror({ error: 'language-not-supported' }); await flush();
    button().click(); button().click(); await flush(); const current = LocalUnavailable.instances.at(-1)!;
    expect(current.start).toHaveBeenCalledOnce();
    if (outcome === 'false') finish(false); else fail(new Error('Old runtime request failed'));
    await flush(); expect(current.abort).not.toHaveBeenCalled(); expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector<HTMLElement>('.cs-robot')!.dataset.state).toBe('listening');
  });
  it('does not claim an active recorder when the own service is not ready', async () => {
    deps.ownVoice!.check = vi.fn().mockResolvedValue(false); dispose = mountRobotAssistant(deps); button().click(); await flush();
    expect(recording.instances).toHaveLength(0); expect(button().getAttribute('aria-pressed')).toBe('false'); expect(status().textContent).toContain('local-language-unavailable');
  });
});
