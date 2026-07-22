/** Web CSS for the canonical CareSuite HealthOS V34 spatial surface. */
export const LLGAN_GLASS_SURFACE_STYLE_ID = 'caresuite-system-liquid-glass-surfaces';

export const LLGAN_GLASS_SURFACE_CSS = `
  :root {
    --cs-navy: #17182D;
    --cs-blue: #69E8FF;
    --cs-white: #FFFFFF;
    --cs-glass-panel: rgba(39, 40, 70, .82);
    --cs-glass-card: rgba(53, 54, 88, .80);
    --cs-glass-control: rgba(255, 255, 255, .075);
    --cs-glass-border: rgba(255, 255, 255, .13);
    --cs-glass-border-strong: rgba(255, 255, 255, .22);
    --cs-glass-blur: 28px;
    color-scheme: dark;
  }

  html, body, #root, #expo-root, [data-expo-root] {
    background: #17182D !important;
    background-color: #17182D !important;
    color: #F8F6FF;
  }

  input, textarea, select, button {
    color: inherit;
  }

  input::placeholder, textarea::placeholder {
    color: rgba(248, 246, 255, .56);
    opacity: 1;
  }

  .cs-llgan-glass,
  [data-cs-llgan-glass] {
    position: relative;
    background-color: var(--cs-glass-card) !important;
    color: #F8F6FF;
    background-image: linear-gradient(
      145deg,
      rgba(255,255,255,.105) 0%,
      rgba(105,232,255,.035) 42%,
      rgba(112,104,145,.14) 100%
    ) !important;
    border: 1px solid var(--cs-glass-border);
    box-shadow:
      0 18px 48px rgba(5,7,22,.34),
      inset 0 1px 0 rgba(255,255,255,.16);
    -webkit-backdrop-filter: blur(var(--cs-glass-blur)) saturate(1.28) !important;
    backdrop-filter: blur(var(--cs-glass-blur)) saturate(1.28) !important;
  }

  .cs-llgan-glass::before,
  [data-cs-llgan-glass]::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(145deg, rgba(255,255,255,.14), rgba(255,255,255,.035) 38%, transparent 70%);
    opacity: .9;
    z-index: 0;
  }

  [data-cs-llgan-glass] > * { position: relative; z-index: 1; }

  /* Legacy light-world components sometimes persisted an explicit black
     inline colour. Inside the canonical dark glass shell that is never a
     valid content colour and made labels effectively invisible. */
  [data-cs-llgan-glass] [style*="color: rgb(0, 0, 0)"],
  [data-cs-llgan-glass] [style*="color: rgba(0, 0, 0"] {
    color: #F8F6FF !important;
  }

  [data-cs-llgan-glass="panel"] {
    background-color: var(--cs-glass-panel) !important;
    border-color: var(--cs-glass-border);
  }

  .cs-llgan-glass-card,
  [data-cs-llgan-glass="card"] {
    background-color: var(--cs-glass-card) !important;
    border-color: var(--cs-glass-border);
  }

  [data-cs-llgan-glass="chip"],
  [data-cs-llgan-glass="input"],
  [data-cs-llgan-glass="button"] {
    background-color: var(--cs-glass-control) !important;
    border-color: var(--cs-glass-border);
    -webkit-backdrop-filter: blur(18px) saturate(1.2) !important;
    backdrop-filter: blur(18px) saturate(1.2) !important;
  }

  [data-cs-llgan-glass="input"]:focus-within,
  [data-cs-llgan-glass="button"]:focus-visible {
    border-color: rgba(105,232,255,.72) !important;
    box-shadow: 0 0 0 3px rgba(105,232,255,.14);
  }

  [data-cs-llgan-glass="modal"] {
    background-color: rgba(39,40,70,.96) !important;
    border-color: var(--cs-glass-border-strong);
    -webkit-backdrop-filter: blur(36px) saturate(1.28) !important;
    backdrop-filter: blur(36px) saturate(1.28) !important;
  }

  .performance-mobile.performance-ios-safari [data-cs-llgan-glass],
  .disable-heavy-effects [data-cs-llgan-glass] {
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
    background-color: rgba(39,40,70,.98) !important;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
    }
  }
`;
