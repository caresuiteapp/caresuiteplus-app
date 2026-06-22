import { useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { CareSuiteLogo } from '@/components/brand/CareSuiteLogo';
import { CareSuiteWordmark } from '@/components/brand/CareSuiteWordmark';
import { auroraGlass, lightLiquidGlass, lightLiquidGlassWebFx, useAuroraAdaptiveText, useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { usePortalContext } from '@/hooks/usePortalContext';
import { buildPortalNavigation } from '@/lib/portal/engine/buildPortalNavigation';
import { resolveCombinedModuleLabel } from '@/lib/portal/engine/portalTerminology';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import type { PortalNavItem } from '@/lib/portal/types';

type PortalLeftNavProps = {
  accentColor?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
      } as unknown as ViewStyle)
    : null;

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

function NavItem({
  item,
  active,
  accent,
  collapsed,
  onPress,
}: {
  item: PortalNavItem;
  active: boolean;
  accent: string;
  collapsed: boolean;
  onPress: () => void;
}) {
  const text = useAuroraAdaptiveText();

  return (
    <Pressable
      onPress={onPress}
      style={webCursor}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
    >
      <View
        style={[
          styles.navItem,
          collapsed && styles.navItemCollapsed,
          active && { backgroundColor: auroraGlass.chipActive, borderColor: `${accent}55` },
        ]}
      >
        {active ? <View style={[styles.activeBar, { backgroundColor: accent }]} /> : null}
        <Text style={[styles.navIcon, collapsed ? styles.navIconCollapsed : styles.navIconExpanded]}>
          {item.icon}
        </Text>
        {!collapsed ? (
          <Text
            style={[
              styles.navLabel,
              { color: active ? text.primary : text.secondary },
              active && { fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Client-only left navigation — dynamic from portal engine, no office/admin items. */
export function PortalLeftNav({
  accentColor = '#FF9500',
  collapsed = false,
  onToggleCollapse,
}: PortalLeftNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const useLightNav = auroraActive && isLight;
  const navSurface = useLightNav ? lightLiquidGlass.sidebar : auroraGlass.panel;
  const navBorder = useLightNav ? lightLiquidGlass.borderAccent : auroraGlass.border;
  const navGlassFx = useLightNav ? lightLiquidGlassWebFx(lightLiquidGlass.blur.light) : webGlassBlur;
  const { context } = usePortalContext();
  const [localCollapsed, setLocalCollapsed] = useState(collapsed);

  const navItems = useMemo(() => {
    if (!context) return [];
    if (!context.hasModuleAssignments) {
      return buildPortalNavigation({
        activeModuleKeys: [],
        hasModuleAssignments: false,
      });
    }
    return buildPortalNavigation({
      activeModuleKeys: context.activeModuleKeys,
      hasModuleAssignments: context.hasModuleAssignments,
      primaryModule: context.primaryModule,
      visibleFeatures: context.visibleFeatures,
    });
  }, [context]);

  const shellTabs = navItems.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    href: item.href,
  }));
  const activeKey = resolveActiveTabKey(pathname, shellTabs);
  const isCollapsed = onToggleCollapse ? collapsed : localCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) onToggleCollapse();
    else setLocalCollapsed((v) => !v);
  };

  const moduleLabel = context?.primaryModule
    ? resolveCombinedModuleLabel(context.activeModuleKeys)
    : null;
  const releaseActive = (context?.visibleFeatures.length ?? 0) > 0;

  return (
    <View
      style={[
        styles.root,
        isCollapsed && styles.rootCollapsed,
        { backgroundColor: navSurface, borderRightColor: navBorder },
        navGlassFx,
      ]}
    >
      <View style={[styles.header, isCollapsed && styles.headerCollapsed]}>
        {!isCollapsed ? (
          <>
            <CareSuiteWordmark size="nav" variant="aurora" />
            <Text style={[styles.portalLabel, { color: text.muted }]}>Klient:innenportal</Text>
            {moduleLabel ? (
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { borderColor: `${accentColor}55` }]}>
                  <Text style={[styles.badgeText, { color: accentColor }]}>{moduleLabel}</Text>
                </View>
                {releaseActive ? (
                  <View style={[styles.badge, styles.releaseBadge]}>
                    <Text style={[styles.badgeText, { color: text.secondary }]}>Freigabe aktiv</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <CareSuiteLogo size="sm" />
        )}
      </View>

      <ScrollView style={styles.nav} contentContainerStyle={styles.navContent} showsVerticalScrollIndicator={false}>
        {navItems.map((item) => (
          <NavItem
            key={item.key}
            item={item}
            active={item.key === activeKey}
            accent={accentColor}
            collapsed={isCollapsed}
            onPress={() => router.push(item.href as never)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={toggleCollapse} style={styles.footerBtn} accessibilityRole="button">
          <Text style={[styles.footerBtnText, { color: text.muted }]}>
            {isCollapsed ? '▸ Menü' : '◂ Menü minimieren'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const hilfe = navItems.find((item) => item.key === 'assist-hilfe');
            if (hilfe) router.push(hilfe.href as never);
            else openExternal(SUPPORT_LINKS.help);
          }}
          style={styles.footerBtn}
          accessibilityRole="link"
        >
          <Text style={[styles.footerBtnText, { color: text.muted }]}>❓ Hilfe</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 248,
    borderRightWidth: 1,
    paddingHorizontal: careSpacing.sm,
    paddingBottom: careSpacing.sm,
  },
  rootCollapsed: {
    width: 72,
    paddingHorizontal: careSpacing.xs,
  },
  header: {
    paddingTop: careSpacing.md,
    paddingHorizontal: careSpacing.xs,
    paddingBottom: careSpacing.sm,
    gap: careSpacing.xs,
  },
  headerCollapsed: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  portalLabel: {
    ...careTypography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: careSpacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
    paddingHorizontal: careSpacing.xs,
  },
  badge: {
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: auroraGlass.chip,
  },
  releaseBadge: {
    borderColor: auroraGlass.border,
  },
  badgeText: {
    ...careTypography.caption,
    fontWeight: '700',
    fontSize: 10,
  },
  nav: {
    flex: 1,
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
  navItemCollapsed: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: careSpacing.xs,
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
    textAlign: 'center',
  },
  navIconExpanded: {
    width: 24,
  },
  navIconCollapsed: {
    fontSize: 30,
  },
  navLabel: {
    ...careTypography.body,
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: auroraGlass.border,
    paddingTop: careSpacing.sm,
    gap: careSpacing.xs,
  },
  footerBtn: {
    paddingVertical: careSpacing.xs,
    paddingHorizontal: careSpacing.sm,
  },
  footerBtnText: {
    ...careTypography.caption,
    fontWeight: '600',
  },
});
