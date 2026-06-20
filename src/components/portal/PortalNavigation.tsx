import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import type { ShellTabConfig } from '@/types/navigation/shell';

type PortalNavigationProps = {
  tabs: ShellTabConfig[];
  activeKey?: string;
  accentColor?: string;
  orientation?: 'horizontal' | 'vertical';
};

/** Aurora/Glass portal nav — desktop sidebar or compact row. */
export function PortalNavigation({
  tabs,
  activeKey,
  accentColor,
  orientation = 'vertical',
}: PortalNavigationProps) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();

  return (
    <View style={orientation === 'horizontal' ? styles.row : styles.column}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => router.push(tab.href as never)}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <GlassCard
              style={[
                styles.item,
                active && accentColor ? { borderColor: `${accentColor}66` } : null,
              ]}
            >
              <Text style={styles.icon}>{tab.icon}</Text>
              <Text style={[styles.label, { color: text.primary }]}>{tab.label}</Text>
            </GlassCard>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: careSpacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.md,
  },
  icon: { fontSize: 18 },
  label: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
