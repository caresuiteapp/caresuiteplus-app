import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type CareLightCardProps = {
  children: ReactNode;
  accentColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
};

export function CareLightCard({ children, accentColor, onPress, style }: CareLightCardProps) {
  const inner = (
    <View
      style={[
        styles.card,
        accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={pressed ? styles.pressed : undefined}>{inner}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: careLightColors.surface,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: careLightColors.border,
    padding: careSpacing.md,
    shadowColor: careLightColors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.92,
  },
});
