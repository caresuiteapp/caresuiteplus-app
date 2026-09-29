import { parseVoiceCommand, type Destination, type VoiceClient } from './voiceCommands';
import { createReplyPicker, type ReplyKey, type RobotReply } from './robotReplies';
import { createNeoReplies, parseNeoCommand } from './neoCommands';
import { makeNeoDraggable } from './neoPosition.web';

export type RobotDependencies = {
  robotUrl: string;
  canNavigate: (destination: Destination) => boolean;
  canSearchClients: () => boolean;
  navigate: (route: string) => void;
  back: () => boolean;
  canGoBack?: () => boolean;
  searchClients: (name: string) => Promise<VoiceClient[]>;
  loadVoice: (replyId: string, signal: AbortSignal, text?: string) => Promise<ArrayBuffer>;
  prepareVoice?: () => void;
  getProfileName?: () => string;
  getWeather?: (signal: AbortSignal) => Promise<string>;
  positionKey?: string;
};
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; processLocally?: boolean;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  start(): void; abort(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
  webkitAudioContext?: typeof AudioContext;
};
const CSS = `
.cs-robot{position:fixed;left:50%;top:max(28px,env(safe-area-inset-top));transform:translateX(-50%);z-index:1200;width:68px;height:74px}
.cs-robot-button{position:relative;display:grid;place-items:center;width:100%;height:100%;padding:0;border:0;border-radius:50%;background:transparent;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;isolation:isolate}
.cs-robot-button:focus-visible{outline:3px solid #7ce8ff;outline-offset:5px}.cs-robot-button img{width:100%;height:100%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 4px 9px #00142855);transition:transform .18s ease;z-index:1}.cs-robot-button:hover img{transform:translateY(-3px)}.cs-robot-button:active img{transform:scale(.94)}
.cs-robot-button::before{content:'';position:absolute;inset:18px 6px 5px;border-radius:50%;opacity:0;transition:opacity .2s;box-shadow:0 0 0 2px #76e9ff,0 0 24px #59d3ff80;background:#47ceff12}
.cs-robot[data-state=listening] .cs-robot-button::before{opacity:1;animation:csRobotBreathe 1.7s ease-in-out infinite}.cs-robot[data-state=thinking] .cs-robot-button::before{opacity:.65;animation:csRobotBreathe 2.4s ease-in-out infinite}.cs-robot[data-state=speaking] .cs-robot-button::before{opacity:.8;animation:csRobotBreathe .9s ease-in-out infinite}.cs-robot[data-state=error] .cs-robot-button::before{opacity:1;box-shadow:0 0 0 2px #ffb788,0 0 20px #ffa06066}
.cs-robot-status{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
@keyframes csRobotBreathe{50%{opacity:.38;transform:scale(.92)}}@media(prefers-reduced-motion:reduce){.cs-robot-button::before{animation:none!important}.cs-robot-button img{transition:none}}@media(max-width:540px){.cs-robot{width:54px;height:60px;top:max(8px,env(safe-area-inset-top))}}
`;

