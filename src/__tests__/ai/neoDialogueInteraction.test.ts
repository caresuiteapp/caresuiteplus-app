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
const panel = () => document.querySelector<HTMLElement>('.cs-neo-panel')!;
const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!.click();
const textMessage = (text: string) => {
  const input = document.querySelector<HTMLInputElement>('.cs-neo-form input')!;
  input.focus(); input.value = text;
  document.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
};
const completeAudio = async () => {
  for (let count = 0; count < 12; count++) { await flush(); const source = FakeAudio.sources.at(-1); if (!source?.onended) break; source.onended(); }
  await tick(350);
};
beforeEach(() => {
  vi.useFakeTimers(); FakeRecognition.all = []; FakeAudio.sources = [];
  vi.stubGlobal('SpeechRecognition', FakeRecognition); vi.stubGlobal('AudioContext', FakeAudio);
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  deps = { robotUrl: '/robot.png', canNavigate: () => true, canSearchClients: () => true, searchClients: vi.fn().mockResolvedValue([]), navigate: vi.fn(), back: vi.fn().mockReturnValue(false), loadVoice: vi.fn().mockResolvedValue(new ArrayBuffer(8)), prepareVoice: vi.fn() };
});
afterEach(() => { cleanup?.(); cleanup = undefined; vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
function mount() { cleanup = mountRobotAssistant(deps); click('.cs-robot-button'); }

describe('Neo complete voice turns', () => {
  it('starts on user input, pauses during its own reply and resumes for the next answer', async () => {
    mount(); expect(lastRecognition().continuous).toBe(true); expect(lastRecognition().interimResults).toBe(true);
    lastRecognition().say('Hallo Neo'); await tick(1100);
    expect(FakeRecognition.all).toHaveLength(1); expect(lastRecognition().aborted).toBe(true);
    expect(panel().dataset.state).toBe('speaking');
    await completeAudio(); expect(FakeRecognition.all).toHaveLength(2); expect(panel().dataset.state).toBe('listening');
    lastRecognition().say('Wie spät ist es?'); await tick(1100); await completeAudio();
    expect(FakeRecognition.all).toHaveLength(3); expect(panel().textContent).toContain('Uhr');
  });
  it('reopens the microphone after a missing-name question and uses the answer', async () => {
    deps.searchClients = vi.fn().mockResolvedValue([{ id: 'anna/1', firstName: 'Anna', lastName: 'Müller' }]);
    mount(); lastRecognition().say('Suche eine Akte'); await tick(1100); await completeAudio();
    expect(panel().dataset.state).toBe('listening');
    lastRecognition().say('Anna Müller'); await tick(1100);
    expect(deps.navigate).not.toHaveBeenCalled();
    await completeAudio(); expect(deps.navigate).toHaveBeenCalledWith('/office/clients/anna%2F1');
    expect(panel().dataset.active).toBe('false');
  });
  it('combines final fragments and revised interim speech before executing once', async () => {
    mount(); const r = lastRecognition();
    r.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Öffne' } }, { isFinal: false, 0: { transcript: 'den Kalen' } }] });
    await tick(1200); expect(deps.loadVoice).not.toHaveBeenCalled();
    r.onresult?.({ resultIndex: 1, results: [{ isFinal: true, 0: { transcript: 'Öffne' } }, { isFinal: true, 0: { transcript: 'den Kalender' } }] });
    await tick(1100); await completeAudio();
    expect(deps.navigate).toHaveBeenCalledExactlyOnceWith('/assist/kalender');
  });
  it('recovers a browser end event without turning silence into an error reply', async () => {
    mount(); lastRecognition().onend?.(); await tick(500);
    expect(FakeRecognition.all).toHaveLength(2); expect(deps.loadVoice).not.toHaveBeenCalled();
    await tick(35000); const count = FakeRecognition.all.length; await tick(40000);
    expect(panel().dataset.active).toBe('false'); expect(panel().textContent).toContain('pausiert'); expect(FakeRecognition.all).toHaveLength(count);
  });
  it.each(['not-allowed', 'service-not-allowed', 'audio-capture', 'network'])('stops retrying on %s and offers text', async error => {
    mount(); lastRecognition().error(error); await tick(40000);
    expect(FakeRecognition.all).toHaveLength(1); expect(panel().dataset.active).toBe('false'); expect(panel().dataset.state).toBe('error');
  });
  it('stops after goodbye and never rearms the microphone', async () => {
    mount(); lastRecognition().say('Gespräch beenden'); await tick(1100); await completeAudio(); await tick(40000);
    expect(FakeRecognition.all).toHaveLength(1); expect(panel().dataset.active).toBe('false');
  });
  it('retains the answer and continues listening if the voice cannot load', async () => {
    deps.loadVoice = vi.fn().mockRejectedValue(new Error('voice-offline'));
    mount(); lastRecognition().say('Was kannst du?'); await tick(1500);
    expect(panel().textContent).toContain('Welche Aufgabe'); expect(panel().dataset.state).toBe('listening');
  });
  it('does not let voice failure block valid navigation', async () => {
    deps.loadVoice = vi.fn().mockRejectedValue(new Error('voice-offline'));
    mount(); lastRecognition().say('Kalender öffnen'); await tick(1500);
    expect(deps.navigate).toHaveBeenCalledWith('/assist/kalender');
  });
  it('rechecks permissions after playback', async () => {
    let allowed = true; deps.canNavigate = () => allowed;
    mount(); lastRecognition().say('Kalender öffnen'); await tick(1100); allowed = false; await completeAudio();
    expect(deps.navigate).not.toHaveBeenCalled(); expect(panel().textContent).toContain('nicht mehr freigegeben');
  });
});
describe('Neo cancellation and text continuity', () => {
  it('keeps the microphone off for typed conversation and displays text safely', async () => {
    mount(); textMessage('<img src=x onerror=alert(1)>'); await flush(); await completeAudio();
    expect(FakeRecognition.all).toHaveLength(1); expect(panel().dataset.active).toBe('false');
    expect(panel().querySelectorAll('.cs-neo-message img')).toHaveLength(0);
    textMessage('Eine Klientenakte anlegen'); await flush(); await completeAudio();
    textMessage('Weiter'); await flush(); await completeAudio();
    expect(panel().textContent).toContain('Schritt 2'); expect(FakeRecognition.all).toHaveLength(1);
  });
  it('cancels delayed search results on close and clears the conversation', async () => {
    let resolve!: (clients: any[]) => void; deps.searchClients = vi.fn().mockImplementation(() => new Promise(r => { resolve = r; }));
    mount(); lastRecognition().say('Akte von Müller'); await tick(1100); click('.cs-neo-icon');
    resolve([{ id: 'one', firstName: 'Anna', lastName: 'Müller' }]); await flush(); await tick(2000);
    expect(deps.navigate).not.toHaveBeenCalled(); expect(panel().hidden).toBe(true); expect(panel().querySelector('.cs-neo-log')?.childElementCount).toBe(0);
  });
  it('bounds a search that never resolves and recovers for a new answer', async () => {
    deps.searchClients = vi.fn().mockImplementation(() => new Promise(() => {}));
    mount(); lastRecognition().say('Akte von Müller'); await tick(1100); await tick(18500);
    expect(panel().textContent).toContain('nicht geklappt'); expect(panel().dataset.state).toBe('listening');
    expect(deps.navigate).not.toHaveBeenCalled();
  });
  it('turning off sound interrupts synthesis and resumes listening', async () => {
    deps.loadVoice = vi.fn().mockImplementation(() => new Promise(() => {}));
    mount(); lastRecognition().say('Hallo'); await tick(1100); click('.cs-neo-mute'); await tick(500);
    expect(panel().dataset.state).toBe('listening'); expect(panel().querySelector('.cs-neo-mute')?.textContent).toBe('Ton aus');
  });
  it('stops on pagehide even before the document is marked hidden', async () => {
    mount(); window.dispatchEvent(new Event('pagehide')); await tick(500);
    expect(lastRecognition().aborted).toBe(true); expect(panel().dataset.active).toBe('false');
  });
  it('stops audio and rejects stale callbacks after escape', async () => {
    mount(); lastRecognition().say('Kalender öffnen'); await tick(1100);
    const callback = FakeAudio.sources.at(-1)?.onended;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); callback?.(); await tick(5000);
    expect(deps.navigate).not.toHaveBeenCalled(); expect(FakeRecognition.all).toHaveLength(1); expect(panel().hidden).toBe(true);
  });
  it('stops on visibility change and does not restart on return', async () => {
    mount(); vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange')); await tick(1000);
    expect(lastRecognition().aborted).toBe(true); expect(panel().dataset.active).toBe('false');
  });
  it('disposes the overlay and pending speech without restarting', async () => {
    mount(); lastRecognition().say('Hallo'); await tick(1100); cleanup?.(); cleanup = undefined; await tick(40000);
    expect(document.querySelector('.cs-neo-panel')).toBeNull(); expect(FakeRecognition.all).toHaveLength(1);
  });
  it('chunks long answers within the existing local voice limit', () => {
    const chunks = splitNeoSpeech('Dies ist eine längere Anleitung mit einem Beispiel. '.repeat(20));
    expect(chunks.length).toBeGreaterThan(1); expect(chunks.every(c => c.length <= 340 && c.length > 0)).toBe(true);
  });
});
