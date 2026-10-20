import { makeNeoDraggable } from './neoPosition.web';
import { createNeoConversation, type NeoConversationDependencies, type NeoResponse } from './neoConversation.web';
import { createNeoVoiceStatus, NEO_CSS } from './neoVoiceStatus.web';
import { NEO_INTRODUCTION } from './neoCommands';

export type RobotDependencies = NeoConversationDependencies & {
  robotUrl: string;
  navigate: (route: string) => void;
  back: () => boolean;
  loadVoice: (replyId: string, signal: AbortSignal, text?: string) => Promise<ArrayBuffer>;
  prepareVoice?: () => void;
  positionKey?: string;
};
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives?: number; processLocally?: boolean;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  start(): void; abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition; webkitAudioContext?: typeof AudioContext };

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    operation.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}

/** Each worker request stays within its 360-character phonemizer limit. */
export function splitNeoSpeech(text: string): string[] {
  let remaining = text.replace(/\n+/g, '. ').replace(/\.\s*\./g, '.').replace(/„|“/g, '').replace(/\s+/g, ' ').trim();
  const parts: string[] = [];
  while (remaining.length > 340) {
    const prefix = remaining.slice(0, 340);
    const sentenceEnd = Math.max(prefix.lastIndexOf('. '), prefix.lastIndexOf('? '), prefix.lastIndexOf('! '));
    const cut = sentenceEnd >= 80 ? sentenceEnd + 1 : Math.max(1, prefix.lastIndexOf(' ') > 0 ? prefix.lastIndexOf(' ') : 340);
    parts.push(remaining.slice(0, cut).trim()); remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

export function mountRobotAssistant(deps: RobotDependencies): () => void {
  const host = document.createElement('aside'); host.className = 'cs-robot';
  host.setAttribute('aria-label', 'Neo, dein CareSuite-Assistent');
  host.innerHTML = `<style>${NEO_CSS}</style><button class="cs-robot-button" type="button" aria-describedby="cs-neo-voice-status"><img alt="" draggable="false" /></button>`;
  const button = host.querySelector<HTMLButtonElement>('button')!;
  host.querySelector<HTMLImageElement>('img')!.src = deps.robotUrl;
  document.body.append(host);
  const conversation = createNeoConversation(deps);
  let destroyed = false, voiceMode = false, hasWelcomed = false, generation = 0;
  let turn: AbortController | null = null;
  let recognition: Recognition | null = null;
  let context: AudioContext | null = null;
  let audio: AudioBufferSourceNode | null = null;
  let finishPlayback: (() => void) | null = null;
  let captureTimer: ReturnType<typeof setTimeout> | undefined;
  let commitTimer: ReturnType<typeof setTimeout> | undefined;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let deadline = 0, emptyRestarts = 0;
  const status = createNeoVoiceStatus();
  const positionStatus = () => {
    if (status.element.hidden) return;
    const viewport = window.visualViewport;
    const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
    const x = viewport?.offsetLeft ?? 0, y = viewport?.offsetTop ?? 0;
    status.element.style.maxWidth = `${Math.min(300, Math.max(0, width - 16))}px`;
    status.element.style.maxHeight = `${Math.max(0, height - 16)}px`;
    const rect = host.getBoundingClientRect(), bounds = status.element.getBoundingClientRect();
    const left = rect.left + (rect.width - bounds.width) / 2;
    const below = rect.bottom + 8;
    const top = below + bounds.height <= y + height - 8 ? below : rect.top - bounds.height - 8;
    status.element.style.left = `${Math.max(x + 8, Math.min(left, x + width - bounds.width - 8))}px`;
    status.element.style.top = `${Math.max(y + 8, Math.min(top, y + height - bounds.height - 8))}px`;
  };
  const setState = (state: string, text: string) => {
    if (destroyed) return;
    host.dataset.state = state;
    status.state(state, text, voiceMode || state === 'speaking' || state === 'thinking');
    const active = voiceMode || state === 'speaking' || state === 'thinking';
    button.setAttribute('aria-label', active ? 'Neo stoppen' : 'Mit Neo sprechen');
    button.setAttribute('aria-pressed', String(active)); button.title = text;
    positionStatus();
  };
  const stopCapture = () => {
    clearTimeout(captureTimer); clearTimeout(commitTimer); clearTimeout(restartTimer);
    const previous = recognition; recognition = null;
    if (previous) { previous.onstart = previous.onend = previous.onerror = previous.onresult = null; try { previous.abort(); } catch { /* already stopped */ } }
  };
  const stopAudio = () => {
    if (audio) { audio.onended = null; try { audio.stop(); } catch { /* already ended */ } audio.disconnect(); audio = null; }
    const finish = finishPlayback; finishPlayback = null; finish?.();
  };
  const cancelTurn = () => { generation++; turn?.abort(); turn = null; stopCapture(); stopAudio(); };
  const stopSession = (message: string) => { voiceMode = false; cancelTurn(); setState('ready', message); };
  const unlockAudio = () => {
    try {
      const Constructor = window.AudioContext ?? (window as SpeechWindow).webkitAudioContext;
      if ((!context || context.state === 'closed') && Constructor) context = new Constructor();
      void context?.resume().catch(() => {}); deps.prepareVoice?.();
    } catch { /* The spoken turn reports unavailable audio without starting the microphone. */ }
  };
  const execute = async (response: NeoResponse, request: AbortController, serial: number): Promise<boolean> => {
    const action = response.action; if (!action) return false;
    if (action.kind === 'navigate' || action.kind === 'client') {
      const allowed = action.kind === 'navigate' ? deps.canNavigate(action.destination) : deps.canSearchClients();
      if (!allowed) {
        await play('Der Zugriff ist inzwischen nicht mehr freigegeben. Bitte lasse deine Berechtigungen prüfen.', request, serial);
        return false;
      }
      stopSession('Seite wird geöffnet.');
      deps.navigate(action.kind === 'navigate' ? action.destination.route : `/office/clients/${encodeURIComponent(action.id)}`);
      return true;
    }
    if (deps.canGoBack?.() === false || !deps.back()) {
      await play('Hier gibt es keine vorherige Seite. Wohin möchtest du?', request, serial);
      return false;
    }
    stopSession('Vorherige Seite wird geöffnet.'); return true;
  };
  const play = async (text: string, request: AbortController, serial: number) => {
    if (!context || context.state === 'closed') throw new Error('audio-unavailable');
    for (const part of splitNeoSpeech(text)) {
      if (request.signal.aborted || serial !== generation) return;
      setState('thinking', 'Neo bereitet seine Antwort vor …');
      const encoded = await abortable(deps.loadVoice('neo:conversation', request.signal, part), request.signal);
      if (request.signal.aborted || serial !== generation || destroyed) return;
      const buffer = await abortable(context.decodeAudioData(encoded.slice(0)), request.signal);
      if (request.signal.aborted || serial !== generation || destroyed) return;
      await abortable(context.resume(), request.signal);
      if (request.signal.aborted || serial !== generation || destroyed) return;
      const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination); audio = source;
      setState('speaking', 'Neo spricht …');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); try { source.stop(); } catch { /* already stopped */ } reject(new Error('playback-timeout')); }, Math.max(6000, (buffer.duration + 4) * 1000));
        const abortPlayback = () => { cleanup(); try { source.stop(); } catch { /* already stopped */ } reject(new DOMException('Aborted', 'AbortError')); };
        const cleanup = () => { clearTimeout(timeout); request.signal.removeEventListener('abort', abortPlayback); source.onended = null; source.disconnect(); if (audio === source) audio = null; finishPlayback = null; };
        finishPlayback = () => { cleanup(); resolve(); };
        source.onended = () => { cleanup(); resolve(); };
        request.signal.addEventListener('abort', abortPlayback, { once: true });
        if (request.signal.aborted) { abortPlayback(); return; }
        try { source.start(); } catch (error) { cleanup(); reject(error); }
      });
    }
  };
  const speakTurn = async (produce: (signal: AbortSignal) => Promise<NeoResponse>): Promise<void> => {
    if (destroyed) return;
    cancelTurn();
    const serial = generation, request = new AbortController(); turn = request;
    setState('thinking', 'Neo denkt nach …');
    const workTimeout = setTimeout(() => request.abort(), 18000);
    let audioTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      let response: NeoResponse;
      try {
        response = await abortable(produce(request.signal), request.signal);
      } catch {
        if (destroyed || serial !== generation) return;
        // Use a fresh signal so the error itself can be heard after a search timeout.
        request.abort();
        await speakTurn(async () => ({ text: 'Das hat gerade nicht geklappt. Bitte versuche es erneut oder stelle deine Frage anders.' }));
        return;
      } finally { clearTimeout(workTimeout); }
      if (destroyed || serial !== generation || request.signal.aborted) return;
      if (response.end) voiceMode = false;
      audioTimeout = setTimeout(() => request.abort(), Math.max(95000, response.text.length * 100 + 15000));
      await play(response.text, request, serial);
      if (destroyed || serial !== generation || request.signal.aborted) return;
      if (await execute(response, request, serial)) return;
      if (destroyed || serial !== generation || request.signal.aborted) return;
      setState('ready', response.end ? 'Gespräch beendet. Mikrofon aus.' : 'Du kannst direkt antworten.');
      if (voiceMode && !document.hidden) { deadline = Date.now() + 35000; emptyRestarts = 0; scheduleCapture(300); }
    } catch {
      if (destroyed || serial !== generation) return;
      // A silent question is not answerable in voice mode. Stop instead of pretending to listen.
      stopSession('Sprachausgabe unterbrochen.');
      setState('error', 'Neo konnte nicht sprechen. Prüfe den Ton im Browser und klicke Neo erneut an.');
    } finally { clearTimeout(workTimeout); clearTimeout(audioTimeout); if (turn === request) turn = null; }
  };
  const submit = (input: string) => {
    if (destroyed || !input.trim()) return;
    return speakTurn(signal => conversation.respond(input.trim(), signal));
  };
  const pauseForSilence = () => stopSession('Gespräch pausiert. Klicke Neo an, um weiterzusprechen.');
  const scheduleCapture = (delay: number) => {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => { if (voiceMode && !destroyed && !document.hidden) startCapture(); }, delay);
  };
  const startCapture = () => {
    if (destroyed || !voiceMode || document.hidden) return;
    if (Date.now() >= deadline || emptyRestarts >= 8) { pauseForSilence(); return; }
    stopCapture();
    const Constructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor || !window.isSecureContext) {
      voiceMode = false; setState('error', 'Spracherkennung ist hier nicht verfügbar. Öffne CareSuite in einem Browser mit Sprachunterstützung.'); return;
    }
    try {
      const instance = new Constructor(); recognition = instance;
      instance.lang = 'de-DE'; instance.continuous = true; instance.interimResults = true; instance.maxAlternatives = 1;
      if ('processLocally' in instance) instance.processLocally = false;
      let finalText = '', interimText = '';
      const commit = () => {
        if (recognition !== instance || !voiceMode) return;
        if (!finalText.trim()) return;
        const text = finalText.trim(); stopCapture(); void submit(text);
      };
      const retry = () => {
        if (recognition !== instance) return;
        stopCapture(); emptyRestarts++;
        if (Date.now() >= deadline || emptyRestarts >= 8) pauseForSilence(); else scheduleCapture(350);
      };
      instance.onstart = () => { if (recognition === instance) setState('listening', 'Ich höre zu …'); };
      instance.onresult = event => {
        if (recognition !== instance || !voiceMode) return;
        // Rebuild from the full result list so interim revisions and multiple final
        // segments form one utterance instead of executing the first fragment.
        const finals: string[] = [], interim: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i]; (item.isFinal ? finals : interim).push(item[0].transcript);
        }
        finalText = finals.join(' ').trim(); interimText = interim.join(' ').trim();
        clearTimeout(commitTimer);
        if (finalText && !interimText) commitTimer = setTimeout(commit, 1000);
      };
      instance.onerror = event => {
        if (recognition !== instance) return;
        if (event.error === 'no-speech') { if (finalText) commit(); else retry(); return; }
        stopCapture(); voiceMode = false;
        const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Mikrofon nicht freigegeben. Erlaube den Mikrofonzugriff im Browser und klicke Neo erneut an.'
          : event.error === 'audio-capture' ? 'Kein Mikrofon verfügbar. Prüfe dein Eingabegerät und klicke Neo erneut an.'
          : event.error === 'network' ? 'Die Spracherkennung hat keine Verbindung. Klicke Neo erneut an, sobald die Verbindung wieder steht.'
          : 'Die Spracherkennung wurde unterbrochen. Klicke Neo erneut an, um weiterzusprechen.';
        setState('error', message);
      };
      instance.onend = () => { if (recognition === instance) { if (finalText && !interimText) commit(); else retry(); } };
      setState('listening', 'Das Mikrofon startet.');
      captureTimer = setTimeout(() => { if (recognition === instance) { if (finalText && !interimText) commit(); else pauseForSilence(); } }, Math.max(0, deadline - Date.now()));
      instance.start();
    } catch { stopCapture(); voiceMode = false; setState('error', 'Das Mikrofon konnte nicht starten. Prüfe die Mikrofonfreigabe und klicke Neo erneut an.'); }
  };
  const startVoice = () => {
    cancelTurn(); unlockAudio(); voiceMode = true;
    if (!hasWelcomed) {
      // This bundled Neo recording starts without waiting for the speech model to download.
      const greetingGeneration = generation + 1;
      void speakTurn(async () => ({ text: NEO_INTRODUCTION })).then(() => {
        if (!destroyed && voiceMode && generation === greetingGeneration) hasWelcomed = true;
      });
    } else {
      deadline = Date.now() + 35000; emptyRestarts = 0; startCapture();
    }
  };
  button.onclick = () => {
    if (voiceMode || turn || audio) { stopSession('Mikrofon aus.'); return; }
    startVoice();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { stopSession('Mikrofon aus.'); conversation.reset(); }
  };
  const onVisibility = () => { if (document.hidden) stopSession('Gespräch pausiert. Mikrofon aus.'); };
  const onPageHide = () => stopSession('Gespräch pausiert. Mikrofon aus.');
  document.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide); window.addEventListener('resize', positionStatus);
  window.addEventListener('caresuite:neo-dock-layout', positionStatus);
  window.visualViewport?.addEventListener('resize', positionStatus); window.visualViewport?.addEventListener('scroll', positionStatus);
  const stopDragging = makeNeoDraggable(host, button, deps.positionKey ?? 'caresuite.neo.position.v1', () => { stopSession('Gespräch pausiert.'); conversation.reset(); });
  setState('ready', 'Neo · Anklicken und sprechen');
  return () => {
    stopSession('Mikrofon aus.'); destroyed = true; conversation.reset(); stopDragging();
    void context?.close().catch(() => {});
    document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide); window.removeEventListener('resize', positionStatus);
    window.removeEventListener('caresuite:neo-dock-layout', positionStatus);
    window.visualViewport?.removeEventListener('resize', positionStatus); window.visualViewport?.removeEventListener('scroll', positionStatus);
    status.destroy(); host.remove();
  };
}
