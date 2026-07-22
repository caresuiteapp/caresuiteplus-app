import { Text, TextInput } from 'react-native';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

type ComponentWithDefaults = {
  defaultProps?: {
    style?: unknown;
    placeholderTextColor?: string;
    [key: string]: unknown;
  };
};

/**
 * React Native defaults to black text when a legacy component omits its color.
 * The production shell is dark, so a missing local style must remain readable.
 * Explicit component styles still win because they are merged afterwards.
 */
export function installSystemTextDefaults(): void {
  const text = Text as unknown as ComponentWithDefaults;
  const input = TextInput as unknown as ComponentWithDefaults;

  text.defaultProps = {
    ...text.defaultProps,
    style: [text.defaultProps?.style, { color: systemLiquidGlass.text.primary }],
  };
  input.defaultProps = {
    ...input.defaultProps,
    placeholderTextColor:
      input.defaultProps?.placeholderTextColor ?? systemLiquidGlass.text.muted,
    style: [input.defaultProps?.style, { color: systemLiquidGlass.text.primary }],
  };
}
