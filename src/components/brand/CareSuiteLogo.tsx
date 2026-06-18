import { type ViewStyle } from 'react-native';
import { CareSuiteLogoMark } from './CareSuiteLogoMark';

type CareSuiteLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  /** @deprecated Transparent mascot works on all surfaces. */
  onDark?: boolean;
  style?: ViewStyle;
};

export function CareSuiteLogo({ size = 'md', style }: CareSuiteLogoProps) {
  return <CareSuiteLogoMark size={size} style={style} />;
}
