import { ReactNode, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { buildPortalNavigation } from '@/lib/portal/engine';
import type { PortalContext } from '@/lib/portal/types';

type AssistPortalShellProps = {
  context: PortalContext;
  children: ReactNode;
  activeSection?: string;
};

/** Assist module shell with dynamic feature nav chips from portal engine. */
export function AssistPortalShell({ context, children, activeSection = 'overview' }: AssistPortalShellProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const router = useRouter();

  const navItems = useMemo(
    () =>
      buildPortalNavigation({
        activeModuleKeys: context.activeModuleKeys,
        hasModuleAssignments: context.hasModuleAssignments,
        primaryModule: context.primaryModule,
        visibleFeatures: context.visibleFeatures,
      }).filter((item) => item.moduleKey === 'assist' || item.navGroup === 'overview'),
    [context],
  );

  return (
    <View style={styles.container}>
      {navItems.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {navItems.map((item) => {
            const sectionKey = item.key.replace('assist-', '').replace('overview', 'overview');
            const isActive =
              item.key === 'overview'
                ? activeSection === 'overview'
                : activeSection === sectionKey;
            return (
              <Pressable
                key={item.key}
                onPress={() => router.push(item.href as never)}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={styles.chipIcon}>{item.icon}</Text>
                <Text style={[type.caption, { color: text.primary }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.md,
    flex: 1,
  },
  tabs: {
    gap: careSpacing.xs,
    paddingBottom: careSpacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: {
    borderColor: 'rgba(255,149,0,0.45)',
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
  chipIcon: {
    fontSize: 14,
  },
});
