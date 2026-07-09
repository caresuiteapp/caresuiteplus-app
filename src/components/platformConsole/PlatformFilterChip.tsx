import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PLATFORM_COLORS } from './PlatformShellLayout';
import { spacing } from '@/theme';

type PlatformFilterChipProps = {
  label: string;
  active?: boolean;
  onPress: () => void;
};

export function PlatformFilterChip({ label, active = false, onPress }: PlatformFilterChipProps) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PlatformFilterChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    width: '100%',
  },
  chip: {
    alignSelf: 'flex-start',
    minHeight: 32,
    maxHeight: 36,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    backgroundColor: PLATFORM_COLORS.panel,
  },
  chipActive: {
    borderColor: PLATFORM_COLORS.accent,
    backgroundColor: '#F1F5F9',
  },
  chipText: {
    color: PLATFORM_COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  chipTextActive: {
    color: PLATFORM_COLORS.accent,
    fontWeight: '600',
  },
});
