import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careEffects } from '@/design/tokens/effects';
import { galaxyGlow, galaxyPalette } from '@/design/tokens/galaxy';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';

type GlassCardProps = {
  children: ReactNode;
  onPress?: () => void;
  glow?: boolean;
  accentColor?: string;
  selected?: boolean;
  style?: ViewStyle;
};

/** Dark liquid-glass card with optional neon glow and selection ring. */
export function GlassCard({
  children,
  onPress,
  glow = false,
  accentColor,
  selected = false,
  style,
}: GlassCardProps) {
  const borderColor = selected
    ? accentColor ?? galaxyPalette.careOrange
    : careEffects.glass.border;

  const inner = (
    <View
      style={[
        styles.card,
        glow ? galaxyGlow.cyan : null,
        selected ? styles.selected : null,
        { borderColor },
        accentColor && !selected ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : null,
        style,
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: careRadius.lg,
    borderWidth: 1,
    backgroundColor: galaxyPalette.cardGlass,
    overflow: 'hidden',
    padding: careSpacing.md,
  },
  selected: {
    ...galaxyGlow.orange,
    borderWidth: 1.5,
  },
  content: {
    position: 'relative',
    gap: careSpacing.sm,
  },
  pressed: {
    opacity: 0.92,
  },
});
