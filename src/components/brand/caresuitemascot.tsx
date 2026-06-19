import { Image, type ImageStyle, type ViewStyle } from 'react-native';
import { CARESUITE_ROBOT_LOGO } from './brandassets';

type CareSuiteMascotProps = {
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
};

const SIZES = { sm: 96, md: 140, lg: 180 } as const;

export function CareSuiteMascot({ size = 'md', style }: CareSuiteMascotProps) {
  const dim = SIZES[size];
  return (
    <Image
      source={CARESUITE_ROBOT_LOGO}
      style={[{ width: dim, height: dim, backgroundColor: 'transparent' }, style] as ImageStyle}
      resizeMode="contain"
      accessibilityLabel="CareSuite+ Maskottchen"
    />
  );
}
