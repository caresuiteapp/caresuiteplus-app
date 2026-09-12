/** Keep sidebar motion, track widths and artwork height in the same browser layout pass. */
export function desktopWorkspaceCss(fontScale: number) {
  const scale = Math.max(1, Number.isFinite(fontScale) ? fontScale : 1);
  const gap = 14;
  const minimum = 240 * scale;
  const threshold = (columns: number) => columns * minimum + (columns - 1) * gap;
  const labelHeight = Math.ceil(48 * scale + 16);
  return `
    input#desktop-catalog-search,
    input#desktop-navigation-search {
      background: transparent !important;
      color: #EAF6FF !important;
      -webkit-text-fill-color: #EAF6FF !important;
      caret-color: #81DFFF !important;
      border: 0 !important;
    }
    input#desktop-catalog-search::placeholder,
    input#desktop-navigation-search::placeholder {
      color: #AFC9DC !important;
      -webkit-text-fill-color: #AFC9DC !important;
      opacity: 1;
    }
    [data-testid="app-catalog"], [data-testid="widget-catalog"] {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, ${280 * scale}px), 1fr));
      gap: 10px;
      margin: 0;
    }
    [data-testid="app-catalog"] > div, [data-testid="widget-catalog"] > div {
      min-width: 0;
      padding: 0;
    }
    [data-cs-desktop-navigation-workspace] {
      transition: grid-template-columns 240ms cubic-bezier(.2,.8,.2,1);
    }
    [data-cs-desktop-navigation-content], [data-cs-desktop-navigation-rail] {
      transition: opacity 160ms ease, transform 240ms cubic-bezier(.2,.8,.2,1);
    }
    [data-cs-desktop-widget-grid] {
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
    [data-cs-desktop-navigation-workspace] :is([role="button"],button):focus-visible {
      outline: 2px solid #81DCFF;
      outline-offset: -3px;
    }
    @media (prefers-reduced-motion: reduce) {
      [data-cs-desktop-navigation-workspace],
      [data-cs-desktop-navigation-content], [data-cs-desktop-navigation-rail] { transition: none; }
    }
  `;
}
