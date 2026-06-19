import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PlatformModal } from '@/components/layout/platform';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import type { ShellTabConfig } from '@/types/navigation/shell';

type PortalMoreMenuProps = {
  visible: boolean;
  tabs: ShellTabConfig[];
  activeKey: string;
  accentColor?: string;
  onClose: () => void;
};

/** Overflow drawer for portal bottom nav — full dynamic nav from buildPortalNavigation. */
export function PortalMoreMenu({
  visible,
  tabs,
  activeKey,
  accentColor = auroraGlass.chipActive,
  onClose,
}: PortalMoreMenuProps) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  const navigate = (tab: ShellTabConfig) => {
    onClose();
    router.push(tab.href as never);
  };

  return (
    <PlatformModal visible={visible} onClose={onClose} title="Navigation">
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              onPress={() => navigate(tab)}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <GlassCard style={[styles.row, active && { borderColor: `${accentColor}55` }]}>
                <Text style={styles.icon}>{tab.icon}</Text>
                <View style={styles.copy}>
                  <Text
                    style={[
                      type.body,
                      { color: active ? text.primary : text.secondary, fontWeight: active ? '700' : '600' },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </View>
                {active ? (
                  <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
                ) : null}
              </GlassCard>
            </Pressable>
          );
        })}
      </ScrollView>
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: careSpacing.sm,
    paddingBottom: careSpacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.md,
    paddingVertical: careSpacing.sm,
  },
  icon: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  copy: {
    flex: 1,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pressed: {
    opacity: 0.88,
  },
});
