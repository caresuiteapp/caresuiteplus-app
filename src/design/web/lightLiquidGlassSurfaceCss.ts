/**
 * Web-only CSS: frosted milchglas surfaces via data-cs-llgan-glass attributes.
 * Injected in app/+html.tsx so backdrop-filter is active before first paint.
 */
export const LLGAN_GLASS_SURFACE_STYLE_ID = 'caresuite-llgan-glass-surfaces';

export const LLGAN_GLASS_SURFACE_CSS = `
  :root {
    --llgan-glass-blur: 56px;
    --llgan-glass-saturate: 1.8;
    --llgan-glass-card-alpha: 0.14;
    --llgan-glass-panel-alpha: 0.12;
    --llgan-glass-chip-alpha: 0.18;
  }

  html, body, #root, #expo-root, [data-expo-root] {
    background-color: transparent !important;
    background: transparent !important;
  }

  .cs-llgan-glass,
  [data-cs-llgan-glass] {
    position: relative;
    background-color: rgba(255, 255, 255, var(--llgan-glass-card-alpha)) !important;
    background-image: none !important;
    border: 1px solid rgba(255, 255, 255, 0.78);
    box-shadow:
      0 20px 56px rgba(70, 110, 170, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.88);
    -webkit-backdrop-filter: blur(var(--llgan-glass-blur)) saturate(var(--llgan-glass-saturate));
    backdrop-filter: blur(var(--llgan-glass-blur)) saturate(var(--llgan-glass-saturate));
  }

  .cs-llgan-glass::before,
  [data-cs-llgan-glass]::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.22) 0%,
      rgba(255, 255, 255, 0.04) 38%,
      transparent 100%
    );
    opacity: 0.45;
    z-index: 0;
  }

  [data-cs-llgan-glass] > * {
    position: relative;
    z-index: 1;
  }

  [data-cs-llgan-glass="panel"] {
    background-color: rgba(255, 255, 255, var(--llgan-glass-panel-alpha)) !important;
    border-color: rgba(110, 160, 255, 0.3);
  }

  .cs-llgan-glass-card,
  [data-cs-llgan-glass="card"] {
    background-color: rgba(255, 255, 255, var(--llgan-glass-card-alpha)) !important;
    border-color: rgba(255, 255, 255, 0.82);
  }

  [data-cs-llgan-glass="chip"],
  [data-cs-llgan-glass="input"],
  [data-cs-llgan-glass="button"] {
    background-color: rgba(255, 255, 255, var(--llgan-glass-chip-alpha)) !important;
    border-color: rgba(120, 160, 255, 0.28);
    -webkit-backdrop-filter: blur(28px) saturate(1.36);
    backdrop-filter: blur(28px) saturate(1.36);
  }

  [data-cs-llgan-glass="modal"] {
    background-color: rgba(255, 255, 255, 0.42) !important;
    -webkit-backdrop-filter: blur(calc(var(--llgan-glass-blur) + 6px)) saturate(var(--llgan-glass-saturate));
    backdrop-filter: blur(calc(var(--llgan-glass-blur) + 6px)) saturate(var(--llgan-glass-saturate));
  }

  .performance-mobile.performance-ios-safari [data-cs-llgan-glass] {
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
    background-color: rgba(255, 255, 255, 0.72) !important;
  }

  .disable-heavy-effects [data-cs-llgan-glass] {
    -webkit-backdrop-filter: blur(16px) saturate(1.24) !important;
    backdrop-filter: blur(16px) saturate(1.24) !important;
    background-color: rgba(255, 255, 255, 0.26) !important;
  }
`;
