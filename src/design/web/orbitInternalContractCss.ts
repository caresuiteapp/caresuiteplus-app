/**
 * Final ORBIT contract for authenticated internal product routes.
 *
 * The existing HealthOS CSS remains available to both public and portal
 * surfaces. This contract is deliberately scoped by a runtime attribute so
 * Office, Assist, Pflege, Stationär, Beratung, Akademie, Robotics, Platform
 * and Settings share one bright work environment without repainting either
 * portal.
 */
export const ORBIT_INTERNAL_CONTRACT_CSS = `
  html[data-cs-orbit-internal] {
    color-scheme: light;
    --orbit-ink: #0B1220;
    --orbit-copy: #334155;
    --orbit-muted: #64748B;
    --orbit-blue: #056CE8;
    --orbit-blue-bright: #1683FF;
    --orbit-cyan: #0EA5E9;
    --orbit-page: #F4F8FD;
    --orbit-surface: #FFFFFF;
    --orbit-surface-soft: #F7FBFF;
    --orbit-surface-blue: #EAF4FF;
    --orbit-line: rgba(37,99,235,.16);
    --orbit-line-strong: rgba(37,99,235,.32);
    --orbit-shadow: 0 18px 48px rgba(37,78,128,.12);
  }

  html[data-cs-orbit-internal],
  html[data-cs-orbit-internal] body,
  html[data-cs-orbit-internal] #root,
  html[data-cs-orbit-internal] #expo-root,
  html[data-cs-orbit-internal] [data-expo-root] {
    background:
      radial-gradient(circle at 96% 6%, rgba(37,99,235,.11), transparent 30%),
      radial-gradient(circle at 3% 92%, rgba(14,165,233,.09), transparent 28%),
      linear-gradient(145deg, #F8FBFF 0%, #F1F7FF 52%, #FFFFFF 100%) !important;
    background-attachment: fixed !important;
    color: var(--orbit-ink) !important;
  }

  html[data-cs-orbit-internal] body::before,
  html[data-cs-orbit-internal] body::after {
    border-color: rgba(37,99,235,.10) !important;
    box-shadow: 0 0 110px rgba(37,99,235,.08), inset 0 0 90px rgba(14,165,233,.04) !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-page="surface"],
  html[data-cs-orbit-internal] [data-cs-healthos-component="list-overview"],
  html[data-cs-orbit-internal] [data-cs-healthos-component="section"],
  html[data-cs-orbit-internal] [data-cs-healthos-component="table"],
  html[data-cs-orbit-internal] .cs-llgan-glass,
  html[data-cs-orbit-internal] [data-cs-llgan-glass] {
    --cs-glass-panel: #FFFFFF;
    --cs-glass-card: #F7FBFF;
    --cs-glass-control: #EAF4FF;
    --cs-glass-border: rgba(37,99,235,.16);
    --cs-glass-border-strong: rgba(37,99,235,.32);
    color: var(--orbit-ink) !important;
    background:
      radial-gradient(circle at 92% -24%, rgba(96,165,250,.18), transparent 42%),
      linear-gradient(145deg, rgba(255,255,255,.99), rgba(239,247,255,.98)) !important;
    border-color: var(--orbit-line) !important;
    box-shadow: var(--orbit-shadow), inset 0 1px 0 rgba(255,255,255,.98) !important;
    -webkit-backdrop-filter: blur(24px) saturate(1.08) !important;
    backdrop-filter: blur(24px) saturate(1.08) !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="screen-header"] {
    color: var(--orbit-ink) !important;
    background:
      radial-gradient(circle at 88% -30%, rgba(96,165,250,.24), transparent 44%),
      linear-gradient(118deg, #FFFFFF 0%, #F4F9FF 58%, #DFEEFF 100%) !important;
    border-color: var(--orbit-line) !important;
    box-shadow: 0 14px 36px rgba(37,78,128,.10) !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="screen-header"]::after {
    content: 'ORBIT';
    color: rgba(5,108,232,.20);
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="card"],
  html[data-cs-orbit-internal] [data-cs-healthos-component="interactive-card"],
  html[data-cs-orbit-internal] [data-cs-healthos-component="kpi-card"],
  html[data-cs-orbit-internal] [data-cs-healthos-component="module-tile"] {
    color: var(--orbit-ink) !important;
    background:
      radial-gradient(circle at 92% -24%, rgba(96,165,250,.18), transparent 44%),
      linear-gradient(145deg, #FFFFFF, #F1F7FF) !important;
    border-color: var(--orbit-line) !important;
    box-shadow: 0 14px 34px rgba(37,78,128,.10), inset 0 1px 0 #FFFFFF !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="interactive-card"]:hover,
  html[data-cs-orbit-internal] [data-cs-healthos-component="module-tile"]:hover {
    transform: translateY(-3px);
    background: linear-gradient(145deg, #FFFFFF, #E5F1FF) !important;
    border-color: rgba(5,108,232,.48) !important;
    box-shadow: 0 22px 48px rgba(37,78,128,.16), 0 0 26px rgba(22,131,255,.09) !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="list-row"] {
    color: var(--orbit-ink) !important;
    background: rgba(255,255,255,.76) !important;
    border-color: rgba(37,99,235,.10) !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="list-row"]:hover {
    background: #EAF4FF !important;
    border-color: rgba(5,108,232,.32) !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="modal"] {
    width: calc(100vw - 32px) !important;
    max-width: none !important;
    max-height: calc(100vh - 32px) !important;
    color: var(--orbit-ink) !important;
    background:
      radial-gradient(circle at 92% -18%, rgba(96,165,250,.20), transparent 42%),
      linear-gradient(145deg, #FFFFFF, #EFF7FF) !important;
    border-color: var(--orbit-line-strong) !important;
    box-shadow: 0 36px 100px rgba(37,78,128,.24), inset 0 1px 0 #FFFFFF !important;
    -webkit-backdrop-filter: blur(32px) saturate(1.08) !important;
    backdrop-filter: blur(32px) saturate(1.08) !important;
  }

  html[data-cs-orbit-internal] [data-cs-llgan-glass="chip"],
  html[data-cs-orbit-internal] [data-cs-llgan-glass="input"],
  html[data-cs-orbit-internal] [data-cs-healthos-component="filter-chip"],
  html[data-cs-orbit-internal] [data-cs-healthos-component="tab"],
  html[data-cs-orbit-internal] [data-cs-healthos-component="filter-select"] {
    color: var(--orbit-ink) !important;
    background: linear-gradient(145deg, #FFFFFF, #EAF4FF) !important;
    border-color: var(--orbit-line) !important;
    box-shadow: none !important;
  }

  html[data-cs-orbit-internal] input,
  html[data-cs-orbit-internal] textarea,
  html[data-cs-orbit-internal] select {
    color: var(--orbit-ink) !important;
    caret-color: var(--orbit-blue);
    background-color: #FFFFFF !important;
  }

  html[data-cs-orbit-internal] input::placeholder,
  html[data-cs-orbit-internal] textarea::placeholder {
    color: #7A8DA3 !important;
    opacity: 1;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-page="surface"] *,
  html[data-cs-orbit-internal] [data-cs-healthos-component="modal"] *,
  html[data-cs-orbit-internal] [data-cs-llgan-glass] * {
    color: var(--orbit-ink) !important;
  }

  html[data-cs-orbit-internal] a,
  html[data-cs-orbit-internal] [role="link"] {
    color: var(--orbit-blue) !important;
  }

  /*
   * ORBIT action controls
   *
   * Button surfaces must be styled only on the interactive root. Applying a
   * background to every descendant produces the visible "button in button"
   * defect on React Native Web because Text and icon wrappers become separate
   * blue rectangles.
   */
  html[data-cs-orbit-internal] [data-cs-healthos-component="button"],
  html[data-cs-orbit-internal] [data-cs-llgan-glass="button"] {
    box-sizing: border-box !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
    height: 44px !important;
    min-height: 44px !important;
    max-height: 44px !important;
    padding: 0 16px !important;
    vertical-align: middle !important;
    border: 1px solid rgba(5,108,232,.24) !important;
    border-radius: 14px !important;
    color: #075DBF !important;
    background: linear-gradient(145deg, rgba(255,255,255,.99), rgba(237,246,255,.98)) !important;
    box-shadow:
      0 7px 18px rgba(37,78,128,.10),
      inset 0 1px 0 rgba(255,255,255,.96) !important;
    font-size: 15px !important;
    font-weight: 700 !important;
    line-height: 20px !important;
    letter-spacing: -.01em !important;
    overflow: hidden !important;
    transform: translateY(0);
    transition:
      transform 150ms ease,
      border-color 150ms ease,
      background 150ms ease,
      box-shadow 150ms ease,
      opacity 150ms ease !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="button"] *,
  html[data-cs-orbit-internal] [data-cs-llgan-glass="button"] * {
    color: inherit !important;
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    font-size: inherit !important;
    font-weight: inherit !important;
    line-height: inherit !important;
    letter-spacing: inherit !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="button"]:hover,
  html[data-cs-orbit-internal] [data-cs-llgan-glass="button"]:hover {
    border-color: rgba(5,108,232,.42) !important;
    background: linear-gradient(145deg, #FFFFFF, #E5F1FF) !important;
    box-shadow:
      0 10px 24px rgba(37,78,128,.14),
      inset 0 1px 0 #FFFFFF !important;
    transform: translateY(-1px);
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="button"]:active,
  html[data-cs-orbit-internal] [data-cs-llgan-glass="button"]:active {
    box-shadow:
      0 4px 12px rgba(37,78,128,.10),
      inset 0 1px 0 rgba(255,255,255,.92) !important;
    transform: translateY(0) scale(.99);
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="button"]:focus-visible,
  html[data-cs-orbit-internal] [data-cs-llgan-glass="button"]:focus-visible {
    outline: 3px solid rgba(22,131,255,.24) !important;
    outline-offset: 2px !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="button"][data-cs-healthos-variant="primary"] {
    color: #FFFFFF !important;
    border-color: rgba(0,80,188,.42) !important;
    background: linear-gradient(135deg, #0878EE 0%, #0566D6 56%, #045ABD 100%) !important;
    box-shadow:
      0 9px 22px rgba(5,102,214,.22),
      inset 0 1px 0 rgba(255,255,255,.24) !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="button"][data-cs-healthos-variant="primary"] * {
    color: #FFFFFF !important;
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="button"][data-cs-healthos-variant="primary"]:hover {
    border-color: rgba(0,72,168,.52) !important;
    background: linear-gradient(135deg, #1284F5 0%, #086DDE 58%, #055DC3 100%) !important;
    box-shadow:
      0 12px 28px rgba(5,102,214,.28),
      inset 0 1px 0 rgba(255,255,255,.28) !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="button"][aria-disabled="true"],
  html[data-cs-orbit-internal] [data-cs-healthos-component="button"]:disabled,
  html[data-cs-orbit-internal] [data-cs-llgan-glass="button"][aria-disabled="true"],
  html[data-cs-orbit-internal] [data-cs-llgan-glass="button"]:disabled {
    cursor: not-allowed !important;
    opacity: .48 !important;
    box-shadow: none !important;
    transform: none !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="button"] [data-cs-llgan-glass],
  html[data-cs-orbit-internal] [data-cs-llgan-glass="button"] [data-cs-healthos-component="button"] {
    box-sizing: border-box !important;
    width: auto !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    color: inherit !important;
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
    overflow: visible !important;
    transform: none !important;
    transition: none !important;
  }

  html[data-cs-orbit-internal] [data-cs-healthos-component="button"] [data-cs-llgan-glass]:hover,
  html[data-cs-orbit-internal] [data-cs-healthos-component="button"] [data-cs-llgan-glass]:active,
  html[data-cs-orbit-internal] [data-cs-llgan-glass="button"] [data-cs-healthos-component="button"]:hover,
  html[data-cs-orbit-internal] [data-cs-llgan-glass="button"] [data-cs-healthos-component="button"]:active {
    border: 0 !important;
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    transform: none !important;
  }

  html[data-cs-orbit-internal] [aria-selected="true"] {
    border-color: rgba(5,108,232,.44) !important;
    background-color: rgba(5,108,232,.10) !important;
  }

  @media (max-width: 900px) {
    html[data-cs-orbit-internal] [data-cs-healthos-component="modal"] {
      width: calc(100vw - 16px) !important;
      max-height: calc(100vh - 16px) !important;
      border-radius: 20px !important;
    }

    html[data-cs-orbit-internal] [role="tablist"] {
      overflow-x: auto !important;
      scroll-snap-type: x proximity;
    }

    html[data-cs-orbit-internal] [role="tab"] {
      flex: 0 0 auto !important;
      scroll-snap-align: start;
    }
  }
`;
