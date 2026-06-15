import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup } from '@/components/ui/FilterChip';
import { ErrorState } from '@/components/ui/StateViews';
import { useDropdownOptions } from '@/hooks/templates/useDropdownOptions';
import type { CatalogType } from '@/types/templates';
import { spacing, typography } from '@/theme';

type CatalogValueSelectProps = {
  catalogType: CatalogType;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
};

export function CatalogValueSelect({
  catalogType,
  value,
  onChange,
  label,
  required,
  error,
}: CatalogValueSelectProps) {
  const { options, loading, error: loadError } = useDropdownOptions(catalogType);

  useEffect(() => {
    if (!value && options.length > 0) {
      onChange(options[0].value);
    }
  }, [value, options, onChange]);

  if (loadError) {
    return <ErrorState title="Katalog" message={loadError} />;
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
        <FilterChipGroup options={chipOptions} value={value || chipOptions[0].key} onChange={onChange} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  label: { ...typography.caption, marginBottom: spacing.xs },
  hint: { ...typography.caption, opacity: 0.7 },
  error: { ...typography.caption, color: '#FF6B6B', marginTop: 4 },
});
