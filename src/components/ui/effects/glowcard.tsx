import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassSurface } from './glasssurface';

export type GlowCardProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: ViewStyle;
  glowColor?: string;
  glowOpacity?: number;
};

export function GlowCard({ children, onPress, style, glowColor }: GlowCardProps) {
  const inner = (
    <GlassSurface style={[styles.card, glowColor ? { borderColor: glowColor } : null, style]}>
      {children}
    </GlassSurface>
  );

  if (!onPress) return inner;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => <View style={pressed ? styles.pressed : undefined}>{inner}</View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
  },
  pressed: {
    opacity: 0.92,
  },
});
