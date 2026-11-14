import { desktopGridMetrics } from '../navigation/desktopLayoutModel';

/** Keep sidebar motion, track widths and artwork height in the same browser layout pass. */
export function desktopWorkspaceCss(fontScale: number, mobile = false) {
  const { scale, gap, minimum, labelHeight, artworkMinHeight, artworkInset } = desktopGridMetrics(fontScale, mobile, false);
  const minCardHeight = labelHeight + artworkMinHeight + artworkInset + 2;
  const threshold = (columns: number) => columns * minimum + (columns - 1) * gap;
  return `
    [data-cs-desktop-header] {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr) max-content;
      align-items: center;
      gap: 8px;
    }
    [data-cs-desktop-header="wide"] {
      grid-template-columns: max-content minmax(290px, 440px) max-content;
      justify-content: space-between;
      gap: 14px;
    }
    [data-cs-desktop-header="stacked"] {
      grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    }
    [data-cs-desktop-header="stacked"] [data-testid="desktop-topbar-actions"] {
      grid-row: 2;
      grid-column: 1 / -1;
    }
    [data-cs-desktop-header="stacked"] [data-testid="desktop-clock-weather"] {
      grid-row: 1;
      grid-column: 2;
    }
    [data-cs-desktop-header="phone"] {
      grid-template-columns: minmax(0, 1fr);
    }
    [data-cs-desktop-header="phone"] [data-testid="desktop-header-brand"] {
      justify-content: space-between;
    }
    [data-cs-desktop-header="phone"] [data-testid="desktop-topbar-actions"] {
      justify-content: flex-start;
    }
    [data-cs-desktop-header="phone"] [aria-label^="Kontomenü von "] {
      margin-inline-start: auto;
    }
    [data-cs-desktop-header-short="true"] [data-cs-neo-dock] {
      width: 52px;
      height: 54px;
    }
    [data-cs-desktop-header] [data-cs-neo-dock] > .cs-robot {
      width: 100%;
      height: 100%;
    }
    [data-cs-desktop-header] [data-testid="desktop-weather"] [role="button"] {
      overflow-wrap: anywhere;
    }
    [data-cs-desktop-header="phone"] [data-testid="desktop-weather"] {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 44px;
    }
    [data-cs-desktop-header="phone"] [aria-label="Wetterort ändern"] {
      grid-column: 1 / -1;
      grid-row: 1;
      padding-right: 39px;
    }
    [data-cs-desktop-header="phone"] [data-testid="desktop-weather-place"] {
      margin-right: -39px;
    }
    [data-cs-desktop-header="phone"] [data-testid="desktop-weather"] > [role="button"]:last-child {
      grid-row: 1;
      grid-column: 2;
      align-self: start;
    }
    [data-cs-desktop-weather-stacked] [data-testid="desktop-clock-weather"] {
      flex-direction: column;
      align-items: stretch;
    }
    [data-cs-desktop-weather-stacked] [data-testid="desktop-clock-weather"] > :first-child {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 10px;
      padding-right: 0;
      padding-bottom: 4px;
      border-right: 0;
      border-bottom: 1px solid rgba(139,211,255,0.22);
    }
    [data-cs-desktop-weather-stacked] [data-testid="desktop-weather"] {
      flex: 0 0 auto;
    }
    [data-testid="desktop-workspace-header"] [role="heading"] {
      text-shadow: 0 1px 3px #03132b, 0 2px 12px #03132b;
    }
    [data-cs-desktop-area-strip] {
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-inline: contain;
      scrollbar-width: thin;
      scrollbar-color: #7195b4 transparent;
    }
    input#desktop-navigation-search {
      background: transparent !important;
      color: #EAF6FF !important;
      -webkit-text-fill-color: #EAF6FF !important;
      caret-color: #81DFFF !important;
      border: 0 !important;
    }
    input#desktop-navigation-search::placeholder {
      color: #AFC9DC !important;
      -webkit-text-fill-color: #AFC9DC !important;
      opacity: 1;
    }
    [data-cs-desktop-navigation-workspace] {
      transition: grid-template-columns 240ms cubic-bezier(.2,.8,.2,1);
    }
    [data-cs-desktop-navigation-content], [data-cs-desktop-navigation-rail] {
      transition: opacity 160ms ease, transform 240ms cubic-bezier(.2,.8,.2,1);
    }
    [data-cs-desktop-widget-viewport], [data-cs-desktop-navigation-content] [data-testid="desktop-navigation-scroll"] {
      scrollbar-width: thin;
      scrollbar-color: #7195b4 transparent;
    }
    .cs-desktop-page-frame {
      display: grid;
      grid-template-columns: clamp(24px, 2.6vw, 38px) minmax(0, 1fr) clamp(24px, 2.6vw, 38px);
      gap: 3px;
      min-width: 0;
      min-height: 0;
    }
    .cs-desktop-page-frame > [data-cs-desktop-widget-viewport] { grid-column: 2; grid-row: 1; }
    [data-cs-desktop-page-arrow="previous"] { grid-column: 1; grid-row: 1; }
    [data-cs-desktop-page-arrow="next"] { grid-column: 3; grid-row: 1; }
    .cs-desktop-page-arrow, .cs-desktop-page-action,
    .cs-desktop-move-widget, .cs-desktop-remove-widget {
      appearance: none;
      border: 1px solid rgba(140, 216, 255, .42);
      background: rgba(5, 25, 48, .88);
      color: #eefaff;
      font-family: inherit;
      cursor: pointer;
    }
    .cs-desktop-page-arrow {
      align-self: center;
      justify-self: stretch;
      min-height: 48px;
      padding: 0;
      border-radius: 13px;
      font-size: 30px;
      line-height: 1;
    }
    .cs-desktop-page-arrow:disabled { opacity: .38; cursor: default; }
    .cs-desktop-page-arrow:enabled:hover, .cs-desktop-page-action:hover { background: #125674; }
    .cs-desktop-page-footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 5px 10px;
      padding: 3px 4px 0;
      color: #edf7ff;
      font-size: ${Math.round(12 * scale)}px;
    }
    .cs-desktop-page-count, .cs-desktop-edit-hint {
      border-radius: 10px;
      background: rgba(2, 18, 35, .78);
      padding: 7px 10px;
      text-align: center;
    }
    .cs-desktop-page-count { font-variant-numeric: tabular-nums; }
    .cs-desktop-page-action {
      min-height: 36px;
      border-radius: 10px;
      padding: 4px 10px;
      font-size: inherit;
      font-weight: 700;
    }
    [data-cs-desktop-widget-grid] {
      --cs-desktop-card-height: ${minCardHeight}px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, ${minimum}px), 1fr));
      grid-auto-rows: minmax(var(--cs-desktop-card-height), auto);
      gap: ${gap}px;
      align-items: stretch;
    }
    [data-cs-desktop-widget-label] { min-height: ${labelHeight}px; flex-shrink: 0; }
    [data-cs-desktop-widget-artwork] {
      flex: 1 0 0px;
      min-height: ${artworkMinHeight}px;
      margin: 0 ${artworkInset}px ${artworkInset}px;
    }
    [data-cs-desktop-widget-artwork] > .cs-desktop-tile-artwork { position: absolute; inset: 0; }
    [data-cs-desktop-widget-empty] { flex: 1; }
    .cs-desktop-cell {
      position: relative;
      display: flex;
      flex-direction: column;
      min-width: 0;
      container: caresuite-desktop-cell / inline-size;
    }
    .cs-desktop-cell[data-target="true"] {
      outline: 2px solid #9af5d6;
      outline-offset: 2px;
      border-radius: 18px;
      background: rgba(25, 104, 93, .38);
      z-index: 1;
    }
    .cs-desktop-cell[data-moving="true"] .cs-desktop-edit-card { opacity: .4; animation: none; }
    .cs-desktop-edit-card { position: relative; display: flex; flex: 1; flex-direction: column; min-width: 0; }
    .cs-desktop-edit-card [data-cs-desktop-widget-label] { padding-right: 44px; }
    .cs-desktop-move-widget {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 8px;
      border: 0;
      border-radius: 18px;
      background: transparent;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }
    @media (pointer: coarse) {
      .cs-desktop-move-widget { inset: auto 3px 3px auto; padding: 6px; }
    }
    .cs-desktop-move-widget:active { cursor: grabbing; }
    .cs-desktop-move-widget[aria-pressed="true"] { box-shadow: inset 0 0 0 2px #9af5d6; }
    .cs-desktop-move-widget > span {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 9px;
      background: #0b344f;
      font-size: 21px;
      line-height: 1;
    }
    .cs-desktop-remove-widget {
      position: absolute;
      right: 5px;
      top: 5px;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      color: #ffdee4;
      background: #4e2537;
      font-size: 22px;
      line-height: 1;
    }
    .cs-desktop-drag-preview {
      position: fixed;
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: min(230px, 65vw);
      padding: 10px 13px;
      transform: translate(-50%, calc(-100% - 12px));
      overflow-wrap: anywhere;
      border: 1px solid #87e6ee;
      border-radius: 12px;
      background: #103a55;
      color: #fff;
      box-shadow: 0 6px 18px #02152990;
      font-weight: 700;
      pointer-events: none;
    }
    @keyframes cs-desktop-widget-wiggle {
      0%, 100% { transform: rotate(-.45deg); }
      50% { transform: rotate(.45deg); }
    }
    @media (prefers-reduced-motion: no-preference) {
      .cs-desktop-edit-card { animation: cs-desktop-widget-wiggle .34s ease-in-out infinite; }
      .cs-desktop-cell:nth-child(even) .cs-desktop-edit-card { animation-delay: -.17s; }
      .cs-desktop-edit-card:focus-within { animation: none; }
    }
    @supports (container-type: size) {
      [data-cs-desktop-widget-viewport] {
        container-type: size;
        container-name: caresuite-desktop-widgets;
      }
      [data-cs-desktop-widget-grid] {
        --cs-desktop-columns: 1;
        --cs-desktop-rows: 12;
        --cs-desktop-column-width: calc((100cqw - (var(--cs-desktop-columns) - 1) * ${gap}px) / var(--cs-desktop-columns));
        --cs-desktop-card-height: clamp(${minCardHeight}px,
          calc((100cqh - 20px - (var(--cs-desktop-rows) - 1) * ${gap}px) / var(--cs-desktop-rows)),
          calc(var(--cs-desktop-column-width) + ${labelHeight - artworkInset}px));
        grid-template-columns: repeat(var(--cs-desktop-columns), minmax(0, 1fr));
      }
      @container caresuite-desktop-widgets (min-width: ${threshold(2)}px) {
        [data-cs-desktop-widget-grid] { --cs-desktop-columns: 2; --cs-desktop-rows: 6; }
      }
      @container caresuite-desktop-widgets (min-width: ${threshold(3)}px) {
        [data-cs-desktop-widget-grid] { --cs-desktop-columns: 3; --cs-desktop-rows: 4; }
      }
      @container caresuite-desktop-widgets (min-width: ${threshold(4)}px) {
        [data-cs-desktop-widget-grid] { --cs-desktop-columns: 4; --cs-desktop-rows: 3; }
      }
      @container caresuite-desktop-widgets (min-width: ${Math.max(1900 * scale, threshold(6))}px) {
        [data-cs-desktop-widget-grid] { --cs-desktop-columns: 6; --cs-desktop-rows: 2; }
      }
    }
    ${mobile ? `
    [data-cs-desktop-widget-label] { padding: 6px 10px; gap: 6px; }
    [data-cs-desktop-widget-label] [role="heading"] {
      font-size: ${16 * fontScale}px !important;
      line-height: ${21 * fontScale}px !important;
    }
    ` : ''}
    [data-testid="desktop-full-width-header"] :is([role="button"],button):focus-visible,
    [data-cs-desktop-navigation-workspace] :is([role="button"],[role="tab"],button):focus-visible {
      outline: 2px solid #81DCFF;
      outline-offset: -3px;
    }
    @media (prefers-reduced-motion: reduce) {
      [data-cs-desktop-navigation-workspace],
      [data-cs-desktop-navigation-content], [data-cs-desktop-navigation-rail] { transition: none; }
    }
  `;
}
