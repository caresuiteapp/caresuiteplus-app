import { CENTURY_GOTHIC_REGULAR_BASE64 } from './centuryGothicData';
import { CARESUITE_WEB_FONT_FAMILY } from '../tokens/fontFamily';

/** Self-contained font for saved HTML, print views and native PDF WebViews. */
export const CARESUITE_DOCUMENT_FONT_CSS = `
@font-face {
  font-family: '${CARESUITE_WEB_FONT_FAMILY}';
  src: url(data:font/ttf;base64,${CENTURY_GOTHIC_REGULAR_BASE64}) format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
`;
