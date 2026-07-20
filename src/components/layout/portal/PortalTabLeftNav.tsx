import { useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { CareSuiteWordmark } from '@/components/brand/CareSuiteWordmark';
import {
  auroraGlass,
  lightLiquidGlass,
  lightLiquidGlassWebFx,
  useAuroraAdaptiveText,
  useAuroraGlassActive,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import type { ShellTabConfig } from '@/types/navigation/shell';

type PortalTabLeftNavProps = {
  tabs: ShellTabConfig[];
  accentColor?: string;
  portalLabel: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
      } as unknown as ViewStyle)
    : null;

/** Scrollable left nav from tab config — employee portal and other fixed-tab portals. */
export function PortalTabLeftNav({
  tabs,
  accentColor = '#1478FF',
  portalLabel,
}: PortalTabLeftNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const useLightNav = auroraActive && isLight;
  const navSurface = useLightNav ? lightLiquidGlass.sidebar : auroraGlass.panel;
  const navBorder = useLightNav ? lightLiquidGlass.borderAccent : auroraGlass.border;
  const navGlassFx = useLightNav ? lightLiquidGlassWebFx(lightLiquidGlass.blur.light) : webGlassBlur;
  const activeKey = useMemo(() => resolveActiveTabKey(pathname, tabs), [pathname, tabs]);

  return (
    <View style={[styles.root, { backgroundColor: navSurface, borderRightColor: navBorder }, navGlassFx]}>
      <View style={styles.header}>
        <CareSuiteWordmark size="nav" variant="aurora" />
        <Text style={[styles.portalLabel, { color: text.muted }]}>{portalLabel}</Text>
      </View>
      <ScrollView style={styles.nav} contentContainerStyle={styles.navContent} showsVerticalScrollIndicator={false}>
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              onPress={() => router.push(tab.href as never)}
              style={webCursor}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
            >
              <View
                style={[
                  styles.navItem,
                  active && {
                    backgroundColor: auroraGlass.chipActive,
                    borderColor: `${accentColor}55`,
                  },
                ]}
              >
                {active ? <View style={[styles.activeBar, { backgroundColor: accentColor }]} /> : null}
                <Text style={styles.navIcon}>{tab.icon}</Text>
                <Text
                  style={[
                    styles.navLabel,
                    { color: active ? text.primary : text.secondary },
                    active && { fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 248,
    height: '100%',
    minHeight: 0,
    borderRightWidth: 1,
    paddingHorizontal: careSpacing.sm,
    paddingBottom: careSpacing.sm,
  },
  header: {
    paddingTop: careSpacing.md,
    paddingHorizontal: careSpacing.xs,
    paddingBottom: careSpacing.sm,
    gap: careSpacing.xs,
  },
  portalLabel: {
    ...careTypography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: careSpacing.xs,
  },
  nav: {
    flex: 1,
    minHeight: 0,
    ...(Platform.OS === 'web'
      ? ({ overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'stable' } as unknown as ViewStyle)
      : null),
  },
  navContent: {
    gap: careSpacing.xs,
    paddingBottom: careSpacing.md,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 3,
  },
  navIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  navLabel: {
    ...careTypography.body,
    fontWeight: '600',
    flex: 1,
  },
});
