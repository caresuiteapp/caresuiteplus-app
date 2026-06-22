import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuroraGlassCardStyle } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  glow?: boolean;
};

export function AuroraGlassCard({ children, onPress, style, glow = false }: Props) {
  const glassStyle = useAuroraGlassCardStyle();

  const inner = (
    <View style={[styles.card, glassStyle, glow && styles.glow, style]}>
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
    <Pressable onPress={onPress} accessibilityRole="button">
      {inner}
    </Pressable>
  );
}

export function AuroraGlassPanel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: careSuiteAuroraTheme.glass.background,
          borderColor: careSuiteAuroraTheme.glass.border,
          borderWidth: 1,
          borderRadius: 16,
          padding: careSpacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', padding: careSpacing.md },
  glow: {
    shadowColor: careSuiteAuroraTheme.accent.violet,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  content: { position: 'relative', gap: careSpacing.sm },
});
