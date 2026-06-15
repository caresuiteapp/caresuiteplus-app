import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SystemCatalogKey } from '@/lib/catalogs/systemCatalog.types';
import { useSystemCatalog } from '@/hooks/useSystemCatalog';
import { colors, spacing, typography } from '@/theme';

type Props = {
  catalogKey: SystemCatalogKey;
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  error?: string;
};

export function CareMultiCatalogSelect({ catalogKey, label, values, onChange, error }: Props) {
  const { options } = useSystemCatalog(catalogKey);

  const toggle = (val: string) => {
    if (values.includes(val)) onChange(values.filter((v) => v !== val));
    else onChange([...values, val]);
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.grid}>
        {options.map((opt) => {
          const selected = values.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggle(opt.value)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.label, marginBottom: spacing.xs, color: colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgSurface,
  },
  chipSelected: { borderColor: colors.orange, backgroundColor: colors.borderOrange },
  chipText: { ...typography.caption, color: colors.textPrimary },
  chipTextSelected: { color: colors.orange, fontWeight: '600' },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
});
