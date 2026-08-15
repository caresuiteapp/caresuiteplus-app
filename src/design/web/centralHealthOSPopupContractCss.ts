/**
 * One visual contract for every internal page opened from the central widget
 * desktop. It is intentionally loaded after the former ORBIT contract and is
 * scoped to the runtime popup attribute so public pages and portals stay intact.
 */
export const CENTRAL_HEALTHOS_POPUP_CONTRACT_CSS = `
  html[data-cs-central-popup] {
    color-scheme: dark;
    --central-night: #020B1B;
    --central-panel: rgba(8, 25, 49, .91);
    --central-panel-strong: rgba(5, 18, 39, .97);
    --central-card: rgba(12, 35, 65, .86);
    --central-card-hover: rgba(16, 48, 84, .94);
    --central-line: rgba(117, 211, 255, .28);
    --central-line-strong: rgba(117, 218, 255, .62);
    --central-text: #F5FAFF;
    --central-copy: #C5DDF3;
    --central-muted: #8EAAC4;
    --central-cyan: #78DCFF;
    --central-blue: #389CFF;
  }

  html[data-cs-central-popup],
  html[data-cs-central-popup] body,
  html[data-cs-central-popup] #root,
  html[data-cs-central-popup] #expo-root,
  html[data-cs-central-popup] [data-expo-root] {
    background:
      radial-gradient(circle at 84% 4%, rgba(40, 151, 255, .17), transparent 31%),
      radial-gradient(circle at 8% 92%, rgba(78, 216, 255, .10), transparent 29%),
      linear-gradient(145deg, #020A19, #071A35 54%, #020B1B) !important;
    color: var(--central-text) !important;
  }

  html[data-cs-central-popup] body::before,
  html[data-cs-central-popup] body::after {
    border-color: rgba(110, 217, 255, .13) !important;
    box-shadow: 0 0 120px rgba(63, 183, 255, .11), inset 0 0 90px rgba(75, 218, 255, .05) !important;
  }

  html[data-cs-central-popup] [data-cs-central-popup-workspace="true"] {
    width: 100%;
    min-width: 0;
    min-height: 100%;
    color: var(--central-text) !important;
    background:
      radial-gradient(circle at 91% -20%, rgba(82, 190, 255, .18), transparent 38%),
      linear-gradient(145deg, rgba(10, 31, 59, .96), rgba(3, 14, 32, .98)) !important;
  }

  html[data-cs-central-popup] [data-cs-central-popup-page-header="true"] {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 88% -50%, rgba(87, 205, 255, .27), transparent 45%),
      linear-gradient(118deg, rgba(15, 45, 80, .96), rgba(5, 20, 43, .96)) !important;
    border-bottom: 1px solid var(--central-line) !important;
    box-shadow: 0 16px 42px rgba(0, 6, 20, .30) !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-page="surface"],
  html[data-cs-central-popup] [data-cs-healthos-component="list-overview"],
  html[data-cs-central-popup] [data-cs-healthos-component="section"],
  html[data-cs-central-popup] [data-cs-healthos-component="table"],
  html[data-cs-central-popup] [data-cs-healthos-component="modal"],
  html[data-cs-central-popup] .cs-llgan-glass,
  html[data-cs-central-popup] [data-cs-llgan-glass] {
    --cs-glass-panel: var(--central-panel);
    --cs-glass-card: var(--central-card);
    --cs-glass-control: rgba(255, 255, 255, .075);
    --cs-glass-border: var(--central-line);
    --cs-glass-border-strong: var(--central-line-strong);
    color: var(--central-text) !important;
    background-color: var(--central-panel-strong) !important;
    background-image:
      radial-gradient(circle at 91% -24%, rgba(85, 204, 255, .19), transparent 42%),
      linear-gradient(145deg, rgba(14, 42, 76, .94), rgba(5, 18, 39, .97)) !important;
    border-color: var(--central-line) !important;
    box-shadow:
      0 24px 64px rgba(0, 5, 18, .42),
      0 0 30px rgba(84, 205, 255, .06),
      inset 0 1px 0 rgba(255, 255, 255, .16) !important;
    -webkit-backdrop-filter: blur(30px) saturate(1.3) !important;
    backdrop-filter: blur(30px) saturate(1.3) !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-component="card"],
  html[data-cs-central-popup] [data-cs-healthos-component="interactive-card"],
  html[data-cs-central-popup] [data-cs-healthos-component="kpi-card"],
  html[data-cs-central-popup] [data-cs-healthos-component="module-tile"] {
    color: var(--central-text) !important;
    background-color: var(--central-card) !important;
    background-image:
      radial-gradient(circle at 91% -22%, rgba(89, 207, 255, .21), transparent 43%),
      linear-gradient(145deg, rgba(17, 48, 84, .92), rgba(6, 21, 43, .96)) !important;
    border-color: var(--central-line) !important;
    box-shadow: 0 18px 46px rgba(0, 6, 20, .38), inset 0 1px 0 rgba(255, 255, 255, .14) !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-component="card"] > div:first-child,
  html[data-cs-central-popup] [data-cs-healthos-component="interactive-card"] > div:first-child {
    background-color: transparent !important;
    background-image: linear-gradient(145deg, rgba(18, 51, 89, .90), rgba(5, 20, 42, .96)) !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-component="interactive-card"]:hover,
  html[data-cs-central-popup] [data-cs-healthos-component="module-tile"]:hover {
    transform: translateY(-3px);
    background-color: var(--central-card-hover) !important;
    border-color: var(--central-line-strong) !important;
    box-shadow: 0 26px 64px rgba(0, 6, 20, .48), 0 0 30px rgba(82, 207, 255, .14) !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-component="screen-header"] {
    color: var(--central-text) !important;
    background: linear-gradient(118deg, rgba(15, 45, 80, .96), rgba(5, 20, 43, .97)) !important;
    border-color: var(--central-line) !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-component="screen-header"]::after {
    content: 'HEALTHOS';
    color: rgba(117, 218, 255, .27);
  }

  html[data-cs-central-popup] [data-cs-healthos-component="filter-chip"],
  html[data-cs-central-popup] [data-cs-healthos-component="tab"],
  html[data-cs-central-popup] [data-cs-healthos-component="filter-select"],
  html[data-cs-central-popup] [data-cs-healthos-component="input"],
  html[data-cs-central-popup] [data-cs-llgan-glass="chip"],
  html[data-cs-central-popup] [data-cs-llgan-glass="input"],
  html[data-cs-central-popup] [data-cs-llgan-glass="button"] {
    color: var(--central-copy) !important;
    background-color: rgba(255, 255, 255, .07) !important;
    background-image: linear-gradient(145deg, rgba(255, 255, 255, .09), rgba(83, 210, 255, .045)) !important;
    border-color: var(--central-line) !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .10) !important;
  }

  html[data-cs-central-popup] [aria-selected="true"] {
    color: #FFFFFF !important;
    background-color: rgba(54, 154, 255, .22) !important;
    border-color: rgba(105, 218, 255, .64) !important;
    box-shadow: 0 0 22px rgba(73, 201, 255, .12) !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-component="list-row"] {
    color: var(--central-copy) !important;
    background-color: rgba(255, 255, 255, .035) !important;
    border-color: rgba(118, 211, 255, .12) !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-component="list-row"]:hover {
    background-color: rgba(70, 173, 255, .12) !important;
    border-color: rgba(112, 215, 255, .38) !important;
  }

  html[data-cs-central-popup] input,
  html[data-cs-central-popup] textarea,
  html[data-cs-central-popup] select {
    color: var(--central-text) !important;
    caret-color: var(--central-cyan) !important;
    background-color: rgba(2, 13, 30, .68) !important;
    border-color: var(--central-line) !important;
  }

  html[data-cs-central-popup] input::placeholder,
  html[data-cs-central-popup] textarea::placeholder {
    color: var(--central-muted) !important;
    opacity: 1 !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-component="button"][data-cs-healthos-variant="secondary"],
  html[data-cs-central-popup] [data-cs-healthos-component="button"][data-cs-healthos-variant="ghost"] {
    color: var(--central-cyan) !important;
    background-color: rgba(68, 178, 255, .10) !important;
    border-color: rgba(105, 213, 255, .30) !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-component="button"][data-cs-healthos-variant="primary"],
  html[data-cs-central-popup] [data-cs-healthos-component="button"][data-cs-healthos-variant="danger"],
  html[data-cs-central-popup] [data-cs-healthos-component="button"][data-cs-healthos-variant="primary"] *,
  html[data-cs-central-popup] [data-cs-healthos-component="button"][data-cs-healthos-variant="danger"] * {
    color: #FFFFFF !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-component="button"][data-cs-healthos-variant="secondary"] *,
  html[data-cs-central-popup] [data-cs-healthos-component="button"][data-cs-healthos-variant="ghost"] *,
  html[data-cs-central-popup] a,
  html[data-cs-central-popup] [role="link"] {
    color: var(--central-cyan) !important;
  }

  html[data-cs-central-popup] [data-cs-central-popup-workspace="true"] [style*="color: rgb(11, 18, 32)"],
  html[data-cs-central-popup] [data-cs-central-popup-workspace="true"] [style*="color: rgb(15, 23, 42)"],
  html[data-cs-central-popup] [data-cs-central-popup-workspace="true"] [style*="color: rgb(30, 41, 59)"],
  html[data-cs-central-popup] [data-cs-central-popup-workspace="true"] [style*="color: rgb(51, 65, 85)"],
  html[data-cs-central-popup] [data-cs-central-popup-workspace="true"] [style*="color: rgb(0, 0, 0)"] {
    color: var(--central-text) !important;
  }

  html[data-cs-central-popup] [data-cs-central-popup-workspace="true"] [style*="color: rgb(100, 116, 139)"],
  html[data-cs-central-popup] [data-cs-central-popup-workspace="true"] [style*="color: rgb(122, 141, 163)"] {
    color: var(--central-muted) !important;
  }

  html[data-cs-central-popup] [data-cs-healthos-zone="content"] [style*="background-color: rgb(255, 255, 255)"],
  html[data-cs-central-popup] [data-cs-healthos-zone="content"] [style*="background-color: rgba(255, 255, 255"] {
    background-color: rgba(12, 35, 65, .84) !important;
    border-color: var(--central-line) !important;
  }

  @media (max-width: 780px) {
    html[data-cs-central-popup] [data-cs-central-popup-page-header="true"] {
      min-height: 66px !important;
    }

    html[data-cs-central-popup] [data-cs-healthos-component="section"],
    html[data-cs-central-popup] [data-cs-healthos-component="card"],
    html[data-cs-central-popup] [data-cs-healthos-component="interactive-card"],
    html[data-cs-central-popup] [data-cs-healthos-component="table"] {
      border-radius: 18px !important;
    }
  }
`;
