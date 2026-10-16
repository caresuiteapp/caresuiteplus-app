export const NEO_CSS = `
.cs-robot{position:fixed;left:50%;top:max(28px,env(safe-area-inset-top));transform:translateX(-50%);z-index:1200;width:68px;height:74px}
.cs-robot-button{position:relative;display:grid;place-items:center;width:100%;height:100%;padding:0;border:0;border-radius:50%;background:transparent;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;isolation:isolate}
.cs-robot-button:focus-visible{outline:3px solid #1684dc;outline-offset:4px}.cs-robot-button img{width:100%;height:100%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 4px 9px #00142855);transition:transform .18s ease;z-index:1}.cs-robot-button:hover img{transform:translateY(-3px)}
.cs-robot-button::before{content:'';position:absolute;inset:18px 6px 5px;border-radius:50%;opacity:0;box-shadow:0 0 0 2px #39c8f0,0 0 24px #59d3ff80;background:#47ceff12}
.cs-robot[data-state=listening] .cs-robot-button::before{opacity:1;animation:csNeoBreathe 1.7s ease-in-out infinite}.cs-robot[data-state=thinking] .cs-robot-button::before,.cs-robot[data-state=speaking] .cs-robot-button::before{opacity:.8;animation:csNeoBreathe 1s ease-in-out infinite}
.cs-neo-panel,.cs-neo-panel *{box-sizing:border-box}.cs-neo-panel[hidden]{display:none!important}
.cs-neo-panel{position:fixed;z-index:1250;width:min(440px,calc(100vw - 24px));max-height:calc(100dvh - 24px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #c5dcf1;border-radius:24px;background:linear-gradient(145deg,#f6fbffff,#fffffffa);box-shadow:0 24px 80px #173e6933,0 3px 12px #21496b15;color:#16334d;font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;backdrop-filter:blur(24px);text-align:left}
.cs-neo-head{display:flex;align-items:center;gap:10px;padding:16px 18px 12px;flex-shrink:0;border-bottom:1px solid #dce8f3;background:linear-gradient(120deg,#e9f7ff,#f8faff)}
.cs-neo-avatar{width:46px;height:50px;object-fit:contain;flex-shrink:0}.cs-neo-title{flex:1;min-width:0}.cs-neo-title strong{display:block;font-size:20px;letter-spacing:-.4px;color:#123d69}.cs-neo-title small{font-size:12px;color:#4e6780}
.cs-neo-panel button,.cs-neo-panel input{font:inherit}.cs-neo-panel button{cursor:pointer}.cs-neo-panel button:focus-visible,.cs-neo-panel input:focus-visible{outline:3px solid #228bdb;outline-offset:2px}.cs-neo-panel button:disabled{opacity:.5;cursor:default}
.cs-neo-icon{border:1px solid #cbddeb;background:#fff;color:#345670;min-width:36px;min-height:36px;border-radius:12px;padding:4px 9px;font-size:20px!important}
.cs-neo-log{overflow:auto;overscroll-behavior:contain;min-height:100px;padding:18px;flex:1;scrollbar-width:thin}.cs-neo-message{margin:0 0 14px;max-width:100%;overflow-wrap:anywhere}.cs-neo-message:last-child{margin-bottom:0}.cs-neo-message-label{font-weight:650;font-size:11px;letter-spacing:.04em;color:#5b7188;margin-bottom:5px}.cs-neo-message p{white-space:pre-wrap;margin:0;border-radius:16px 16px 16px 5px;background:#edf4fa;padding:12px 14px;color:#1d3c57}.cs-neo-message[data-role=user]{margin-left:32px}.cs-neo-message[data-role=user] p{background:#125fbe;color:#fff;border-radius:16px 16px 5px 16px}.cs-neo-message[data-role=user] .cs-neo-message-label{text-align:right}
.cs-neo-foot{padding:12px 16px 16px;border-top:1px solid #dde8f2;background:#fbfdff;flex-shrink:0}.cs-neo-status{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;font-size:12px;font-weight:600;color:#415e79;min-height:20px}.cs-neo-dot{width:8px;height:8px;margin-top:5px;border-radius:50%;background:#8b9db0;flex-shrink:0}.cs-neo-panel[data-state=listening] .cs-neo-dot{background:#09816b;box-shadow:0 0 0 4px #0b9b7d18;animation:csNeoBreathe 1.5s infinite}.cs-neo-panel[data-state=speaking] .cs-neo-dot{background:#1771d4}.cs-neo-panel[data-state=thinking] .cs-neo-dot{background:#b87a0e}.cs-neo-panel[data-state=error] .cs-neo-dot{background:#b74432}
.cs-neo-heard{font-size:12px;color:#536d85;max-height:48px;overflow:auto;overflow-wrap:anywhere;margin-bottom:8px;white-space:pre-wrap}.cs-neo-heard:empty{display:none}
.cs-neo-suggestions{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px;max-height:96px;overflow:auto}.cs-neo-suggestions:empty{display:none}.cs-neo-suggestions button{padding:6px 10px;min-height:34px;border-radius:10px;border:1px solid #cbdff0;background:#f2f8ff;color:#245d91;font-size:12px;max-width:100%;overflow-wrap:anywhere;text-align:left}.cs-neo-suggestions button:hover{background:#deedff}
.cs-neo-form{display:flex;align-items:stretch;gap:6px}.cs-neo-form input{min-width:0;flex:1;border:1px solid #b9cfe2;border-radius:12px;padding:10px 12px;background:#fff;color:#16334d;font-size:14px}.cs-neo-send{border:0;border-radius:12px;padding:9px 12px;background:#1267c6;color:#fff;font-weight:600;font-size:13px!important}
.cs-neo-controls{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}.cs-neo-mic{flex:1;border:1px solid #afd8ca;border-radius:12px;min-height:38px;padding:8px 10px;background:#edf9f4;color:#17654f;font-size:12px!important;font-weight:650}.cs-neo-panel[data-active=true] .cs-neo-mic{background:#175fba;border-color:#175fba;color:#fff}.cs-neo-mute,.cs-neo-clear{border:0;background:transparent;color:#486782;padding:7px 3px;font-size:12px!important;min-height:36px}.cs-neo-note{font-size:10px;color:#60758a;margin:9px 0 0}
@keyframes csNeoBreathe{50%{opacity:.45}}@media(prefers-reduced-motion:reduce){.cs-robot-button::before,.cs-neo-dot{animation:none!important}.cs-robot-button img{transition:none}}
@media(max-height:500px){.cs-neo-panel{overflow-y:auto}.cs-neo-log{flex:0 0 auto;min-height:80px;max-height:160px}}
@media(max-width:540px){.cs-robot{width:54px;height:60px;top:max(8px,env(safe-area-inset-top))}.cs-neo-panel{border-radius:20px;width:calc(100vw - 16px)}.cs-neo-head{padding:12px 14px}.cs-neo-log{padding:14px}.cs-neo-foot{padding:10px 12px 12px}.cs-neo-message p{padding:10px 12px}}
`;

