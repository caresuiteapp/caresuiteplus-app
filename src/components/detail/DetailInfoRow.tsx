import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

type DetailInfoRowProps = {
  label: string;
  value: string | null | undefined;
};

export function DetailInfoRow({ label, value }: DetailInfoRowProps) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  label: {
    ...typography.caption,
    marginBottom: 2,
  },
  value: {
    ...typography.bodyStrong,
  },
});
