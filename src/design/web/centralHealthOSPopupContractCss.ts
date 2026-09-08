/** Desktop chrome remains navy; work surfaces use the same light contrast as portals. */
export const CENTRAL_HEALTHOS_POPUP_CONTRACT_CSS = `
  html[data-cs-central-popup] { color-scheme: light; }
  html[data-cs-central-popup] [data-cs-central-popup-workspace="true"] {
    width: 100%; min-width: 0; min-height: 0;
    background: #F2F6FC !important; color: #102B49;
  }
  html[data-cs-central-popup] [data-cs-central-popup-page-header="true"] {
    background: linear-gradient(118deg, #FFFFFF, #EEF6FF) !important;
    border-bottom: 1px solid #CCDBEA !important;
    box-shadow: none !important;
  }
  html [data-cs-desktop-surface="light"],
  html [data-cs-desktop-surface="light"][data-cs-healthos-page="surface"] {
    color-scheme: light; color: #102B49;
    background: #F2F6FC !important;
    border-color: #CCDBEA !important;
    box-shadow: none !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    min-width: 0; min-height: 0;
  }
  html [data-cs-desktop-surface="light"] :is(
    [data-cs-healthos-component="list-overview"], [data-cs-healthos-component="section"],
    [data-cs-healthos-component="table"], [data-cs-healthos-component="card"],
    [data-cs-healthos-component="interactive-card"], [data-cs-healthos-component="kpi-card"],
    [data-cs-healthos-component="module-tile"], [data-cs-healthos-component="screen-header"]
  ) {
    color: #102B49; background: #FFFFFF !important;
    border-color: #CCDBEA !important;
    box-shadow: 0 6px 20px rgba(16,43,73,.06) !important;
    min-width: 0; max-width: 100%;
  }
  html [data-cs-desktop-surface="light"] [data-cs-healthos-component="screen-header"]::after { display: none; }
  html [data-cs-desktop-surface="light"] [data-cs-llgan-glass] {
    --cs-glass-panel: #FFFFFF; --cs-glass-card: #FFFFFF; --cs-glass-control: #F0F6FE;
    --cs-glass-border: #CCDBEA; --cs-glass-border-strong: #9EBBD7;
    color: #102B49; background: #FFFFFF !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
  }
  html [data-cs-desktop-surface="light"] [data-cs-llgan-glass] :is([style*="color: rgb(0, 0, 0)"], [style*="color: rgba(0, 0, 0"]) {
    color: #102B49 !important;
  }
  html [data-cs-desktop-surface="light"] :is(input, textarea, select) {
    color: #102B49 !important; -webkit-text-fill-color: #102B49 !important;
    caret-color: #056CE8; background: #FFFFFF !important;
    border-color: #9EBBD7 !important;
  }
  html [data-cs-desktop-surface="light"] :is(input, textarea)::placeholder {
    color: #526B82 !important; -webkit-text-fill-color: #526B82 !important; opacity: 1;
  }
  html [data-cs-desktop-surface="light"] :is(input, textarea, select):focus-visible,
  html [data-cs-desktop-surface="light"] [role="button"]:focus-visible {
    outline: 3px solid #1477D6 !important; outline-offset: 3px;
  }
  html [data-cs-desktop-surface="light"] :is(
    [data-cs-healthos-component="filter-chip"], [data-cs-healthos-component="tab"],
    [data-cs-healthos-component="filter-select"]
  ) { background: #F0F6FE !important; color: #075EB8; border-color: #B8D1EA !important; }
  html [data-cs-desktop-surface="light"] [aria-selected="true"] {
    border-color: #1477D6 !important;
  }
  html [data-cs-desktop-surface="light"] [data-cs-healthos-component="list-row"]:hover {
    background: #EDF5FF !important; transform: none;
  }
  html [data-cs-desktop-surface="light"] [data-cs-healthos-component="button"] {
    box-shadow: none !important;
  }
  html [data-cs-desktop-surface="light"] [data-cs-healthos-component="button"][data-cs-healthos-variant="primary"] *,
  html [data-cs-desktop-surface="light"] [data-cs-healthos-component="button"][data-cs-healthos-variant="danger"] * {
    color: #FFFFFF !important;
  }
  html [data-cs-desktop-surface="light"] [data-cs-healthos-component="button"][data-cs-healthos-variant="secondary"] *,
  html [data-cs-desktop-surface="light"] [data-cs-healthos-component="button"][data-cs-healthos-variant="ghost"] * {
    color: #075EB8 !important;
  }
  html [data-cs-desktop-surface="light"] [data-cs-healthos-zone] { min-width: 0; }
  html [data-cs-desktop-surface="light"] :is([data-cs-healthos-zone="actions"], [data-cs-healthos-zone="filters"], [data-cs-healthos-zone="tabs"]) {
    flex-wrap: wrap; gap: 12px;
  }
  html [data-cs-desktop-surface="light"] :is([data-cs-healthos-zone="actions"], [data-cs-healthos-zone="filters"], [data-cs-healthos-zone="tabs"]) > * { max-width: 100%; }
  html [data-cs-healthos-component="modal"][data-cs-desktop-surface="light"] {
    background: #FFFFFF !important; border-color: #B8D1EA !important;
    box-shadow: 0 24px 90px rgba(8,24,45,.3) !important;
  }
  @media (prefers-reduced-motion: reduce) {
    html [data-cs-desktop-surface="light"] * { animation: none !important; transition: none !important; }
  }

  /* Explicit inverse controls retain their own contrast; the page remains light. */
  html[data-cs-central-popup] [data-cs-healthos-component="input"][data-cs-healthos-surface="dark"],
  html[data-cs-central-popup] [data-cs-healthos-component="input"][data-cs-healthos-surface="dark"] * {
    color: #F8FBFF !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-surface="dark"] input,
  html[data-cs-central-popup] [data-cs-healthos-surface="dark"] textarea,
  html[data-cs-central-popup] [data-cs-healthos-surface="dark"] select,
  html[data-cs-central-popup] input[data-cs-healthos-surface="dark"],
  html[data-cs-central-popup] textarea[data-cs-healthos-surface="dark"],
  html[data-cs-central-popup] select[data-cs-healthos-surface="dark"] {
    color: #FFFFFF !important;
    -webkit-text-fill-color: #FFFFFF !important;
    caret-color: #78DCFF !important;
    background-color: #071A31 !important;
    border-color: rgba(119, 207, 250, .64) !important;
    opacity: 1 !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-surface="dark"] input::placeholder,
  html[data-cs-central-popup] [data-cs-healthos-surface="dark"] textarea::placeholder,
  html[data-cs-central-popup] input[data-cs-healthos-surface="dark"]::placeholder,
  html[data-cs-central-popup] textarea[data-cs-healthos-surface="dark"]::placeholder {
    color: #BFD8EB !important;
    -webkit-text-fill-color: #BFD8EB !important;
    opacity: 1 !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-component="info-banner"][data-cs-healthos-surface="dark"],
  html[data-cs-central-popup] [data-cs-healthos-component="info-banner"][data-cs-healthos-surface="dark"] * {
    color: #F8FBFF !important;
  }

  html [data-cs-desktop-surface="light"] :is(input, textarea, select),
  html [data-cs-support-surface="light"] :is(input, textarea, select) {
    font-size: calc(16px * var(--app-font-scale, 1)) !important;
    line-height: 1.5 !important; min-height: 44px; max-width: 100%; box-sizing: border-box;
  }
  html [data-cs-desktop-surface="light"] :is([role="button"], [role="tab"]),
  html [data-cs-support-surface="light"] [role="button"] {
    overflow-wrap: anywhere;
  }
  html [data-cs-desktop-surface="light"] :is([role="table"], [role="row"], [role="cell"]),
  html [data-cs-support-surface="light"] { min-width: 0; }
  html [data-cs-desktop-surface="light"] :is([role="button"], [role="tab"]):focus-visible,
  html [data-cs-support-surface="light"] [role="button"]:focus-visible {
    outline: 3px solid #1477D6 !important; outline-offset: 3px;
  }
  @media (max-height: 650px) {
    html [data-cs-desktop-surface="light"] [data-cs-central-popup-page-header="true"] {
      min-height: 60px !important; padding-top: 8px !important; padding-bottom: 8px !important;
    }
  }
`;
