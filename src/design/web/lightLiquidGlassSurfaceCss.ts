/** Web CSS for the canonical CareSuite HealthOS V34 spatial surface. */
export const LLGAN_GLASS_SURFACE_STYLE_ID = 'caresuite-system-liquid-glass-surfaces';

export const LLGAN_GLASS_SURFACE_CSS = `
  :root {
    --cs-navy: #17182D;
    --cs-blue: #69E8FF;
    --cs-white: #FFFFFF;
    --cs-glass-panel: rgba(247, 242, 248, .82);
    --cs-glass-card: rgba(255, 255, 255, .82);
    --cs-glass-control: rgba(255, 255, 255, .76);
    --cs-glass-border: rgba(23, 24, 45, .12);
    --cs-glass-border-strong: rgba(23, 24, 45, .20);
    --cs-glass-blur: 28px;
    color-scheme: dark light;
  }

  html, body, #root, #expo-root, [data-expo-root] {
    background: #17182D !important;
    background-color: #17182D !important;
  }

  .cs-llgan-glass,
  [data-cs-llgan-glass] {
    position: relative;
    background-color: var(--cs-glass-card) !important;
    background-image: linear-gradient(
      145deg,
      rgba(255,255,255,.82) 0%,
      rgba(105,232,255,.045) 42%,
      rgba(233,226,240,.78) 100%
    ) !important;
    border: 1px solid var(--cs-glass-border);
    box-shadow:
      0 18px 48px rgba(5,7,22,.20),
      inset 0 1px 0 rgba(255,255,255,.78);
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
    background: linear-gradient(145deg, rgba(255,255,255,.58), rgba(255,255,255,.12) 38%, transparent 70%);
    opacity: .72;
    z-index: 0;
  }

  [data-cs-llgan-glass] > * { position: relative; z-index: 1; }

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
    background-color: rgba(255,255,255,.94) !important;
    border-color: var(--cs-glass-border-strong);
    -webkit-backdrop-filter: blur(36px) saturate(1.28) !important;
    backdrop-filter: blur(36px) saturate(1.28) !important;
  }

  .performance-mobile.performance-ios-safari [data-cs-llgan-glass],
  .disable-heavy-effects [data-cs-llgan-glass] {
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
    background-color: rgba(255,255,255,.97) !important;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
    }
  }
`;
