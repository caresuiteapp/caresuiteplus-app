import { ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import {
  useCareLightPalette,
  type CareLightResolved,
} from '@/design/tokens/carelightadaptive';
import { GlassSurface } from './effects';

type CareLightCardProps = {
  children: ReactNode;
  accentColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
};

export function CareLightCard({ children, accentColor, onPress, style }: CareLightCardProps) {
  const { isDark, c } = useCareLightPalette();
  const styles = useMemo(() => makeStyles(c), [c]);

  const accentEdge: ViewStyle | null = accentColor
    ? { borderLeftColor: accentColor, borderLeftWidth: 3 }
    : null;

  let inner: ReactNode;
  if (isDark) {
    inner = (
      <GlassSurface
        radius={careRadius.lg}
        glowColor={accentColor ?? c.violet}
        glowOpacity={0.08}
        style={[accentEdge, style]}
      >
        <View style={styles.darkContent}>{children}</View>
      </GlassSurface>
    );
  } else {
    inner = <View style={[styles.card, accentEdge, style]}>{children}</View>;
  }

  if (!onPress) return inner;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => <View style={pressed ? styles.pressed : undefined}>{inner}</View>}
    </Pressable>
  );
}

function makeStyles(c: CareLightResolved) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: careRadius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: careSpacing.md,
      shadowColor: c.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    darkContent: {
      padding: careSpacing.md,
    },
    pressed: {
      opacity: 0.92,
    },
  });
}
