import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';
import { spatialCare } from '@/design/tokens/spatialCareSuite';

type PremiumListHeroFrameProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  accentColor?: string;
};

/**
 * Canonical list overview.
 *
 * The old implementation switched between light cards and Aurora hero
 * gradients. That created a different page structure in almost every module.
 * List metadata, KPIs and actions now use the same compact glass section as
 * the payroll reference screen, independent of module and theme mode.
 */
export function PremiumListHeroFrame({
  children,
  style,
  accentColor,
}: PremiumListHeroFrameProps) {
  return (
    <View
      style={[
        styles.frame,
        accentColor ? { borderColor: accentColor } : null,
        style,
      ]}
      {...(Platform.OS === 'web'
        ? ({ dataSet: { csHealthosComponent: 'list-overview' } } as object)
        : {})}
    >
      <View pointerEvents="none" style={styles.innerBorder} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    minWidth: 0,
    padding: careSpacing.md,
    gap: careSpacing.sm,
    borderRadius: spatialCare.radius.card,
    borderWidth: 1,
    borderColor: systemLiquidGlass.borderStrong,
    backgroundColor: systemLiquidGlass.panelStrong,
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: systemLiquidGlass.shadowSoft,
        } as unknown as ViewStyle)
      : null),
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: spatialCare.radius.card,
    borderWidth: 1,
    borderColor: systemLiquidGlass.innerBorder,
  },
});
