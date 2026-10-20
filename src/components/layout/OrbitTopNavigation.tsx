import { useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { AppShellArea, ShellTabConfig } from '@/types/navigation/shell';
import { useAppShell } from '@/hooks/useAppShell';
import { PlatformProfileMenu } from '@/components/layout/platform/PlatformProfileMenu';
import { ModuleSwitcher } from '@/components/layout/ModuleSwitcher';
import { USER_PROFILE_ROUTE } from '@/lib/auth/userprofileroute';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { radius } from '@/theme';

type OrbitTopNavigationProps = {
  area: AppShellArea;
  accentColor: string;
  tabsOverride?: ShellTabConfig[];
};

const webFx =
  Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(26px) saturate(1.22)',
        WebkitBackdropFilter: 'blur(26px) saturate(1.22)',
        boxShadow: '0 16px 44px rgba(37, 78, 128, 0.12)',
      } as unknown as ViewStyle)
    : null;

export function OrbitTopNavigation({
  area,
  accentColor,
  tabsOverride,
}: OrbitTopNavigationProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { tabs, activeTabKey, switcherOpen, openSwitcher, closeSwitcher } = useAppShell(area);
  const effectiveTabs = tabsOverride?.length ? tabsOverride : tabs;
  const compact = width < 760;
  const showFullProfile = width >= 1040;

  const styles = useMemo(() => createStyles(compact, accentColor), [accentColor, compact]);

  return (
    <>
      <View style={[styles.host, webFx]} testID="orbit-top-navigation">
        <View style={styles.identityRow}>
          <Pressable
            onPress={openSwitcher}
            style={styles.brandButton}
            accessibilityRole="button"
            accessibilityLabel="Module öffnen"
          >
            <View style={styles.orbitMark}>
              <View style={styles.orbitCore} />
              <View style={styles.orbitRing} />
            </View>
            <View style={styles.brandTextBlock}>
              <Text style={styles.brand}>CARESUITE</Text>
              <Text style={styles.product}>HEALTHOS · ORBIT</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={openSwitcher}
            style={styles.moduleButton}
            accessibilityRole="button"
          >
            <Text style={styles.moduleButtonText}>Module</Text>
            <Text style={styles.moduleButtonArrow}>⌄</Text>
          </Pressable>

          <View style={styles.profileSlot}>
            {showFullProfile ? (
              <PlatformProfileMenu accentColor={accentColor} />
            ) : (
              <Pressable
                onPress={() => router.push(USER_PROFILE_ROUTE as never)}
                style={styles.profileButton}
                accessibilityRole="button"
                accessibilityLabel="Profil öffnen"
              >
                <Text style={styles.profileButtonText}>Profil</Text>
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
          style={styles.tabScroller}
        >
          {effectiveTabs.map((tab) => {
            const active = tab.key === activeTabKey;
            return (
              <Pressable
                key={tab.key}
                onPress={() => router.push(tab.href as never)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
                {active ? <View style={styles.activeDot} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ModuleSwitcher visible={switcherOpen} onClose={closeSwitcher} />
    </>
  );
}

function createStyles(compact: boolean, accentColor: string) {
  return StyleSheet.create({
    host: {
      flexShrink: 0,
      backgroundColor: 'rgba(255,255,255,0.94)',
      borderWidth: 1,
      borderColor: 'rgba(20,64,112,0.12)',
      borderRadius: compact ? 0 : 24,
      marginHorizontal: compact ? 0 : 14,
      marginTop: compact ? 0 : 12,
      overflow: 'visible',
      zIndex: 40,
    },
    identityRow: {
      minHeight: compact ? 58 : 68,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: compact ? careSpacing.sm : careSpacing.md,
      gap: careSpacing.sm,
    },
    brandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: careSpacing.sm,
      minWidth: 0,
      flexShrink: 1,
    },
    orbitMark: {
      width: compact ? 38 : 44,
      height: compact ? 38 : 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    orbitCore: {
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: accentColor,
      shadowColor: accentColor,
      shadowOpacity: 0.45,
      shadowRadius: 10,
    },
    orbitRing: {
      position: 'absolute',
      width: compact ? 34 : 40,
      height: compact ? 20 : 24,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: `${accentColor}80`,
      transform: [{ rotate: '-22deg' }],
    },
    brandTextBlock: { minWidth: 0 },
    brand: {
      ...careTypography.body,
      color: '#000000',
      fontWeight: '900',
      letterSpacing: 1.4,
      fontSize: compact ? 13 : 15,
    },
    product: {
      ...careTypography.caption,
      color: '#000000',
      fontWeight: '700',
      fontSize: compact ? 9 : 10,
      letterSpacing: 0.8,
    },
    moduleButton: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: compact ? 10 : 16,
      borderRadius: radius.capsule,
      borderWidth: 1,
      borderColor: `${accentColor}55`,
      backgroundColor: `${accentColor}10`,
    },
    moduleButtonText: { color: '#000000', fontWeight: '800', fontSize: compact ? 12 : 14 },
    moduleButtonArrow: { color: '#000000', fontWeight: '900' },
    profileSlot: { marginLeft: 'auto', flexShrink: 0 },
    profileButton: {
      minHeight: 40,
      minWidth: 64,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: radius.capsule,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.12)',
      backgroundColor: '#FFFFFF',
    },
    profileButtonText: { color: '#000000', fontWeight: '800' },
    tabScroller: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.06)',
    },
    tabRow: {
      flexGrow: 1,
      paddingHorizontal: compact ? careSpacing.sm : careSpacing.md,
      paddingVertical: careSpacing.xs,
      gap: compact ? 6 : careSpacing.xs,
    },
    tab: {
      minHeight: compact ? 42 : 46,
      minWidth: compact ? 92 : 112,
      paddingHorizontal: compact ? 10 : 14,
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tabActive: {
      backgroundColor: `${accentColor}12`,
      borderColor: `${accentColor}3D`,
    },
    tabIcon: { fontSize: compact ? 15 : 17 },
    tabLabel: { color: '#000000', fontSize: compact ? 11 : 13, fontWeight: '700' },
    tabLabelActive: { fontWeight: '900' },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: accentColor,
    },
  });
}
