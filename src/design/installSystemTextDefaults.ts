import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';
import { installCenturyGothicCss } from '@/design/web/centuryGothicCss';
import { Platform, Text, TextInput } from 'react-native';
import { llgsTypography } from '@/design/tokens/lightLiquidGlassSpace';

type ComponentWithDefaults = {
  defaultProps?: {
    style?: unknown;
    placeholderTextColor?: string;
    [key: string]: unknown;
  };
};

/**
 * Productive workspaces use light surfaces. Legacy components without an
 * explicit color therefore need dark fallback ink. Dark navigation and shell
 * regions provide their own explicit systemLiquidGlass text tokens.
 */
export function installSystemTextDefaults(): void {
  if (Platform.OS === 'web') installCenturyGothicCss();
  const text = Text as unknown as ComponentWithDefaults;
  const input = TextInput as unknown as ComponentWithDefaults;

  text.defaultProps = {
    ...text.defaultProps,
    style: [text.defaultProps?.style, { color: llgsTypography.primary, fontFamily: careSuiteAppFontFamily }],
  };
  input.defaultProps = {
    ...input.defaultProps,
    placeholderTextColor:
      input.defaultProps?.placeholderTextColor ?? llgsTypography.muted,
    style: [input.defaultProps?.style, { color: llgsTypography.primary, fontFamily: careSuiteAppFontFamily }],
  };
}
