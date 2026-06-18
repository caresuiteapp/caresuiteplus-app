import { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { careEffects } from '@/design/tokens/effects';

type GlassSurfaceProps = {
  children: ReactNode;
  style?: ViewStyle;
  radius?: number;
  glowColor?: string;
  glowOpacity?: number;
};

export function GlassSurface({ children, style, radius = 12 }: GlassSurfaceProps) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor: careEffects.glass.border,
          backgroundColor: careEffects.glass.background,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
