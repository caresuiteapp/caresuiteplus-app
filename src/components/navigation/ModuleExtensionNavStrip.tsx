import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useAuroraAdaptiveText, useAuroraGlassChipStyles } from '@/design/tokens/auroraGlass';
import { getModuleExtensionLinks } from '@/lib/navigation/moduleExtensionNav';
import type { ProductKey } from '@/types';
import { spacing, typography } from '@/theme';

type ModuleExtensionNavStripProps = {
  productKey: ProductKey;
  currentPath: string;
};

export function ModuleExtensionNavStrip({ productKey, currentPath }: ModuleExtensionNavStripProps) {
  const router = useRouter();
  const chipStyles = useAuroraGlassChipStyles();
  const text = useAuroraAdaptiveText();
  const links = getModuleExtensionLinks(productKey).filter((l) => l.path !== currentPath);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        chipIcon: { fontSize: 14 },
        chipLabel: {
          ...typography.caption,
          fontWeight: '600',
          color: text.primary,
        },
      }),
    [text.primary],
  );

  if (links.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {links.map((link) => (
        <Pressable
          key={link.path}
          style={({ pressed }) => [chipStyles.chip, styles.chip, pressed && chipStyles.chipPressed]}
          onPress={() => router.push(link.path as never)}
          accessibilityRole="tab"
          accessibilityLabel={link.label}
        >
          <Text style={styles.chipIcon}>{link.icon}</Text>
          <Text style={styles.chipLabel}>{link.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
