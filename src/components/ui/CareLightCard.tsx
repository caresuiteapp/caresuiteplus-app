import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { spatialCareColors } from '@/design/tokens/spatialCareSuite';
import { PremiumCard } from './PremiumCard';

type CareLightCardProps = {
  children: ReactNode;
  accentColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Altname ohne eigene Designwelt: rendert immer die zentrale Systemkarte. */
export function CareLightCard({
  children,
  accentColor = spatialCareColors.cyanLight,
  onPress,
  style,
}: CareLightCardProps) {
  return (
    <PremiumCard accentColor={accentColor} onPress={onPress} style={style}>
      {children}
    </PremiumCard>
  );
}
