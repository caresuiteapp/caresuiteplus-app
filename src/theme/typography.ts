import { resolveCareTypography } from '@/design/tokens/typography';

/** Default typography — dark, readable ink on the canonical light surface. */
export const typography = resolveCareTypography('light');

/** Dark typography for explicit legacy/dark-mode StyleSheets. */
export const darkTypography = resolveCareTypography('light');
