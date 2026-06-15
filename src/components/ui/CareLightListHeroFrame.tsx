import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';

type CareLightListHeroFrameProps = {
  children: ReactNode;
  style?: ViewStyle;
  accentColor?: string;
};

/** Light premium list/detail hero — replaces dark PremiumListHeroFrame. */
export function CareLightListHeroFrame({
  children,
  style,
  accentColor = careLightColors.orange,
}: CareLightListHeroFrameProps) {
  return (
    <View style={[styles.wrapper, { borderLeftColor: accentColor }, style]}>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: careLightColors.border,
    borderLeftWidth: 3,
    backgroundColor: careLightColors.surface,
    overflow: 'hidden',
    marginBottom: careSpacing.md,
    shadowColor: careLightColors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  content: {
    padding: careSpacing.md,
    gap: careSpacing.sm,
  },
});
