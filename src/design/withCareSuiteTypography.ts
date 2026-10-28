import { careSuiteAppFontFamily } from './tokens/appFontFamily';

/** Styled native Text does not inherit the document font used by Web. */
export function withCareSuiteTypography<T extends Record<string, object>>(styles: T): T {
  return Object.fromEntries(Object.entries(styles).map(([name, value]) => [name,
    'fontSize' in value ? { fontFamily: careSuiteAppFontFamily, ...value } : value,
  ])) as T;
}