export function createNeoPanel(robotUrl: string, callbacks: { submit: (text: string) => void; microphone: () => void; close: () => void; mute: () => void; clear: () => void }) {
  const panel = document.createElement('section');
  panel.className = 'cs-neo-panel'; panel.id = 'cs-neo-dialog'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Gespräch mit Neo');
  panel.innerHTML = `<header class="cs-neo-head"><img class="cs-neo-avatar" alt=""/><div class="cs-neo-title"><strong>Neo</strong><small>Dein Assistent in CareSuite</small></div><button type="button" class="cs-neo-icon" aria-label="Gespräch schließen">×</button></header><div class="cs-neo-log" role="log" aria-label="Gesprächsverlauf" aria-live="polite" tabindex="0"></div><footer class="cs-neo-foot"><div class="cs-neo-status" role="status"><span class="cs-neo-dot" aria-hidden="true"></span><span class="cs-neo-state"></span></div><div class="cs-neo-heard" aria-live="off"></div><div class="cs-neo-suggestions" aria-label="Antwortvorschläge"></div><form class="cs-neo-form"><input aria-label="Nachricht an Neo" placeholder="Frage stellen oder antworten …" autocomplete="off" maxlength="1000"/><button class="cs-neo-send" type="submit">Senden</button></form><div class="cs-neo-controls"><button type="button" class="cs-neo-mic">Sprechen</button><button type="button" class="cs-neo-mute" aria-pressed="false">Ton an</button><button type="button" class="cs-neo-clear">Neues Gespräch</button></div><p class="cs-neo-note">Nach einer Antwort kannst du direkt weiterreden. Mit „Stopp“ schaltest du das Mikrofon aus.</p></footer>`;
  panel.querySelector<HTMLImageElement>('img')!.src = robotUrl;
  document.body.append(panel);
  const log = panel.querySelector<HTMLElement>('.cs-neo-log')!;
  const state = panel.querySelector<HTMLElement>('.cs-neo-state')!;
  const heard = panel.querySelector<HTMLElement>('.cs-neo-heard')!;
  const suggestions = panel.querySelector<HTMLElement>('.cs-neo-suggestions')!;
  const input = panel.querySelector<HTMLInputElement>('input')!;
  const mic = panel.querySelector<HTMLButtonElement>('.cs-neo-mic')!;
  const mute = panel.querySelector<HTMLButtonElement>('.cs-neo-mute')!;
  panel.querySelector<HTMLButtonElement>('.cs-neo-icon')!.onclick = callbacks.close;
  panel.querySelector<HTMLFormElement>('form')!.onsubmit = event => { event.preventDefault(); const text = input.value.trim(); if (text) { input.value = ''; callbacks.submit(text); } };
  mic.onclick = callbacks.microphone; mute.onclick = callbacks.mute;
  panel.querySelector<HTMLButtonElement>('.cs-neo-clear')!.onclick = callbacks.clear;
  const append = (role: 'user' | 'assistant', text: string) => {
    const message = document.createElement('div'); message.className = 'cs-neo-message'; message.dataset.role = role;
    const label = document.createElement('div'); label.className = 'cs-neo-message-label'; label.textContent = role === 'user' ? 'DU' : 'NEO';
    const content = document.createElement('p'); content.textContent = text;
    message.append(label, content); log.append(message);
    while (log.childElementCount > 30) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
  };
  return {
    element: panel,
    append,
    input,
    open: () => { panel.hidden = false; },
    close: () => { panel.hidden = true; log.replaceChildren(); suggestions.replaceChildren(); input.value = ''; heard.textContent = ''; },
    clear: () => { log.replaceChildren(); suggestions.replaceChildren(); heard.textContent = ''; },
    heard: (text: string) => { heard.textContent = text; },
    state: (value: string, message: string, active: boolean) => {
      panel.dataset.state = value; panel.dataset.active = String(active); state.textContent = message;
      mic.textContent = active ? 'Mikrofon ausschalten' : 'Sprechen'; mic.setAttribute('aria-pressed', String(active));
    },
    muted: (value: boolean) => { mute.textContent = value ? 'Ton aus' : 'Ton an'; mute.setAttribute('aria-pressed', String(value)); mute.setAttribute('aria-label', value ? 'Sprachausgabe einschalten' : 'Sprachausgabe ausschalten'); },
    suggestions: (values: string[] = []) => {
      suggestions.replaceChildren();
      for (const text of values.slice(0, 5)) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
        button.onclick = () => callbacks.submit(text); suggestions.append(button);
      }
    },
    destroy: () => panel.remove(),
  };
}
