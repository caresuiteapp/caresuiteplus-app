import { resolveCareTypography } from '@/design/tokens/typography';

/** Light typography — matches demo default (ThemeModeProvider). */
export const typography = resolveCareTypography('light');

/** Dark typography for explicit legacy/dark-mode StyleSheets. */
export const darkTypography = resolveCareTypography('dark');
