import { useMemo } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { withAlpha } from '@/design/tokens/motion';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useTenantBranding } from '@/hooks/useTenantDisplayName';
import { useOfficeDashboard } from '@/hooks/useOfficeDashboard';
import { resolveActiveModuleNavKey } from '@/lib/navigation/modulenav';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { getServiceMode } from '@/lib/services/mode';
import type { MainModuleKey } from '@/types/navigation/platform';
import {
  buildOpenTasks,
  OFFICE_QUICK_ACTIONS,
  resolveContextPanelNavConfig,
} from './platformContextData';
import { CollapsibleSidebarSection } from './collapsiblesidebarsection';
import { TenantMandantCardContent } from './TenantMandantCardContent';

type MobilePlatformContextPanelProps = {
  mainModule: MainModuleKey;
  accentColor?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** Mobile (<768px) platform context — aurora glass, nav groups below Schnellaktionen. */
export function MobilePlatformContextPanel({
  mainModule,
  accentColor = '#FF9500',
}: MobilePlatformContextPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logoUrl: tenantLogoUrl } = useTenantBranding();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const { data: officeData } = useOfficeDashboard();
  const isLive = getServiceMode() === 'supabase';

  const openTasks = useMemo(
    () => buildOpenTasks(mainModule, officeData, isLive),
    [isLive, mainModule, officeData],
  );

  const quickActions =
    mainModule === 'office' ? OFFICE_QUICK_ACTIONS : OFFICE_QUICK_ACTIONS.slice(0, 2);

  const navConfig = useMemo(() => resolveContextPanelNavConfig(mainModule), [mainModule]);
  const activeNavKey = resolveActiveModuleNavKey(pathname, navConfig);

  return (
    <View style={styles.root}>
      <GlassCard style={styles.card}>
        <TenantMandantCardContent
          logoUrl={tenantLogoUrl}
          accentColor={accentColor}
          labelStyle={{ ...type.caption, color: text.muted }}
          chipTextStyle={{ ...type.caption, fontWeight: '700' }}
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>HEUTE</Text>
        {openTasks.map((task) => (
          <View key={task.title} style={styles.statusRow}>
            <Text style={[type.caption, { color: text.secondary, flex: 1 }]} numberOfLines={1}>
              {task.title}
            </Text>
            <View style={[styles.taskBadge, { backgroundColor: withAlpha(accentColor, 0.2) }]}>
              <Text style={[type.caption, { color: accentColor, fontWeight: '700' }]}>{task.count}</Text>
            </View>
          </View>
        ))}
      </GlassCard>

      <CollapsibleSidebarSection
        title="SCHNELLAKTIONEN"
        items={quickActions}
        getItemKey={(action) => action.label}
        titleStyle={[type.caption, styles.eyebrow, { color: text.muted }]}
        containerStyle={styles.section}
        itemsContainerStyle={styles.quickActions}
        renderItem={(action, context) => (
          <Pressable
            onPress={() => {
              context?.closeMenu();
              router.push(action.href as never);
            }}
            style={[styles.actionBtn, webCursor]}
            accessibilityRole="button"
          >
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <Text style={[type.caption, { color: text.primary, fontWeight: '600' }]} numberOfLines={2}>
              {action.label}
            </Text>
          </Pressable>
        )}
      />

      <View style={styles.navSection}>
        {navConfig.groups.map((group) => (
          <CollapsibleSidebarSection
            key={group.title}
            title={group.title}
            items={group.items}
            getItemKey={(item) => item.key}
            titleStyle={[type.caption, styles.eyebrow, { color: text.muted }]}
            itemsContainerStyle={styles.navGroup}
            renderItem={(item, context) => {
              const active = item.key === activeNavKey;
              return (
                <Pressable
                  onPress={() => {
                    context?.closeMenu();
                    router.push(item.href as never);
                  }}
                  style={webCursor}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View
                    style={[
                      styles.navItem,
                      active && {
                        backgroundColor: withAlpha(accentColor, 0.18),
                        borderColor: withAlpha(accentColor, 0.45),
                      },
                    ]}
                  >
                    {active ? (
                      <View style={[styles.navActiveBar, { backgroundColor: accentColor }]} />
                    ) : null}
                    <Text style={styles.navIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        type.caption,
                        { color: active ? accentColor : text.secondary, fontWeight: active ? '700' : '600' },
                      ]}
                      numberOfLines={2}
                    >
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        ))}
      </View>

      <GlassCard style={styles.card}>
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>SUPPORT</Text>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.help)} style={styles.supportLink}>
          <Text style={[type.caption, { color: text.secondary, fontWeight: '600' }]}>
            Hilfe & Dokumentation
          </Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} style={styles.supportLink}>
          <Text style={[type.caption, { color: text.secondary, fontWeight: '600' }]}>Datenschutz</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings/data-request' as never)}
          style={styles.supportLink}
        >
          <Text style={[type.caption, { color: text.secondary, fontWeight: '600' }]}>
            Betroffenenrechte
          </Text>
        </Pressable>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: careSpacing.md,
    paddingTop: careSpacing.sm,
    paddingHorizontal: careSpacing.lg,
    paddingBottom: careSpacing.xl,
  },
  card: {
    gap: careSpacing.xs,
    padding: careSpacing.md,
    backgroundColor: auroraGlass.card,
  },
  section: {
    gap: careSpacing.sm,
    width: '100%',
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: careSpacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: careSpacing.sm,
  },
  taskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 24,
    alignItems: 'center',
  },
  quickActions: {
    gap: careSpacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    minHeight: 44,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.chip,
  },
  actionIcon: {
    fontSize: 16,
  },
  navSection: {
    gap: careSpacing.md,
    width: '100%',
  },
  navGroup: {
    gap: careSpacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.xs,
    minHeight: 44,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: auroraGlass.chip,
    position: 'relative',
  },
  navActiveBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 3,
  },
  navIcon: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  supportLink: {
    paddingVertical: careSpacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
});
