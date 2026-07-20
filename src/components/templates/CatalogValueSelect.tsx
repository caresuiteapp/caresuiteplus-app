import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup } from '@/components/ui/FilterChip';
import { useDropdownOptions } from '@/hooks/templates/useDropdownOptions';
import type { CatalogType } from '@/types/templates';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';

type CatalogValueSelectProps = {
  catalogType: CatalogType;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  wrap?: boolean;
};

export function CatalogValueSelect({
  catalogType,
  value,
  onChange,
  label,
  required,
  error,
  wrap = false,
}: CatalogValueSelectProps) {
  const { colors, typography } = useLegacyTheme();
  const { options, loading, error: loadError } = useDropdownOptions(catalogType);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginBottom: spacing.sm },
        label: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
        hint: { ...typography.caption, color: colors.textMuted, opacity: 0.85 },
        error: { ...typography.caption, color: colors.danger, marginTop: 4 },
      }),
    [colors.danger, colors.textMuted, typography.caption],
  );

  useEffect(() => {
    if (!value && options.length > 0) {
      onChange(options[0].value);
    }
  }, [value, options, onChange]);

  if (loadError) {
    return (
      <View style={styles.wrap}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <Text style={styles.hint}>Keine Katalogwerte verfügbar.</Text>
      </View>
    );
  }

  const chipOptions = options.map((o) => ({ key: o.value, label: o.label }));

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? ' *' : ''}
        </Text>
      ) : null}
      {loading && chipOptions.length === 0 ? (
        <Text style={styles.hint}>Katalog wird geladen…</Text>
      ) : chipOptions.length === 0 ? (
        <Text style={styles.hint}>Keine Katalogwerte verfügbar.</Text>
      ) : (
        <FilterChipGroup options={chipOptions} value={value || chipOptions[0].key} onChange={onChange} wrap={wrap} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
