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
   * Text-only bridge for the canonical ORBIT button component.
   * All geometry, surfaces, borders, shadows and states live in
   * PremiumButton.tsx; global CSS must never paint a button wrapper again.
   */
  html[data-cs-orbit-internal] [data-cs-orbit-button="root"][data-cs-healthos-variant="primary"],
  html[data-cs-orbit-internal] [data-cs-orbit-button="root"][data-cs-healthos-variant="primary"] *,
  html[data-cs-orbit-internal] [data-cs-orbit-button="root"][data-cs-healthos-variant="danger"],
  html[data-cs-orbit-internal] [data-cs-orbit-button="root"][data-cs-healthos-variant="danger"] * {
    color: #FFFFFF !important;
  }

  html[data-cs-orbit-internal] [data-cs-orbit-button="root"][data-cs-healthos-variant="secondary"],
  html[data-cs-orbit-internal] [data-cs-orbit-button="root"][data-cs-healthos-variant="secondary"] * {
    color: #075DBF !important;
  }

  html[data-cs-orbit-internal] [data-cs-orbit-button="root"][data-cs-healthos-variant="ghost"],
  html[data-cs-orbit-internal] [data-cs-orbit-button="root"][data-cs-healthos-variant="ghost"] * {
    color: #334155 !important;
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
