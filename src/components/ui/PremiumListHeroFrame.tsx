import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';
import { spatialCare } from '@/design/tokens/spatialCareSuite';
import { LinearGradient } from 'expo-linear-gradient';
import { portalPremium, usePortalPremiumTheme } from '@/design/tokens/portalPremium';

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
  const portal = usePortalPremiumTheme();
  return (
    <View
      style={[
        styles.frame,
        portal.active && styles.portalFrame,
        accentColor ? { borderColor: accentColor } : null,
        style,
      ]}
      {...(Platform.OS === 'web'
        ? ({ dataSet: { csHealthosComponent: 'list-overview' } } as object)
        : {})}
    >
      {portal.active ? (
        <LinearGradient
          colors={['#FFFFFF', '#F3F9FF', '#E4F1FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View pointerEvents="none" style={[styles.ambientGlow, portal.active && styles.portalAmbientGlow]} />
      <View pointerEvents="none" style={[styles.lightRail, portal.active && styles.portalLightRail]} />
      <View pointerEvents="none" style={[styles.innerBorder, portal.active && styles.portalInnerBorder]} />
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
  portalFrame: {
    borderColor: portalPremium.border,
    backgroundColor: portalPremium.surface,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: portalPremium.shadow.card } as unknown as ViewStyle)
      : { shadowColor: '#00265A', shadowOpacity: 0.16, shadowRadius: 18, elevation: 7 }),
  },
  innerBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: spatialCare.radius.card,
    borderWidth: 1,
    borderColor: systemLiquidGlass.innerBorder,
  },
  ambientGlow: {
    position: 'absolute',
    width: 360,
    height: 360,
    top: -270,
    right: -70,
    borderRadius: 180,
    backgroundColor: systemLiquidGlass.glow.medium,
    opacity: 0.62,
  },
  portalAmbientGlow: {
    backgroundColor: 'rgba(53,151,255,0.16)',
    opacity: 1,
  },
  lightRail: {
    position: 'absolute',
    top: 0,
    left: 22,
    right: 22,
    height: 2,
    borderRadius: 999,
    backgroundColor: systemLiquidGlass.borderActive,
    opacity: 0.88,
  },
  portalLightRail: {
    backgroundColor: portalPremium.accent.blue,
    opacity: 0.55,
  },
  portalInnerBorder: {
    borderColor: portalPremium.innerBorder,
  },
});
