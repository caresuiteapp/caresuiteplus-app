import { desktopGridMetrics } from '../navigation/desktopLayoutModel';

/** Keep sidebar motion, track widths and artwork height in the same browser layout pass. */
export function desktopWorkspaceCss(fontScale: number, mobile = false, hasSuggestions = false) {
  // Recommendations include copy and two actions; keep them readable on tablets
  // and phones too, instead of inheriting the compact artwork-only card width.
  const { scale, gap, minimum, labelHeight } = desktopGridMetrics(fontScale, mobile, hasSuggestions);
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
    [data-cs-desktop-widget-grid] {
      --cs-desktop-card-height: ${labelHeight + 152}px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, ${minimum}px), 1fr));
      gap: ${gap}px;
      align-items: stretch;
    }
    [data-cs-desktop-widget-label] { min-height: ${labelHeight}px !important; }
    [data-cs-desktop-widget-artwork] { height: 140px !important; }
    [data-cs-desktop-widget-empty] { min-height: ${labelHeight + 152}px; }
    @supports (container-type: size) {
      [data-cs-desktop-widget-viewport] {
        container-type: size;
        container-name: caresuite-desktop-widgets;
      }
      [data-cs-desktop-widget-grid] {
        --cs-desktop-columns: 1;
        --cs-desktop-rows: 12;
        --cs-desktop-artwork-height: clamp(72px,
          calc((100cqh - 24px - (var(--cs-desktop-rows) - 1) * ${gap}px) / var(--cs-desktop-rows) - ${labelHeight + 12}px),
          min(180px, calc((100cqw - (var(--cs-desktop-columns) - 1) * ${gap}px) / var(--cs-desktop-columns) * .55)));
        --cs-desktop-card-height: calc(${labelHeight + 12}px + var(--cs-desktop-artwork-height));
        grid-template-columns: repeat(var(--cs-desktop-columns), minmax(0, 1fr));
      }
      [data-cs-desktop-widget-artwork] { height: var(--cs-desktop-artwork-height) !important; }
      [data-cs-desktop-widget-empty] { min-height: calc(${labelHeight + 12}px + var(--cs-desktop-artwork-height)); }
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
    [data-cs-desktop-widget-grid] { --cs-desktop-card-height: ${labelHeight + 98}px; }
    [data-cs-desktop-widget-label] { padding: 6px 10px; gap: 6px; }
    [data-cs-desktop-widget-label] [role="heading"] {
      font-size: ${16 * fontScale}px !important;
      line-height: ${21 * fontScale}px !important;
    }
    [data-cs-desktop-widget-artwork] { height: 90px !important; margin: 0 7px 7px; }
    [data-cs-desktop-widget-empty] { min-height: ${labelHeight + 98}px; }
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
