import { resolveCareTypography } from '@/design/tokens/typography';

/** Default typography — white hierarchy on the canonical Liquid Command stage. */
export const typography = resolveCareTypography('dark');

/** Dark typography for explicit legacy/dark-mode StyleSheets. */
export const darkTypography = resolveCareTypography('dark');
