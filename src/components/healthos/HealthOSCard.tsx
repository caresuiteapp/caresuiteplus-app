import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { PremiumCard } from '@/components/ui/PremiumCard';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accentColor?: string;
  variant?: 'default' | 'elevated';
};

export function HealthOSCard({
  children,
  style,
  onPress,
  accentColor,
  variant = 'default',
}: Props) {
  return (
    <PremiumCard style={style} onPress={onPress} accentColor={accentColor} variant={variant}>
      {children}
    </PremiumCard>
  );
}