/** The only visible control is the robot. No transcript, panel or voice selector. */
export function mountRobotAssistant(deps: RobotDependencies): () => void {
  const host = document.createElement('aside');
  host.className = 'cs-robot';
  host.setAttribute('aria-label', 'Neo, dein CareSuite KI-Sprachassistent');
  host.innerHTML = `<style>${CSS}</style><button class="cs-robot-button" type="button"><img alt="" draggable="false" /></button><span class="cs-robot-status" role="status" aria-live="polite"></span>`;
  const button = host.querySelector<HTMLButtonElement>('button')!;
  const status = host.querySelector<HTMLElement>('.cs-robot-status')!;
  host.querySelector<HTMLImageElement>('img')!.src = deps.robotUrl;
  document.body.append(host);
  const pick = createReplyPicker();
  const neoReply = createNeoReplies();
  let lastReply: RobotReply | null = null;
  let destroyed = false;
  let generation = 0;
  let speechSerial = 0;
  let busy = false;
  let awaitingName = false;
  let lastAmbiguousName = '';
  let conversationUntil = 0;
  let recognition: Recognition | null = null;
  let context: AudioContext | null = null;
  let audio: AudioBufferSourceNode | null = null;
  let voiceRequest: AbortController | null = null;
  let weatherRequest: AbortController | null = null;
  let listenTimer: ReturnType<typeof setTimeout> | undefined;
  let actionTimer: ReturnType<typeof setTimeout> | undefined;
  let waitingTimer: ReturnType<typeof setTimeout> | undefined;
  let nameTimer: ReturnType<typeof setTimeout> | undefined;
  let errorTimer: ReturnType<typeof setTimeout> | undefined;

  const setState = (state: string, message = '') => {
    if (destroyed) return;
    clearTimeout(errorTimer);
    host.dataset.state = state;
    status.textContent = message;
    const active = state === 'listening' || state === 'thinking' || state === 'speaking';
    button.setAttribute('aria-label', active ? 'Neo stoppen' : 'Mit Neo sprechen. Zum Verschieben ziehen oder die Pfeiltasten verwenden.');
    button.setAttribute('aria-pressed', String(active));
    button.title = message || 'Neo · Anklicken und sprechen · Ziehen zum Verschieben';
    if (state === 'error') errorTimer = setTimeout(() => setState('ready'), 6000);
  };
  const stopListening = () => {
    clearTimeout(listenTimer);
    const previous = recognition; recognition = null;
    if (previous) {
      previous.onstart = previous.onend = previous.onerror = previous.onresult = null;
      try { previous.abort(); } catch { /* already stopped */ }
    }
  };
  const stopSpeech = () => {
    speechSerial += 1;
    voiceRequest?.abort(); voiceRequest = null;
    if (audio) { audio.onended = null; try { audio.stop(); } catch { /* already ended */ } audio.disconnect(); audio = null; }
  };
  const reset = () => {
    generation += 1; busy = false; awaitingName = false; lastAmbiguousName = ''; conversationUntil = 0;
    weatherRequest?.abort(); weatherRequest = null;
    clearTimeout(actionTimer); clearTimeout(waitingTimer); clearTimeout(nameTimer);
    stopListening(); stopSpeech(); setState('ready');
  };
  const sayReply = async (reply: RobotReply, state = 'ready', followup = false, afterSpeech?: () => void) => {
    stopListening(); stopSpeech();
    const serial = speechSerial;
    setState(state === 'error' ? 'error' : 'thinking', reply.text);
    const controller = new AbortController(); voiceRequest = controller;
    const timeout = setTimeout(() => controller.abort(), reply.id.startsWith('neo:') ? 95_000 : 12_000);
    try {
      if (!context || context.state === 'closed') throw new Error('audio-unavailable');
      const encoded = await deps.loadVoice(reply.id, controller.signal, reply.text);
      if (destroyed || serial !== speechSerial || controller.signal.aborted) return;
      const buffer = await context.decodeAudioData(encoded.slice(0));
      if (destroyed || serial !== speechSerial || controller.signal.aborted) return;
      await context.resume();
      if (destroyed || serial !== speechSerial || controller.signal.aborted) return;
      const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
      audio = source;
      source.onended = () => {
        source.disconnect();
        if (destroyed || serial !== speechSerial) return;
        audio = null; setState(state, reply.text);
        if (afterSpeech) { try { afterSpeech(); } catch { void sayReply(pick('error'), 'error'); } return; }
        if (followup && awaitingName && !document.hidden && Date.now() < conversationUntil) startListening();
      };
      setState('speaking', reply.text); source.start(); lastReply = reply;
    } catch {
      if (!destroyed && serial === speechSerial) {
        if (reply.id.startsWith('neo:')) void sayReply(pick('error'), 'error');
        else setState('error', 'Die Stimme konnte nicht abgespielt werden. Bitte prüfe den Browserton und lade die Seite neu.');
      }
    } finally {
      clearTimeout(timeout);
      if (voiceRequest === controller) voiceRequest = null;
    }
  };
  const say = (key: ReplyKey, state = 'ready', followup = false, afterSpeech?: () => void) => sayReply(pick(key), state, followup, afterSpeech);
  const sayText = (key: string, text: string, state = 'ready') => sayReply({ id: `neo:${key}`, text }, state);
  const weather = async () => {
    reset(); busy = true;
    const request = ++generation, controller = new AbortController(); weatherRequest = controller;
    setState('thinking', 'Neo fragt das Wetter an deinem Standort ab.');
    const timeout = setTimeout(() => controller.abort(), 16000);
    waitingTimer = setTimeout(() => { if (!destroyed && request === generation) void say('waiting', 'thinking'); }, 700);
    try {
      if (!deps.getWeather) throw new Error('weather-unavailable');
      const text = await deps.getWeather(controller.signal);
      if (destroyed || generation !== request) return;
      clearTimeout(waitingTimer); busy = false; void sayText('weather', text);
    } catch (error) {
      if (destroyed || generation !== request) return;
      clearTimeout(waitingTimer); busy = false;
      const message = error instanceof Error && error.message === 'weather-location-denied'
        ? 'Bitte erlaube den Standort im Browser, damit ich dir das Wetter in deiner Nähe sagen kann.'
        : 'Ich bekomme gerade keine verlässlichen Wetterdaten für deinen Standort. Versuch es bitte später noch einmal.';
      void sayText('weather-error', message, 'error');
    } finally { clearTimeout(timeout); if (weatherRequest === controller) weatherRequest = null; }
  };
  const run = async (text: string) => {
    if (destroyed) return;
    const extra = parseNeoCommand(text);
    if (extra) {
      if (extra === 'weather') { void weather(); return; }
      reset();
      if (extra === 'repeat') { void (lastReply ? sayReply(lastReply) : sayText('no-repeat', 'Ich habe noch nichts gesagt. Frag mich einfach etwas.')); return; }
      void sayText(extra, neoReply(extra, deps.getProfileName?.() ?? '')); return;
    }
    let command = parseVoiceCommand(text);
    if (command.kind === 'unknown' && awaitingName) command = parseVoiceCommand(`Akte von ${text}`);
    if (command.kind === 'cancel') { reset(); void say('cancel'); return; }
    const previousName = lastAmbiguousName;
    awaitingName = false; clearTimeout(nameTimer);
    stopListening();
    if (command.kind === 'help') { void say('help'); return; }
    if (command.kind === 'unknown' || command.kind === 'choice') { void say('unknown', 'error'); return; }
    try {
      if (command.kind === 'back') {
        if (deps.canGoBack?.() === false) { void say('noBack'); return; }
        void say('back', 'ready', false, () => { if (!deps.back()) void say('noBack'); }); return;
      }
      if (command.kind === 'navigate') {
        if (!deps.canNavigate(command.destination)) { void say('denied', 'error'); return; }
        const destination = command.destination;
        void say(destination.key, 'ready', false, () => {
          if (!deps.canNavigate(destination)) { void say('denied', 'error'); return; }
          deps.navigate(destination.route);
        }); return;
      }
      if (!deps.canSearchClients()) { void say('denied', 'error'); return; }
      busy = true; const request = ++generation;
      setState('thinking', 'Ich suche die passende Akte.');
      waitingTimer = setTimeout(() => { if (!destroyed && generation === request && busy) void say('waiting', 'thinking'); }, 1000);
      actionTimer = setTimeout(() => {
        if (destroyed || generation !== request) return;
        generation += 1; busy = false; clearTimeout(waitingTimer); void say('error', 'error');
      }, 12000);
      try {
        const matches = await deps.searchClients(command.name);
        if (destroyed || request !== generation) return;
        clearTimeout(actionTimer); clearTimeout(waitingTimer); busy = false;
        if (!deps.canSearchClients()) { void say('denied', 'error'); return; }
        if (!matches.length) { void say('notFound', 'error'); return; }
        if (matches.length === 1) {
          const route = `/office/clients/${encodeURIComponent(matches[0].id)}`;
          void say('clientFound', 'ready', false, () => {
            if (!deps.canSearchClients()) { void say('denied', 'error'); return; }
            deps.navigate(route);
          }); return;
        }
        const sameName = new Set(matches.map((client) => `${client.firstName} ${client.lastName}`.toLocaleLowerCase('de-DE'))).size === 1;
        if (sameName || previousName.toLocaleLowerCase('de-DE') === command.name.toLocaleLowerCase('de-DE')) {
          void say('duplicate', 'ready', false, () => {
            if (!deps.canSearchClients()) { void say('denied', 'error'); return; }
            deps.navigate('/office/clients');
          }); return;
        }
        lastAmbiguousName = command.name; awaitingName = true;
        nameTimer = setTimeout(() => { awaitingName = false; lastAmbiguousName = ''; }, 45000);
        void say('ambiguous', 'ready', true);
      } catch {
        if (destroyed || request !== generation) return;
        clearTimeout(actionTimer); clearTimeout(waitingTimer); busy = false; void say('error', 'error');
      }
    } catch { busy = false; void say('error', 'error'); }
  };
  const startListening = () => {
    if (destroyed || document.hidden) return;
    stopSpeech();
    const Constructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor || !window.isSecureContext) { void say('unsupported', 'error'); return; }
    try {
      const instance = new Constructor();
      // Retains the browser speech service already enabled by the user. No background microphone.
      if ('processLocally' in instance) instance.processLocally = false;
      instance.lang = 'de-DE'; instance.continuous = false; instance.interimResults = false;
      recognition = instance;
      instance.onstart = () => { if (recognition === instance) setState('listening', 'Ich höre zu. Zum Stoppen erneut anklicken.'); };
      instance.onresult = (event) => {
        if (recognition !== instance) return;
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) { const text = result[0].transcript; stopListening(); void run(text); return; }
        }
      };
      instance.onerror = (event) => {
        if (recognition !== instance) return;
        void say(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'microphone' : event.error === 'language-not-supported' ? 'unsupported' : 'noSpeech', 'error');
      };
      instance.onend = () => { if (recognition === instance) void say('noSpeech', 'error'); };
      setState('listening', 'Das Mikrofon startet.');
      listenTimer = setTimeout(() => { if (recognition === instance) void say('noSpeech', 'error'); }, 15000);
      instance.start();
    } catch { void say('microphone', 'error'); }
  };
  button.onclick = () => {
    if (recognition || busy || audio || voiceRequest) { reset(); return; }
    const Constructor = window.AudioContext ?? (window as SpeechWindow).webkitAudioContext;
    try { if (!context && Constructor) context = new Constructor(); void context?.resume().catch(() => {}); } catch { /* failure is reported with the response */ }
    conversationUntil = Date.now() + 90000;
    startListening();
  };
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') reset(); };
  const onVisibility = () => { if (document.hidden) reset(); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  const stopDragging = makeNeoDraggable(host, button, deps.positionKey ?? 'caresuite.neo.position.v1', reset);
  setState('ready');
  return () => { reset(); destroyed = true; clearTimeout(errorTimer); stopDragging(); lastReply = null; void context?.close().catch(() => {}); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVisibility); host.remove(); };
}
