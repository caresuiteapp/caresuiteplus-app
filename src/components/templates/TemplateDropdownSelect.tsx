import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup } from '@/components/ui/FilterChip';
import { useTemplates } from '@/hooks/templates/useTemplates';
import type { TemplateListFilters } from '@/types/templates';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';

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
  const { colors, typography } = useLegacyTheme();
  const { templates, loading, error: loadError } = useTemplates(filters);

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
    if (!value && templates.length > 0) {
      const def = templates.find((t) => t.isDefault) ?? templates[0];
      onChange(def.id, def.content);
    }
  }, [value, templates, onChange]);

  if (loadError) {
    return (
      <View style={styles.wrap}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <Text style={styles.hint}>Keine Vorlagen verfügbar.</Text>
      </View>
    );
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
