// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://www.caresuiteplus.app/Desktop"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountRobotAssistant, splitNeoSpeech, type RobotDependencies } from '../../ai/robot/robotAssistantDom';

class FakeRecognition {
  static all: FakeRecognition[] = [];
  lang = ''; continuous = false; interimResults = false;
  onstart: (() => void) | null = null; onend: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null; onerror: ((event: any) => void) | null = null;
  aborted = false;
  constructor() { FakeRecognition.all.push(this); }
  start() { this.onstart?.(); }
  abort() { this.aborted = true; this.onend?.(); }
  say(text: string) { this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] }); }
  error(error: string) { this.onerror?.({ error }); }
}
class FakeAudio {
  static sources: { onended: (() => void) | null; disconnect: () => void; start: () => void; stop: () => void; buffer: any; connect: () => void }[] = [];
  state = 'running'; destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  decodeAudioData = vi.fn().mockResolvedValue({ duration: 1 });
  createBufferSource() {
    const source = { onended: null as (() => void) | null, disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null, connect: vi.fn() };
    FakeAudio.sources.push(source); return source;
  }
}
let cleanup: (() => void) | undefined, deps: RobotDependencies;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const tick = async (ms = 0) => { await vi.advanceTimersByTimeAsync(ms); await flush(); };
const lastRecognition = () => FakeRecognition.all.at(-1)!;
const host = () => document.querySelector<HTMLElement>('.cs-robot')!;
const status = () => document.querySelector<HTMLElement>('.cs-neo-voice-status')!;
const button = () => document.querySelector<HTMLButtonElement>('.cs-robot-button')!;
const spoken = () => vi.mocked(deps.loadVoice).mock.calls.map(call => call[2]).join(' ');
const completeAudio = async () => {
  for (let count = 0; count < 20; count++) { await flush(); const source = FakeAudio.sources.at(-1); if (!source?.onended) break; source.onended(); }
  await tick(350);
};
beforeEach(() => {
  vi.useFakeTimers(); FakeRecognition.all = []; FakeAudio.sources = [];
  vi.stubGlobal('SpeechRecognition', FakeRecognition); vi.stubGlobal('AudioContext', FakeAudio);
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  deps = { robotUrl: '/robot.png', canNavigate: () => true, canSearchClients: () => true, searchClients: vi.fn().mockResolvedValue([]), navigate: vi.fn(), back: vi.fn().mockReturnValue(false), loadVoice: vi.fn().mockResolvedValue(new ArrayBuffer(8)), prepareVoice: vi.fn() };
});
afterEach(() => { cleanup?.(); cleanup = undefined; vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
async function mount() {
  cleanup = mountRobotAssistant(deps); button().click(); await completeAudio();
  vi.mocked(deps.loadVoice).mockClear();
}

describe('Neo voice-only conversation', () => {
  it('speaks the bundled greeting on click without opening a chat or starting capture over its own voice', async () => {
    cleanup = mountRobotAssistant(deps);
    expect(deps.loadVoice).not.toHaveBeenCalled(); expect(FakeRecognition.all).toHaveLength(0);
    expect(status().hidden).toBe(true);
    button().click(); await flush();
    expect(spoken()).toBe('Ich bin Neo, dein kleiner Assistent in deinem CareSuite Health OS.');
    expect(FakeAudio.sources.at(-1)?.start).toHaveBeenCalledOnce(); expect(FakeRecognition.all).toHaveLength(0);
    expect(host().dataset.state).toBe('speaking');
    expect(document.querySelector('[role=dialog], [role=log], form, input, .cs-neo-panel')).toBeNull();
    expect(button().hasAttribute('aria-haspopup')).toBe(false);
    await completeAudio(); expect(lastRecognition().continuous).toBe(true); expect(lastRecognition().interimResults).toBe(true);
    expect(host().dataset.state).toBe('listening');
  });
  it('pauses recognition while speaking and resumes for another spoken answer', async () => {
    await mount(); lastRecognition().say('Hallo Neo'); await tick(1100);
    expect(FakeRecognition.all).toHaveLength(1); expect(lastRecognition().aborted).toBe(true);
    expect(host().dataset.state).toBe('speaking');
    await completeAudio(); expect(FakeRecognition.all).toHaveLength(2); expect(host().dataset.state).toBe('listening');
    lastRecognition().say('Wie spät ist es?'); await tick(1100); await completeAudio();
    expect(FakeRecognition.all).toHaveLength(3); expect(spoken()).toContain('Uhr');
    expect(document.body.textContent).not.toContain('Es ist');
  });
  it('speaks the missing-name question, listens for the answer and opens the matching record', async () => {
    deps.searchClients = vi.fn().mockResolvedValue([{ id: 'anna/1', firstName: 'Anna', lastName: 'Müller' }]);
    await mount(); lastRecognition().say('Suche eine Akte'); await tick(1100); await completeAudio();
    expect(spoken()).toContain('Von welcher Person'); expect(host().dataset.state).toBe('listening');
    lastRecognition().say('Anna Müller'); await tick(1100);
    expect(deps.navigate).not.toHaveBeenCalled(); expect(spoken()).toContain('Anna Müller');
    expect(document.body.textContent).not.toContain('Anna Müller');
    await completeAudio(); expect(deps.navigate).toHaveBeenCalledWith('/office/clients/anna%2F1');
    expect(status().hidden).toBe(true); expect(button().getAttribute('aria-pressed')).toBe('false');
  });
  it('speaks a short-topic clarification and continues the guide from natural replies', async () => {
    await mount(); lastRecognition().say('Eine Rechnung'); await tick(1100); await completeAudio();
    expect(host().dataset.state).toBe('listening'); expect(spoken()).toContain('Rechnungsübersicht');
    lastRecognition().say('Ich möchte eine neue erstellen'); await tick(1100); await completeAudio();
    expect(host().dataset.state).toBe('listening'); expect(spoken()).toContain('Die Abrechnung vorbereiten');
    lastRecognition().say('Das habe ich gemacht'); await tick(1100); await completeAudio();
    expect(host().dataset.state).toBe('listening'); expect(spoken()).toContain('Schritt 2');
    expect(deps.navigate).not.toHaveBeenCalled(); expect(FakeRecognition.all).toHaveLength(4);
  });
  it('combines final fragments and revised interim speech before executing once', async () => {
    await mount(); const r = lastRecognition();
    r.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Öffne' } }, { isFinal: false, 0: { transcript: 'den Kalen' } }] });
    await tick(1200); expect(deps.loadVoice).not.toHaveBeenCalled();
    r.onresult?.({ resultIndex: 1, results: [{ isFinal: true, 0: { transcript: 'Öffne' } }, { isFinal: true, 0: { transcript: 'den Kalender' } }] });
    await tick(1100); await completeAudio();
    expect(deps.navigate).toHaveBeenCalledExactlyOnceWith('/assist/kalender');
  });
  it('recovers a browser end event and pauses after silence', async () => {
    await mount(); lastRecognition().onend?.(); await tick(500);
    expect(FakeRecognition.all).toHaveLength(2); expect(deps.loadVoice).not.toHaveBeenCalled();
    await tick(35000); const count = FakeRecognition.all.length; await tick(40000);
    expect(button().getAttribute('aria-pressed')).toBe('false'); expect(status().hidden).toBe(true); expect(FakeRecognition.all).toHaveLength(count);
  });
  it.each(['not-allowed', 'service-not-allowed', 'audio-capture', 'network'])('stops retrying on %s and gives an actionable microphone status', async error => {
    await mount(); lastRecognition().error(error); await tick(40000);
    expect(FakeRecognition.all).toHaveLength(1); expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(host().dataset.state).toBe('error'); expect(status().textContent).toContain('Neo erneut an');
    expect(document.querySelector('input, [role=dialog]')).toBeNull();
  });
  it('reports unsupported recognition without opening an input dialog', async () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    await mount(); expect(host().dataset.state).toBe('error'); expect(status().textContent).toContain('Sprachunterstützung');
    expect(button().getAttribute('aria-pressed')).toBe('false'); expect(document.querySelector('input, [role=dialog]')).toBeNull();
  });
  it('speaks goodbye and never rearms the microphone', async () => {
    await mount(); lastRecognition().say('Gespräch beenden'); await tick(1100); await completeAudio(); await tick(40000);
    expect(spoken()).toContain('Bis später'); expect(FakeRecognition.all).toHaveLength(1);
    expect(button().getAttribute('aria-pressed')).toBe('false'); expect(status().hidden).toBe(true);
  });
  it('stops if a response cannot be spoken instead of silently expecting an answer', async () => {
    await mount(); deps.loadVoice = vi.fn().mockRejectedValue(new Error('voice-offline'));
    lastRecognition().say('Was kannst du?'); await tick(1500);
    expect(host().dataset.state).toBe('error'); expect(status().textContent).toContain('Neo konnte nicht sprechen');
    expect(FakeRecognition.all).toHaveLength(1); expect(button().getAttribute('aria-pressed')).toBe('false');
  });
  it('does not navigate after a failed spoken confirmation', async () => {
    await mount(); deps.loadVoice = vi.fn().mockRejectedValue(new Error('voice-offline'));
    lastRecognition().say('Kalender öffnen'); await tick(1500);
    expect(deps.navigate).not.toHaveBeenCalled(); expect(host().dataset.state).toBe('error');
  });
  it('rechecks permissions after playback and speaks the changed access', async () => {
    let allowed = true; deps.canNavigate = () => allowed;
    await mount(); lastRecognition().say('Kalender öffnen'); await tick(1100); allowed = false; await completeAudio();
    expect(deps.navigate).not.toHaveBeenCalled(); expect(spoken()).toContain('nicht mehr freigegeben');
    expect(host().dataset.state).toBe('listening');
  });
});
describe('Neo spoken-session cancellation', () => {
  it('cancels the greeting with another click before starting the microphone', async () => {
    cleanup = mountRobotAssistant(deps); button().click(); await flush();
    const source = FakeAudio.sources.at(-1)!; button().click(); await tick(5000);
    expect(source.stop).toHaveBeenCalled(); expect(FakeRecognition.all).toHaveLength(0);
    expect(status().hidden).toBe(true); expect(button().getAttribute('aria-pressed')).toBe('false');
  });
  it('keeps the context when clicking Neo again after pausing', async () => {
    await mount(); lastRecognition().say('Urlaub'); await tick(1100); await completeAudio();
    button().click(); expect(lastRecognition().aborted).toBe(true); button().click();
    lastRecognition().say('Im Kalender'); await tick(1100); await completeAudio();
    expect(spoken()).toContain('Verfügbarkeiten und Abwesenheiten im Kalender pflegen');
  });
  it('cancels delayed search results when stopped', async () => {
    let resolve!: (clients: any[]) => void; deps.searchClients = vi.fn().mockImplementation(() => new Promise(r => { resolve = r; }));
    await mount(); lastRecognition().say('Akte von Müller'); await tick(1100); button().click();
    resolve([{ id: 'one', firstName: 'Anna', lastName: 'Müller' }]); await flush(); await tick(2000);
    expect(deps.navigate).not.toHaveBeenCalled(); expect(deps.loadVoice).not.toHaveBeenCalled(); expect(status().hidden).toBe(true);
  });
  it('speaks a search timeout and listens after the error is heard', async () => {
    deps.searchClients = vi.fn().mockImplementation(() => new Promise(() => {}));
    await mount(); lastRecognition().say('Akte von Müller'); await tick(1100); await tick(18000);
    expect(spoken()).toContain('nicht geklappt'); expect(FakeRecognition.all).toHaveLength(1);
    await completeAudio(); expect(host().dataset.state).toBe('listening'); expect(deps.navigate).not.toHaveBeenCalled();
  });
  it('allows stopping synthesis that has not returned audio', async () => {
    await mount(); deps.loadVoice = vi.fn().mockImplementation(() => new Promise(() => {}));
    lastRecognition().say('Hallo'); await tick(1100); button().click(); await tick(100000);
    expect(host().dataset.state).toBe('ready'); expect(status().hidden).toBe(true); expect(FakeRecognition.all).toHaveLength(1);
  });
  it('bounds stalled synthesis and leaves the microphone off', async () => {
    await mount(); deps.loadVoice = vi.fn().mockImplementation(() => new Promise(() => {}));
    lastRecognition().say('Hallo'); await tick(1100); await tick(96000);
    expect(host().dataset.state).toBe('error'); expect(FakeRecognition.all).toHaveLength(1);
  });
  it('stops on pagehide even before the document is marked hidden', async () => {
    await mount(); window.dispatchEvent(new Event('pagehide')); await tick(500);
    expect(lastRecognition().aborted).toBe(true); expect(button().getAttribute('aria-pressed')).toBe('false');
  });
  it('stops audio and rejects stale callbacks after escape', async () => {
    await mount(); lastRecognition().say('Kalender öffnen'); await tick(1100);
    const callback = FakeAudio.sources.at(-1)?.onended;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); callback?.(); await tick(5000);
    expect(deps.navigate).not.toHaveBeenCalled(); expect(FakeRecognition.all).toHaveLength(1); expect(status().hidden).toBe(true);
  });
  it('stops on visibility change and does not restart on return', async () => {
    await mount(); vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange')); await tick(1000);
    expect(lastRecognition().aborted).toBe(true); expect(button().getAttribute('aria-pressed')).toBe('false');
  });
  it('disposes the indicator and pending speech without restarting', async () => {
    await mount(); lastRecognition().say('Hallo'); await tick(1100); cleanup?.(); cleanup = undefined; await tick(40000);
    expect(document.querySelector('.cs-neo-voice-status, .cs-robot')).toBeNull(); expect(FakeRecognition.all).toHaveLength(1);
  });
  it('speaks complete long answers in chunks without referring to a hidden transcript', () => {
    const text = 'Dies ist eine längere Anleitung mit einem Beispiel. '.repeat(40).trim();
    const chunks = splitNeoSpeech(text);
    expect(chunks.length).toBeGreaterThan(1); expect(chunks.every(c => c.length <= 340 && c.length > 0)).toBe(true);
    expect(chunks.join(' ')).toBe(text);
  });
});
