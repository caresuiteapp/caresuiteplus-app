import { type ViewStyle } from 'react-native';
import { CareSuiteLogoMark, type CareSuiteLogoSize } from './CareSuiteLogoMark';

type CareSuiteLogoProps = {
  size?: CareSuiteLogoSize;
  /** @deprecated Transparent logo works on all surfaces. */
  onDark?: boolean;
  style?: ViewStyle;
};

export function CareSuiteLogo({ size = 'md', style }: CareSuiteLogoProps) {
  return <CareSuiteLogoMark size={size} style={style} />;
}
