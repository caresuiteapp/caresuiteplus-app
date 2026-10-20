import { resolveCareTypography } from '@/design/tokens/typography';

/** Default typography — dark, readable hierarchy on light working surfaces. */
export const typography = resolveCareTypography('light');

/** Dark typography for explicit legacy/dark-mode StyleSheets. */
export const darkTypography = resolveCareTypography('dark');
