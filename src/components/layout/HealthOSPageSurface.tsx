import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { spatialCare } from '@/design/tokens/spatialCareSuite';
import { usePortalPremiumTheme } from '@/design/tokens/portalPremium';

const SYSTEM_CYAN = '#69E8FF';

type HealthOSPageSurfaceProps = Pick<
  ViewProps,
  'accessible' | 'accessibilityRole' | 'accessibilityHint'
> & {
  children: ReactNode;
  padded?: boolean;
  fill?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  testID?: string;
};

/**
 * Verbindliche Arbeitsfläche für jede CareSuite-Seite.
 *
 * Navigation und Portale dürfen eine eigene äußere Identität behalten. Die
 * eigentliche Arbeitsfläche hat jedoch überall dieselbe Breite, Rundung,
 * Abstände, Kontrastlogik und Liquid-Glass-Ebene.
 */
export function HealthOSPageSurface({
  children,
  padded = true,
  fill = true,
  style,
  contentStyle,
  testID = 'healthos-page-surface',
  ...accessibilityProps
}: HealthOSPageSurfaceProps) {
  const portal = usePortalPremiumTheme();
  return (
    <View style={[styles.host, fill && styles.hostFill, style]} testID={testID}>
      <View
        style={[styles.surface, portal.active && styles.portalSurface, fill && styles.surfaceFill]}
        {...(Platform.OS === 'web'
          ? ({ dataSet: { csHealthosPage: 'surface' } } as object)
          : {})}
        {...accessibilityProps}
      >
        {!portal.active ? <View pointerEvents="none" style={styles.ambientTop} /> : null}
        {!portal.active ? <View pointerEvents="none" style={styles.ambientBottom} /> : null}
        <View pointerEvents="none" style={[styles.lightRail, portal.active && styles.portalLightRail]} />
        {!portal.active ? <View pointerEvents="none" style={styles.innerBorder} /> : null}
        <View style={[styles.content, padded && styles.contentPadded, fill && styles.contentFill, contentStyle]}>
          {children}
        </View>
      </View>
    </View>
  );
}

type HealthOSPageZoneProps = {
  children?: ReactNode;
  kind: 'actions' | 'filters' | 'tabs' | 'content';
  style?: ViewStyle;
};

/** One stable order for action, filter, tab and content areas. */
export function HealthOSPageZone({ children, kind, style }: HealthOSPageZoneProps) {
  if (children == null) return null;
  return (
    <View
      style={[
        styles.zone,
        kind === 'content' ? styles.contentZone : styles.controlZone,
        style,
      ]}
      {...(Platform.OS === 'web'
        ? ({ dataSet: { csHealthosZone: kind } } as object)
        : {})}
      testID={`healthos-page-zone-${kind}`}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'center',
    maxWidth: 1720,
  },
  hostFill: {
    flex: 1,
    minHeight: 0,
  },
  surface: {
    width: '100%',
    minWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: spatialCare.radius.stage,
    borderWidth: 1,
    borderColor: systemLiquidGlass.borderStrong,
    backgroundColor: systemLiquidGlass.panel,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${systemLiquidGlass.blur.desktop}px) saturate(${systemLiquidGlass.saturate})`,
          WebkitBackdropFilter: `blur(${systemLiquidGlass.blur.desktop}px) saturate(${systemLiquidGlass.saturate})`,
          boxShadow: systemLiquidGlass.shadow,
        } as unknown as ViewStyle)
      : null),
  },
  portalSurface: {
    overflow: 'visible',
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'none', WebkitBackdropFilter: 'none', boxShadow: 'none' } as unknown as ViewStyle)
      : null),
  },
  ambientTop: {
    position: 'absolute',
    width: 520,
    height: 520,
    top: -360,
    right: -130,
    borderRadius: 260,
    backgroundColor: systemLiquidGlass.glow.medium,
    opacity: 0.66,
  },
  ambientBottom: {
    position: 'absolute',
    width: 420,
    height: 420,
    left: -280,
    bottom: -290,
    borderRadius: 210,
    backgroundColor: systemLiquidGlass.glow.soft,
    opacity: 0.48,
  },
  lightRail: {
    position: 'absolute',
    top: 0,
    left: '7%',
    right: '7%',
    height: 2,
    borderRadius: 999,
    backgroundColor: systemLiquidGlass.borderActive,
    shadowColor: SYSTEM_CYAN,
    shadowOpacity: 0.85,
    shadowRadius: 18,
  },
  portalLightRail: {
    left: '4%',
    right: '4%',
    height: 1,
    backgroundColor: 'rgba(112,181,255,0.42)',
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  surfaceFill: {
    flex: 1,
    minHeight: 0,
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: spatialCare.radius.stage,
    borderWidth: 1,
    borderColor: systemLiquidGlass.innerBorder,
  },
  content: {
    width: '100%',
    minWidth: 0,
    gap: careSpacing.md,
  },
  contentPadded: {
    padding: careSpacing.md,
  },
  contentFill: {
    flex: 1,
    minHeight: 0,
  },
  zone: {
    width: '100%',
    minWidth: 0,
  },
  controlZone: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  contentZone: {
    flex: 1,
    minHeight: 0,
    gap: careSpacing.md,
  },
});
