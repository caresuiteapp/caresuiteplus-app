/**
 * Web-only CSS: frosted glass scrollbars that override global invisible scrollbars.
 * Scoped to `.cs-glass-scroll` / `[data-cs-glass-scroll]` — use via GlassScrollView.
 */
export const GLASS_SCROLLBARS_STYLE_ID = 'caresuite-glass-scrollbars';

const GLASS_SCROLL_ROOT = '.cs-glass-scroll, [data-cs-glass-scroll="true"]';
const GLASS_SCROLL_LIGHT = '.cs-glass-scroll--light, [data-cs-glass-scroll-theme="light"]';
const GLASS_SCROLL_DARK = '.cs-glass-scroll--dark, [data-cs-glass-scroll-theme="dark"]';

export const GLASS_SCROLLBARS_CSS = `
  ${GLASS_SCROLL_ROOT} {
    scrollbar-width: thin !important;
    -ms-overflow-style: auto !important;
  }

  ${GLASS_SCROLL_ROOT}::-webkit-scrollbar {
    display: block !important;
    background: transparent;
  }

  ${GLASS_SCROLL_ROOT}::-webkit-scrollbar-corner {
    background: transparent;
  }

  /* Light LLGAN milchglas */
  ${GLASS_SCROLL_LIGHT} {
    scrollbar-color: rgba(130, 170, 255, 0.58) rgba(255, 255, 255, 0.24) !important;
  }

  ${GLASS_SCROLL_LIGHT}::-webkit-scrollbar {
    width: 10px !important;
    height: 12px !important;
  }

  ${GLASS_SCROLL_LIGHT}::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 999px;
    margin: 3px;
    min-height: 12px;
    backdrop-filter: blur(14px) saturate(1.35);
    -webkit-backdrop-filter: blur(14px) saturate(1.35);
    border: 1px solid rgba(255, 255, 255, 0.38);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  }

  ${GLASS_SCROLL_LIGHT}::-webkit-scrollbar-thumb {
    background: linear-gradient(
      135deg,
      rgba(183, 216, 255, 0.78) 0%,
      rgba(202, 184, 255, 0.72) 48%,
      rgba(143, 234, 255, 0.68) 100%
    );
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.58);
    backdrop-filter: blur(10px) saturate(1.4);
    -webkit-backdrop-filter: blur(10px) saturate(1.4);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.72),
      0 1px 5px rgba(130, 170, 255, 0.24);
    min-height: 36px;
    min-width: 36px;
  }

  ${GLASS_SCROLL_LIGHT}::-webkit-scrollbar-thumb:active {
    background: linear-gradient(
      135deg,
      rgba(130, 170, 255, 0.88) 0%,
      rgba(168, 140, 255, 0.82) 50%,
      rgba(111, 220, 255, 0.78) 100%
    );
  }

  /* Dark aurora glass */
  ${GLASS_SCROLL_DARK} {
    scrollbar-color: rgba(139, 92, 246, 0.55) rgba(15, 23, 42, 0.48) !important;
  }

  ${GLASS_SCROLL_DARK}::-webkit-scrollbar {
    width: 10px !important;
    height: 12px !important;
  }

  ${GLASS_SCROLL_DARK}::-webkit-scrollbar-track {
    background: rgba(15, 23, 42, 0.42);
    border-radius: 999px;
    margin: 3px;
    min-height: 12px;
    backdrop-filter: blur(14px) saturate(1.2);
    -webkit-backdrop-filter: blur(14px) saturate(1.2);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  ${GLASS_SCROLL_DARK}::-webkit-scrollbar-thumb {
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 0.62) 0%,
      rgba(236, 72, 153, 0.48) 50%,
      rgba(6, 182, 212, 0.42) 100%
    );
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(10px) saturate(1.25);
    -webkit-backdrop-filter: blur(10px) saturate(1.25);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 1px 6px rgba(139, 92, 246, 0.28);
    min-height: 36px;
    min-width: 36px;
  }

  ${GLASS_SCROLL_DARK}::-webkit-scrollbar-thumb:active {
    background: linear-gradient(
      135deg,
      rgba(167, 120, 255, 0.78) 0%,
      rgba(236, 72, 153, 0.62) 50%,
      rgba(34, 196, 220, 0.55) 100%
    );
  }

  .cs-glass-scroll--horizontal,
  [data-cs-glass-scroll-axis="horizontal"] {
    padding-bottom: 2px;
  }
`;
