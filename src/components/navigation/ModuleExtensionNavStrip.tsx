import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { getModuleExtensionLinks } from '@/lib/navigation/moduleExtensionNav';
import type { ProductKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

type ModuleExtensionNavStripProps = {
  productKey: ProductKey;
  currentPath: string;
};

export function ModuleExtensionNavStrip({ productKey, currentPath }: ModuleExtensionNavStripProps) {
  const router = useRouter();
  const links = getModuleExtensionLinks(productKey).filter((l) => l.path !== currentPath);

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
          style={styles.chip}
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipIcon: { fontSize: 14 },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
});
