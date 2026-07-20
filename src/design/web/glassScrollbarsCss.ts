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

  /* Compatibility class — same canonical dark Liquid Glass treatment. */
  ${GLASS_SCROLL_LIGHT} {
    scrollbar-color: rgba(20, 120, 255, 0.72) rgba(6, 17, 38, 0.72) !important;
  }

  ${GLASS_SCROLL_LIGHT}::-webkit-scrollbar {
    width: 10px !important;
    height: 12px !important;
  }

  ${GLASS_SCROLL_LIGHT}::-webkit-scrollbar-track {
    background: rgba(6, 17, 38, 0.62);
    border-radius: 999px;
    margin: 3px;
    min-height: 12px;
    backdrop-filter: blur(14px) saturate(1.35);
    -webkit-backdrop-filter: blur(14px) saturate(1.35);
    border: 1px solid rgba(248, 251, 255, 0.13);
    box-shadow: inset 0 1px 0 rgba(248, 251, 255, 0.08);
  }

  ${GLASS_SCROLL_LIGHT}::-webkit-scrollbar-thumb {
    background: linear-gradient(
      135deg,
      rgba(20, 120, 255, 0.86) 0%,
      rgba(74, 154, 255, 0.74) 48%,
      rgba(20, 120, 255, 0.62) 100%
    );
    border-radius: 999px;
    border: 1px solid rgba(248, 251, 255, 0.22);
    backdrop-filter: blur(10px) saturate(1.4);
    -webkit-backdrop-filter: blur(10px) saturate(1.4);
    box-shadow:
      inset 0 1px 0 rgba(248, 251, 255, 0.18),
      0 1px 8px rgba(20, 120, 255, 0.34);
    min-height: 36px;
    min-width: 36px;
  }

  ${GLASS_SCROLL_LIGHT}::-webkit-scrollbar-thumb:active {
    background: linear-gradient(
      135deg,
      rgba(74, 154, 255, 0.92) 0%,
      rgba(20, 120, 255, 0.86) 50%,
      rgba(74, 154, 255, 0.74) 100%
    );
  }

  /* Canonical dark Liquid Glass. */
  ${GLASS_SCROLL_DARK} {
    scrollbar-color: rgba(20, 120, 255, 0.72) rgba(6, 17, 38, 0.72) !important;
  }

  ${GLASS_SCROLL_DARK}::-webkit-scrollbar {
    width: 10px !important;
    height: 12px !important;
  }

  ${GLASS_SCROLL_DARK}::-webkit-scrollbar-track {
    background: rgba(6, 17, 38, 0.62);
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
      rgba(20, 120, 255, 0.86) 0%,
      rgba(74, 154, 255, 0.72) 50%,
      rgba(20, 120, 255, 0.58) 100%
    );
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(10px) saturate(1.25);
    -webkit-backdrop-filter: blur(10px) saturate(1.25);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 1px 8px rgba(20, 120, 255, 0.34);
    min-height: 36px;
    min-width: 36px;
  }

  ${GLASS_SCROLL_DARK}::-webkit-scrollbar-thumb:active {
    background: linear-gradient(
      135deg,
      rgba(74, 154, 255, 0.92) 0%,
      rgba(20, 120, 255, 0.86) 50%,
      rgba(74, 154, 255, 0.74) 100%
    );
  }

  .cs-glass-scroll--horizontal,
  [data-cs-glass-scroll-axis="horizontal"] {
    padding-bottom: 2px;
  }
`;

