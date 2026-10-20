import { CARESUITE_FONT_STACK, CARESUITE_WEB_FONT_FAMILY, CARESUITE_FONT_URL } from '../tokens/fontFamily';

export const CARESUITE_FONT_STYLE_ID = 'caresuite-century-gothic';

/**
 * Cover raw HTML and React Native Web text/input resets without depending
 * on generated class names. :root outranks the React Native Web reset.
 * Portals are covered at document level as well.
 * Inline icon font families retain precedence; never force them with !important.
 */
export const CENTURY_GOTHIC_CSS = `
@font-face {
  font-family: '${CARESUITE_WEB_FONT_FAMILY}';
  src: url('${CARESUITE_FONT_URL}') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
html:root body,
html:root body :is(div, span, p, a, h1, h2, h3, h4, h5, h6, li, dt, dd, td, th,
  label, legend, summary, button, input, textarea, select, option, optgroup,
  pre, code, kbd, samp),
html:root body svg text {
  font-family: ${CARESUITE_FONT_STACK};
}
`;

export function installCenturyGothicCss(): void {
  if (typeof document === 'undefined' || document.getElementById(CARESUITE_FONT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = CARESUITE_FONT_STYLE_ID;
  style.textContent = CENTURY_GOTHIC_CSS;
  document.head.appendChild(style);
}
