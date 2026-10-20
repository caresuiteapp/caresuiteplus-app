import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

type ClientDetailLinkTileProps = {
  icon: string;
  label: string;
  count: number;
  accentColor?: string;
  onPress?: () => void;
};

export function ClientDetailLinkTile({
  icon,
  label,
  count,
  accentColor = colors.cyan,
  onPress,
}: ClientDetailLinkTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.tile}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}`}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.count, { color: accentColor }]}>{count}</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgElevated,
    minWidth: '47%',
    flexGrow: 1,
  },
  icon: {
    fontSize: 18,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  count: {
    ...typography.bodyStrong,
  },
  arrow: {
    ...typography.body,
    color: colors.orange,
    fontWeight: '700',
  },
});
