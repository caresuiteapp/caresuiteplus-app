/**
 * Web fallback for legacy controls rendered inside the canonical HealthOS
 * work surface. Component tokens remain the primary source of truth; these
 * rules prevent old inline light-world colours from making controls unreadable
 * while screens are migrated to the shared page architecture.
 */
export const HEALTHOS_PAGE_CONTRACT_CSS = `
  :root {
    --cs-healthos-night: #071225;
    --cs-healthos-navy: #0B1B35;
    --cs-healthos-blue: #69E8FF;
    --cs-healthos-white: #FFFFFF;
    --cs-healthos-glass: rgba(12, 30, 57, .72);
    --cs-healthos-glass-strong: rgba(10, 27, 52, .90);
    --cs-healthos-line: rgba(105, 232, 255, .34);
    --cs-healthos-line-soft: rgba(255, 255, 255, .13);
    --cs-healthos-shadow: 0 30px 90px rgba(0, 7, 22, .54);
  }

  html, body, #root, #expo-root, [data-expo-root] {
    min-height: 100%;
    background:
      radial-gradient(circle at 7% 8%, rgba(105,232,255,.19), transparent 27%),
      radial-gradient(circle at 92% 4%, rgba(105,232,255,.11), transparent 24%),
      radial-gradient(circle at 52% 112%, rgba(105,232,255,.10), transparent 34%),
      linear-gradient(145deg, #071225 0%, #0B1B35 48%, #071225 100%) !important;
    background-attachment: fixed !important;
  }

  body::before,
  body::after {
    content: '';
    position: fixed;
    pointer-events: none;
    z-index: 0;
    border-radius: 999px;
    filter: blur(2px);
  }

  body::before {
    width: min(42vw, 720px);
    height: min(42vw, 720px);
    left: -18vw;
    top: 22vh;
    border: 1px solid rgba(105,232,255,.16);
    box-shadow:
      0 0 110px rgba(105,232,255,.10),
      inset 0 0 90px rgba(105,232,255,.06);
  }

  body::after {
    width: min(34vw, 560px);
    height: min(34vw, 560px);
    right: -14vw;
    bottom: -12vh;
    border: 1px solid rgba(255,255,255,.10);
    box-shadow:
      0 0 130px rgba(105,232,255,.12),
      inset 0 0 100px rgba(105,232,255,.05);
  }

  #root, #expo-root, [data-expo-root] {
    position: relative;
    z-index: 1;
  }

  [data-cs-healthos-page="surface"] {
    color: var(--cs-white);
    isolation: isolate;
    position: relative;
    background:
      radial-gradient(circle at 92% -18%, rgba(105,232,255,.22), transparent 34%),
      radial-gradient(circle at -8% 108%, rgba(105,232,255,.10), transparent 35%),
      linear-gradient(145deg, rgba(15,38,70,.90), rgba(7,20,42,.93)) !important;
    border: 1px solid rgba(105,232,255,.34) !important;
    box-shadow:
      var(--cs-healthos-shadow),
      inset 0 1px 0 rgba(255,255,255,.20),
      inset 0 -1px 0 rgba(105,232,255,.08) !important;
    backdrop-filter: blur(34px) saturate(1.35) !important;
    -webkit-backdrop-filter: blur(34px) saturate(1.35) !important;
  }

  [data-cs-healthos-page="surface"]::before {
    content: '';
    position: absolute;
    z-index: 0;
    top: 0;
    left: 4%;
    right: 4%;
    height: 2px;
    border-radius: 0 0 999px 999px;
    background: linear-gradient(90deg, transparent, rgba(105,232,255,.98), transparent);
    box-shadow: 0 0 24px rgba(105,232,255,.70);
    pointer-events: none;
  }

  [data-cs-healthos-page="surface"] *,
  [data-cs-healthos-component="modal"] * {
    box-sizing: border-box;
  }

  [data-testid="shell-app-bar"],
  [data-testid="portal-mobile-tab-header"],
  [data-testid="main-work-area"] > [data-cs-healthos-page="surface"] {
    border-color: rgba(105,232,255,.30) !important;
  }

  [data-cs-healthos-component="screen-header"] {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 86% 0%, rgba(105,232,255,.18), transparent 36%),
      linear-gradient(105deg, rgba(7,20,42,.96), rgba(14,40,72,.91)) !important;
    border-bottom: 1px solid rgba(105,232,255,.32) !important;
    box-shadow: 0 18px 44px rgba(0,8,24,.24);
  }

  [data-cs-healthos-component="screen-header"]::after {
    content: 'HEALTHOS';
    position: absolute;
    right: 22px;
    bottom: 9px;
    color: rgba(105,232,255,.30);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .26em;
    pointer-events: none;
  }

  [data-cs-healthos-page="surface"] input,
  [data-cs-healthos-page="surface"] textarea,
  [data-cs-healthos-page="surface"] select {
    color: #F8F6FF !important;
    caret-color: #69E8FF;
  }

  [data-cs-healthos-page="surface"] input::placeholder,
  [data-cs-healthos-page="surface"] textarea::placeholder {
    color: rgba(248, 246, 255, .62) !important;
    opacity: 1;
  }

  [data-cs-healthos-page="surface"] input:focus,
  [data-cs-healthos-page="surface"] textarea:focus,
  [data-cs-healthos-page="surface"] select:focus {
    border-color: rgba(105,232,255,.78) !important;
    outline: 3px solid rgba(105,232,255,.14);
    outline-offset: 1px;
    box-shadow:
      0 0 0 1px rgba(105,232,255,.30),
      0 12px 34px rgba(0,8,24,.28) !important;
  }

  [data-cs-healthos-zone="actions"],
  [data-cs-healthos-zone="filters"],
  [data-cs-healthos-zone="tabs"] {
    width: 100%;
    min-width: 0;
    gap: 12px;
  }

  [data-cs-healthos-page="surface"] [role="tab"],
  [data-cs-healthos-page="surface"] [role="button"] {
    min-height: 40px;
  }

  [data-cs-healthos-component="list-overview"],
  [data-cs-healthos-component="section"] {
    width: 100% !important;
    min-width: 0 !important;
    position: relative;
    background:
      radial-gradient(circle at 88% -25%, rgba(105,232,255,.17), transparent 38%),
      linear-gradient(145deg, rgba(18,46,82,.90), rgba(8,24,48,.93)) !important;
    border: 1px solid rgba(105,232,255,.27) !important;
    border-radius: 24px !important;
    box-shadow:
      0 24px 58px rgba(0,8,24,.38),
      inset 0 1px 0 rgba(255,255,255,.16) !important;
  }

  [data-cs-healthos-component="card"],
  [data-cs-healthos-component="interactive-card"],
  [data-cs-healthos-component="kpi-card"],
  [data-cs-healthos-component="module-tile"] {
    min-width: 0;
    background:
      radial-gradient(circle at 92% -20%, rgba(105,232,255,.20), transparent 42%),
      linear-gradient(145deg, rgba(19,48,84,.84), rgba(8,23,46,.92)) !important;
    border-color: rgba(105,232,255,.30) !important;
    box-shadow:
      0 18px 46px rgba(0,7,22,.38),
      inset 0 1px 0 rgba(255,255,255,.17) !important;
    transition:
      transform .22s ease,
      border-color .22s ease,
      box-shadow .22s ease,
      background .22s ease;
  }

  [data-cs-healthos-component="interactive-card"] {
    cursor: pointer;
  }

  [data-cs-healthos-component="module-tile"] {
    min-height: 118px !important;
    border-radius: 22px !important;
  }

  [data-cs-healthos-component="interactive-card"]:focus-within,
  [data-cs-healthos-component="interactive-card"]:hover,
  [data-cs-healthos-component="module-tile"]:hover {
    transform: translateY(-3px);
    border-color: rgba(105,232,255,.82) !important;
    background:
      radial-gradient(circle at 86% -10%, rgba(105,232,255,.30), transparent 44%),
      linear-gradient(145deg, rgba(23,58,99,.92), rgba(9,27,53,.96)) !important;
    box-shadow:
      0 26px 66px rgba(0,7,22,.48),
      0 0 32px rgba(105,232,255,.14),
      inset 0 1px 0 rgba(255,255,255,.20) !important;
  }

  [data-cs-healthos-component="button"] {
    flex-shrink: 0;
    border-color: rgba(105,232,255,.42) !important;
    box-shadow:
      0 12px 30px rgba(0,8,24,.32),
      inset 0 1px 0 rgba(255,255,255,.20) !important;
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
  }

  [data-cs-healthos-component="button"]:hover {
    transform: translateY(-2px);
    border-color: rgba(105,232,255,.88) !important;
    box-shadow:
      0 18px 38px rgba(0,8,24,.38),
      0 0 24px rgba(105,232,255,.18),
      inset 0 1px 0 rgba(255,255,255,.22) !important;
  }

  [data-cs-healthos-component="filter-chip"],
  [data-cs-healthos-component="tab"],
  [data-cs-healthos-component="filter-select"] {
    min-height: 40px;
    border-color: rgba(105,232,255,.24) !important;
    background:
      linear-gradient(145deg, rgba(255,255,255,.10), rgba(105,232,255,.055)) !important;
  }

  [data-cs-healthos-component="table"] {
    width: 100% !important;
    min-width: 0;
    overflow: hidden;
    border-radius: 22px !important;
    background:
      linear-gradient(145deg, rgba(15,39,71,.90), rgba(7,22,44,.94)) !important;
    border: 1px solid rgba(105,232,255,.24) !important;
    box-shadow:
      0 22px 52px rgba(0,8,24,.34),
      inset 0 1px 0 rgba(255,255,255,.12) !important;
  }

  [data-cs-healthos-component="list-row"] {
    border-color: rgba(105,232,255,.14) !important;
    transition: background .18s ease, border-color .18s ease, transform .18s ease;
  }

  [data-cs-healthos-component="list-row"]:hover {
    background: rgba(105,232,255,.075) !important;
    border-color: rgba(105,232,255,.36) !important;
    transform: translateX(3px);
  }

  [data-cs-healthos-component="modal"] {
    isolation: isolate;
    background:
      radial-gradient(circle at 88% -12%, rgba(105,232,255,.24), transparent 38%),
      linear-gradient(145deg, rgba(16,42,76,.98), rgba(6,19,39,.99)) !important;
    border: 1px solid rgba(105,232,255,.42) !important;
    box-shadow:
      0 36px 120px rgba(0,5,18,.70),
      0 0 48px rgba(105,232,255,.11),
      inset 0 1px 0 rgba(255,255,255,.18) !important;
    backdrop-filter: blur(42px) saturate(1.35) !important;
    -webkit-backdrop-filter: blur(42px) saturate(1.35) !important;
  }

  @media (max-width: 767px) {
    body::before,
    body::after {
      opacity: .55;
    }

    [data-cs-healthos-page="surface"] {
      border-radius: 20px !important;
    }

    [data-cs-healthos-component="list-overview"],
    [data-cs-healthos-component="section"] {
      border-radius: 16px !important;
    }

    [data-cs-healthos-zone="actions"] > *,
    [data-cs-healthos-zone="filters"] > *,
    [data-cs-healthos-zone="tabs"] > * {
      max-width: 100%;
    }

    [data-cs-healthos-component="screen-header"]::after {
      display: none;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    [data-cs-healthos-page="surface"]::before {
      animation: cs-healthos-rail 5.5s ease-in-out infinite;
    }
  }

  @keyframes cs-healthos-rail {
    0%, 100% { opacity: .48; transform: scaleX(.72); }
    50% { opacity: 1; transform: scaleX(1); }
  }
`;
