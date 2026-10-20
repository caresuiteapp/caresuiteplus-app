import type { StyleProp, ViewStyle } from 'react-native';
import { PremiumButton } from '@/components/ui/PremiumButton';

export type HealthOSActionVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: HealthOSActionVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function HealthOSActionButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  fullWidth = false,
  accessibilityLabel,
  testID,
}: Props) {
  const premiumVariant = variant === 'danger' ? 'secondary' : variant;

  return (
    <PremiumButton
      title={title}
      onPress={onPress}
      variant={premiumVariant}
      loading={loading}
      disabled={disabled}
      style={style}
      fullWidth={fullWidth}
      accessibilityLabel={accessibilityLabel ?? title}
      testID={testID}
    />
  );
}
