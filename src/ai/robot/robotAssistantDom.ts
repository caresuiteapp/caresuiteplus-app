import { makeNeoDraggable } from './neoPosition.web';
import { createNeoConversation, type NeoConversationDependencies, type NeoResponse } from './neoConversation.web';
import { createNeoPanel, NEO_CSS } from './neoPanel.web';

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
  if (remaining.length > 1100) remaining = remaining.slice(0, 1000).replace(/\s+\S*$/, '') + '. Den restlichen Text findest du im Gespräch.';
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
  host.innerHTML = `<style>${NEO_CSS}</style><button class="cs-robot-button" type="button" aria-haspopup="dialog" aria-controls="cs-neo-dialog"><img alt="" draggable="false" /></button>`;
  const button = host.querySelector<HTMLButtonElement>('button')!;
  host.querySelector<HTMLImageElement>('img')!.src = deps.robotUrl;
  document.body.append(host);
  const conversation = createNeoConversation(deps);
  let destroyed = false, voiceMode = false, muted = false, generation = 0;
  let turn: AbortController | null = null;
  let readingResponse = false;
  let recognition: Recognition | null = null;
  let context: AudioContext | null = null;
  let audio: AudioBufferSourceNode | null = null;
  let finishPlayback: (() => void) | null = null;
  let captureTimer: ReturnType<typeof setTimeout> | undefined;
  let commitTimer: ReturnType<typeof setTimeout> | undefined;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let deadline = 0, emptyRestarts = 0;
  const panel = createNeoPanel(deps.robotUrl, {
    submit: text => { unlockAudio(); void submit(text); },
    microphone: () => voiceMode ? stopSession('Mikrofon aus. Du kannst weiterschreiben.') : startVoice(),
    close: () => { stopSession('Mikrofon aus.'); conversation.reset(); panel.close(); button.setAttribute('aria-expanded', 'false'); button.focus(); },
    mute: () => { muted = !muted; panel.muted(muted); if (muted) { if (readingResponse) turn?.abort(); stopAudio(); } else unlockAudio(); },
    clear: () => { stopSession('Neues Gespräch.'); conversation.reset(); panel.clear(); welcome(); },
  });
  const positionPanel = () => {
    if (panel.element.hidden) return;
    const viewport = window.visualViewport;
    const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
    const x = viewport?.offsetLeft ?? 0, y = viewport?.offsetTop ?? 0;
    panel.element.style.width = `${Math.min(440, Math.max(200, width - 16))}px`;
    const rect = host.getBoundingClientRect();
    const panelWidth = panel.element.getBoundingClientRect().width || Math.min(440, width - 16);
    const top = width < 540 ? y + 8 : Math.max(y + 8, Math.min(rect.bottom + 10, y + height - 390));
    panel.element.style.left = `${x + Math.max(8, Math.min(rect.left - x, width - panelWidth - 8))}px`;
    panel.element.style.top = `${top}px`;
    panel.element.style.maxHeight = `${Math.max(100, height - (top - y) - 8)}px`;
  };
  const setState = (state: string, text: string) => {
    if (destroyed) return;
    host.dataset.state = state;
    panel.state(state, text, voiceMode);
    button.setAttribute('aria-label', voiceMode || turn ? 'Neo stoppen' : 'Mit Neo sprechen');
    button.setAttribute('aria-pressed', String(voiceMode)); button.title = text;
    positionPanel();
  };
  const stopCapture = () => {
    clearTimeout(captureTimer); clearTimeout(commitTimer); clearTimeout(restartTimer);
    const previous = recognition; recognition = null;
    if (previous) { previous.onstart = previous.onend = previous.onerror = previous.onresult = null; try { previous.abort(); } catch { /* already stopped */ } }
    panel.heard('');
  };
  const stopAudio = () => {
    if (audio) { audio.onended = null; try { audio.stop(); } catch { /* already ended */ } audio.disconnect(); audio = null; }
    const finish = finishPlayback; finishPlayback = null; finish?.();
  };
  const cancelTurn = () => { generation++; turn?.abort(); turn = null; readingResponse = false; stopCapture(); stopAudio(); };
  const stopSession = (message: string) => { voiceMode = false; cancelTurn(); setState('ready', message); };
  const unlockAudio = () => {
    if (muted) return;
    try {
      const Constructor = window.AudioContext ?? (window as SpeechWindow).webkitAudioContext;
      if ((!context || context.state === 'closed') && Constructor) context = new Constructor();
      void context?.resume().catch(() => {}); deps.prepareVoice?.();
    } catch { /* Written responses remain usable if audio is blocked. */ }
  };
  const welcome = () => {
    panel.append('assistant', 'Hallo, ich bin Neo. Was möchtest du in CareSuite erledigen? Du kannst sprechen oder schreiben. Wenn ich nachfrage, kannst du direkt antworten.');
    panel.suggestions(['Was kannst du?', 'Wie lege ich Klienten an?', 'Kalender öffnen']);
    setState('ready', 'Bereit für deine Frage.');
  };
  const ensureOpen = () => {
    if (panel.element.hidden) { panel.open(); welcome(); }
    button.setAttribute('aria-expanded', 'true'); positionPanel();
  };
  const permissionFailure = () => {
    panel.append('assistant', 'Der Zugriff ist inzwischen nicht mehr freigegeben. Bitte lasse deine Berechtigungen prüfen.');
    setState('error', 'Dieser Bereich ist nicht freigegeben.');
  };
  const execute = (response: NeoResponse): boolean => {
    const action = response.action; if (!action) return false;
    if (action.kind === 'navigate') {
      if (!deps.canNavigate(action.destination)) { permissionFailure(); return false; }
      stopSession('Seite wird geöffnet.'); deps.navigate(action.destination.route); return true;
    }
    if (action.kind === 'client') {
      if (!deps.canSearchClients()) { permissionFailure(); return false; }
      stopSession('Akte wird geöffnet.'); deps.navigate(`/office/clients/${encodeURIComponent(action.id)}`); return true;
    }
    if (deps.canGoBack?.() === false || !deps.back()) {
      panel.append('assistant', 'Hier gibt es keine vorherige Seite. Wohin möchtest du?'); return false;
    }
    stopSession('Vorherige Seite wird geöffnet.'); return true;
  };
  const play = async (text: string, request: AbortController, serial: number) => {
    if (muted) return;
    if (!context || context.state === 'closed') throw new Error('audio-unavailable');
    for (const part of splitNeoSpeech(text)) {
      if (muted || request.signal.aborted || serial !== generation) return;
      setState('thinking', 'Neo bereitet die Sprachausgabe vor.');
      const encoded = await abortable(deps.loadVoice('neo:conversation', request.signal, part), request.signal);
      if (request.signal.aborted || serial !== generation || destroyed || muted) return;
      const buffer = await abortable(context.decodeAudioData(encoded.slice(0)), request.signal);
      if (request.signal.aborted || serial !== generation || destroyed || muted) return;
      await abortable(context.resume(), request.signal);
      if (request.signal.aborted || serial !== generation || destroyed || muted) return;
      const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination); audio = source;
      setState('speaking', 'Neo spricht. Danach kannst du direkt antworten.');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); try { source.stop(); } catch { /* already stopped */ } reject(new Error('playback-timeout')); }, Math.max(6000, (buffer.duration + 4) * 1000));
        const cleanup = () => { clearTimeout(timeout); source.onended = null; source.disconnect(); if (audio === source) audio = null; finishPlayback = null; };
        finishPlayback = () => { cleanup(); resolve(); };
        source.onended = () => { cleanup(); resolve(); };
        try { source.start(); } catch (error) { cleanup(); reject(error); }
      });
    }
  };
  const submit = async (input: string) => {
    if (destroyed || !input.trim()) return;
    ensureOpen(); cancelTurn();
    const serial = generation, request = new AbortController(); turn = request;
    panel.append('user', input.trim()); panel.suggestions([]); setState('thinking', 'Neo verarbeitet deine Frage.');
    const workTimeout = setTimeout(() => request.abort(), 18000);
    let audioTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await abortable(conversation.respond(input.trim(), request.signal), request.signal);
      clearTimeout(workTimeout);
      if (destroyed || serial !== generation || request.signal.aborted) return;
      panel.append('assistant', response.text); panel.suggestions(response.suggestions);
      if (response.end) voiceMode = false;
      let voiceFailed = false;
      audioTimeout = setTimeout(() => request.abort(), 95000);
      readingResponse = true;
      try { await play(response.text, request, serial); } catch { voiceFailed = !muted; }
      if (serial === generation) readingResponse = false;
      clearTimeout(audioTimeout);
      if (destroyed || serial !== generation) return;
      // Synthesis failure must not discard a valid answer, its follow-up or navigation.
      if (execute(response)) return;
      if (voiceFailed || request.signal.aborted && !muted) setState('ready', 'Die Sprachausgabe ist nicht verfügbar. Du kannst die Antwort lesen.');
      else setState('ready', response.end ? 'Gespräch beendet. Mikrofon aus.' : 'Du kannst antworten oder eine neue Frage stellen.');
      if (voiceMode && !document.hidden) { deadline = Date.now() + 35000; emptyRestarts = 0; scheduleCapture(300); }
    } catch {
      if (destroyed || serial !== generation) return;
      panel.append('assistant', 'Das hat gerade nicht geklappt. Du kannst es erneut versuchen oder deine Frage anders stellen.');
      panel.suggestions(['Was kannst du?', 'Andere Frage']);
      setState('error', 'Die Anfrage konnte nicht abgeschlossen werden.');
      if (voiceMode && !document.hidden) { deadline = Date.now() + 35000; emptyRestarts = 0; scheduleCapture(300); }
    } finally { clearTimeout(workTimeout); clearTimeout(audioTimeout); if (turn === request) turn = null; }
  };
  const pauseForSilence = () => {
    voiceMode = false; stopCapture();
    setState('ready', 'Gespräch pausiert. Mit „Sprechen“ machst du weiter; der Zusammenhang bleibt erhalten.');
  };
  const scheduleCapture = (delay: number) => {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => { if (voiceMode && !destroyed && !document.hidden) startCapture(); }, delay);
  };
  const startCapture = () => {
    if (destroyed || !voiceMode || document.hidden || panel.element.hidden) return;
    if (Date.now() >= deadline || emptyRestarts >= 8) { pauseForSilence(); return; }
    stopCapture();
    const Constructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor || !window.isSecureContext) {
      voiceMode = false; setState('error', 'Spracherkennung ist hier nicht verfügbar. Schreibe deine Frage unten.'); panel.input.focus(); return;
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
      instance.onstart = () => { if (recognition === instance) setState('listening', 'Ich höre zu. Du kannst direkt antworten.'); };
      instance.onresult = event => {
        if (recognition !== instance || !voiceMode) return;
        // Rebuild from the full result list so interim revisions and multiple final
        // segments form one utterance instead of executing the first fragment.
        const finals: string[] = [], interim: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i]; (item.isFinal ? finals : interim).push(item[0].transcript);
        }
        finalText = finals.join(' ').trim(); interimText = interim.join(' ').trim();
        panel.heard([finalText, interimText].filter(Boolean).join(' ')); clearTimeout(commitTimer);
        if (finalText && !interimText) commitTimer = setTimeout(commit, 1000);
      };
      instance.onerror = event => {
        if (recognition !== instance) return;
        if (event.error === 'no-speech') { if (finalText) commit(); else retry(); return; }
        stopCapture(); voiceMode = false;
        const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Mikrofon nicht freigegeben. Erlaube es im Browser oder schreibe deine Antwort.'
          : event.error === 'audio-capture' ? 'Kein Mikrofon verfügbar. Prüfe das Eingabegerät oder schreibe deine Antwort.'
          : event.error === 'network' ? 'Die Spracherkennung hat keine Verbindung. Du kannst hier weiterschreiben.'
          : 'Die Spracherkennung wurde unterbrochen. Starte sie erneut oder schreibe deine Antwort.';
        setState('error', message);
      };
      instance.onend = () => { if (recognition === instance) { if (finalText && !interimText) commit(); else retry(); } };
      setState('listening', 'Das Mikrofon startet.');
      captureTimer = setTimeout(() => { if (recognition === instance) { if (finalText && !interimText) commit(); else pauseForSilence(); } }, Math.max(0, deadline - Date.now()));
      instance.start();
    } catch { stopCapture(); voiceMode = false; setState('error', 'Das Mikrofon konnte nicht starten. Versuche es erneut oder schreibe deine Antwort.'); }
  };
  const startVoice = () => {
    ensureOpen(); cancelTurn(); unlockAudio(); voiceMode = true;
    deadline = Date.now() + 35000; emptyRestarts = 0; startCapture();
  };
  button.onclick = () => {
    if (voiceMode || turn || audio) { stopSession('Gespräch pausiert. Du kannst weiterschreiben oder erneut sprechen.'); return; }
    startVoice();
  };
  // Typing is an explicit switch of input mode; no microphone captures keyboard-side conversation.
  panel.input.addEventListener('focus', () => { if (voiceMode) stopSession('Texteingabe. Mikrofon aus.'); });
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !panel.element.hidden) { stopSession('Mikrofon aus.'); conversation.reset(); panel.close(); button.setAttribute('aria-expanded', 'false'); button.focus(); }
  };
  const onVisibility = () => { if (document.hidden) stopSession('Gespräch pausiert. Mikrofon aus.'); };
  const onPageHide = () => stopSession('Gespräch pausiert. Mikrofon aus.');
  document.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide); window.addEventListener('resize', positionPanel);
  window.addEventListener('caresuite:neo-dock-layout', positionPanel);
  window.visualViewport?.addEventListener('resize', positionPanel); window.visualViewport?.addEventListener('scroll', positionPanel);
  const stopDragging = makeNeoDraggable(host, button, deps.positionKey ?? 'caresuite.neo.position.v1', () => { stopSession('Gespräch pausiert.'); panel.close(); conversation.reset(); });
  button.setAttribute('aria-expanded', 'false'); panel.muted(muted); setState('ready', 'Neo · Anklicken und sprechen');
  return () => {
    stopSession('Mikrofon aus.'); destroyed = true; conversation.reset(); stopDragging();
    void context?.close().catch(() => {});
    document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide); window.removeEventListener('resize', positionPanel);
    window.removeEventListener('caresuite:neo-dock-layout', positionPanel);
    window.visualViewport?.removeEventListener('resize', positionPanel); window.visualViewport?.removeEventListener('scroll', positionPanel);
    panel.destroy(); host.remove();
  };
}
