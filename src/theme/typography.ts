import { resolveCareTypography } from '@/design/tokens/typography';

/** Default typography — light palette / black ink. */
export const typography = resolveCareTypography('light');

/** Dark typography for explicit legacy/dark-mode StyleSheets. */
export const darkTypography = resolveCareTypography('dark');
