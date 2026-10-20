import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { PremiumListHeroFrame } from './PremiumListHeroFrame';

type CareLightListHeroFrameProps = {
  children: ReactNode;
  style?: ViewStyle;
  accentColor?: string;
};

/** Legacy name without a second design world. */
export function CareLightListHeroFrame(props: CareLightListHeroFrameProps) {
  return <PremiumListHeroFrame {...props} />;
}
