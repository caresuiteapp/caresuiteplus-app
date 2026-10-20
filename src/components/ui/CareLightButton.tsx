import type { StyleProp, ViewStyle } from 'react-native';
import { PremiumButton } from './PremiumButton';

type CareLightButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  accentColor?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/** Altname ohne eigene Designwelt: rendert immer den zentralen Systembutton. */
export function CareLightButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
  testID,
}: CareLightButtonProps) {
  return (
    <PremiumButton
      title={title}
      onPress={onPress}
      variant={variant}
      loading={loading}
      disabled={disabled}
      style={style}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    />
  );
}
