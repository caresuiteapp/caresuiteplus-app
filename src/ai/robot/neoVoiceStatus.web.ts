export const NEO_CSS = `
.cs-robot{position:fixed;left:50%;top:max(28px,env(safe-area-inset-top));transform:translateX(-50%);z-index:1200;width:68px;height:74px}
.cs-robot-button{position:relative;display:grid;place-items:center;width:100%;height:100%;padding:0;border:0;border-radius:50%;background:transparent;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;isolation:isolate}
.cs-robot-button:focus-visible{outline:3px solid #1684dc;outline-offset:4px}.cs-robot-button img{width:100%;height:100%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 4px 9px #00142855);transition:transform .18s ease;z-index:1}.cs-robot-button:hover img{transform:translateY(-3px)}
.cs-robot-button::before{content:'';position:absolute;inset:18px 6px 5px;border-radius:50%;opacity:0;box-shadow:0 0 0 2px #39c8f0,0 0 24px #59d3ff80;background:#47ceff12}
.cs-robot[data-state=listening] .cs-robot-button::before{opacity:1;animation:csNeoBreathe 1.7s ease-in-out infinite}.cs-robot[data-state=thinking] .cs-robot-button::before,.cs-robot[data-state=speaking] .cs-robot-button::before{opacity:.8;animation:csNeoBreathe 1s ease-in-out infinite}
.cs-neo-voice-status{position:fixed;z-index:1250;box-sizing:border-box;display:flex;align-items:flex-start;gap:9px;width:max-content;max-width:min(300px,calc(100vw - 16px));max-height:calc(100dvh - 16px);overflow:auto;padding:10px 14px;border:1px solid #c5dcf1;border-radius:18px;background:#f4fafff5;box-shadow:0 6px 24px #173e6926;color:#16334d;font:500 13px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;backdrop-filter:blur(18px);overflow-wrap:anywhere;text-align:left;pointer-events:none}
.cs-neo-voice-status[hidden]{display:none!important}.cs-neo-voice-dot{width:8px;height:8px;flex-shrink:0;margin-top:6px;border-radius:50%;background:#1771d4}.cs-neo-voice-status[data-state=listening] .cs-neo-voice-dot{background:#09816b;box-shadow:0 0 0 4px #0b9b7d18}.cs-neo-voice-status[data-state=thinking] .cs-neo-voice-dot{background:#a26b0b}.cs-neo-voice-status[data-state=error] .cs-neo-voice-dot{background:#b74432}
@keyframes csNeoBreathe{50%{opacity:.45}}@media(prefers-reduced-motion:reduce){.cs-robot-button::before{animation:none!important}.cs-robot-button img{transition:none}}
@media(max-width:540px){.cs-robot{width:54px;height:60px;top:max(8px,env(safe-area-inset-top))}}
`;

/** A transient microphone/speaker indicator, never a transcript or dialog. */
export function createNeoVoiceStatus() {
  const element = document.createElement('div');
  element.className = 'cs-neo-voice-status'; element.id = 'cs-neo-voice-status'; element.hidden = true;
  element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite');
  const dot = document.createElement('span'); dot.className = 'cs-neo-voice-dot'; dot.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span'); element.append(dot, label); document.body.append(element);
  return {
    element,
    state: (state: string, message: string, active: boolean) => {
      element.dataset.state = state; element.hidden = !active && state !== 'error';
      label.textContent = message;
    },
    destroy: () => element.remove(),
  };
}
