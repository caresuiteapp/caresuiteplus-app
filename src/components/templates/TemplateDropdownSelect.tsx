import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup } from '@/components/ui/FilterChip';
import { ErrorState } from '@/components/ui/StateViews';
import { useTemplates } from '@/hooks/templates/useTemplates';
import type { TemplateListFilters } from '@/types/templates';
import { spacing, typography } from '@/theme';

type TemplateDropdownSelectProps = {
  filters?: TemplateListFilters;
  value: string;
  onChange: (templateId: string, content: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
};

export function TemplateDropdownSelect({
  filters = { status: 'active' },
  value,
  onChange,
  label,
  required,
  error,
}: TemplateDropdownSelectProps) {
  const { templates, loading, error: loadError } = useTemplates(filters);

  useEffect(() => {
    if (!value && templates.length > 0) {
      const def = templates.find((t) => t.isDefault) ?? templates[0];
      onChange(def.id, def.content);
    }
  }, [value, templates, onChange]);

  if (loadError) {
    return <ErrorState title="Vorlagen" message={loadError} />;
  }

  const chipOptions = templates.map((t) => ({ key: t.id, label: t.title }));

  const handleChange = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    onChange(templateId, tpl?.content ?? '');
  };

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? ' *' : ''}
        </Text>
      ) : null}
      {loading && chipOptions.length === 0 ? (
        <Text style={styles.hint}>Vorlagen werden geladen…</Text>
      ) : chipOptions.length === 0 ? (
        <Text style={styles.hint}>Keine Vorlagen verfügbar.</Text>
      ) : (
        <FilterChipGroup
          options={chipOptions}
          value={value || chipOptions[0].key}
          onChange={handleChange}
        />
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
