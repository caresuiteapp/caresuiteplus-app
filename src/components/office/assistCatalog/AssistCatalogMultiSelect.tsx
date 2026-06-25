import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAssistCatalogItems } from '@/hooks/assistCatalog/useAssistCatalog';
import {
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useAuroraGlassChipStyles,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { moduleColor } from '@/design/tokens/modules';
import { spacing, typography, colors } from '@/theme';
import type { CatalogItem } from '@/types/assistCatalog';

const FORM_CTX = { viewContext: 'form' as const };

type AssistCatalogMultiSelectProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  error?: string;
  /** Load items from catalog when preloaded list is not provided. */
  catalogKey?: string;
  /** Preloaded catalog items (e.g. from useAssistAssignmentOptions). */
  items?: CatalogItem[];
  loading?: boolean;
};

type ChipListProps = {
  label: string;
  items: CatalogItem[];
  values: string[];
  onChange: (values: string[]) => void;
  loading?: boolean;
  error?: string;
};

function CatalogChipList({ label, items, values, onChange, loading, error }: ChipListProps) {
  const { isLight } = useLegacyTheme();
  const auroraActive = useAuroraGlassActive();
  const glassChips = useAuroraGlassChipStyles(FORM_CTX);
  const text = useAuroraAdaptiveText();
  const useGlass = isLight && auroraActive;
  const assistAccent = moduleColor('assist');

  const toggle = (key: string) => {
    onChange(values.includes(key) ? values.filter((v) => v !== key) : [...values, key]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: text.primary }]}>{label}</Text>
      {loading ? <Text style={[styles.hint, { color: text.muted }]}>Katalog wird geladen…</Text> : null}
      {!loading && items.length === 0 ? (
        <Text style={[styles.hint, { color: text.muted }]}>Keine Katalogeinträge verfügbar.</Text>
      ) : null}
      <View style={styles.row}>
        {items.map((item) => {
          const selected = values.includes(item.itemKey);
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                useGlass ? glassChips.chip : styles.chip,
                selected &&
                  (useGlass
                    ? glassChips.chipSelected
                    : { borderColor: assistAccent, backgroundColor: `${assistAccent}22` }),
              ]}
              onPress={() => toggle(item.itemKey)}
            >
              <Text
                style={[
                  useGlass ? glassChips.label : [styles.chipText, { color: text.primary }],
                  selected &&
                    (useGlass
                      ? glassChips.labelSelected
                      : { fontWeight: '600', color: assistAccent }),
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function AssistCatalogMultiSelectFromCatalog({
  catalogKey,
  ...rest
}: AssistCatalogMultiSelectProps & { catalogKey: string }) {
  const { items, loading } = useAssistCatalogItems(catalogKey);
  return <CatalogChipList items={items} loading={loading} {...rest} />;
}

export function AssistCatalogMultiSelect(props: AssistCatalogMultiSelectProps) {
  if (props.items) {
    return (
      <CatalogChipList
        label={props.label}
        items={props.items}
        values={props.values}
        onChange={props.onChange}
        loading={props.loading}
        error={props.error}
      />
    );
  }
  if (!props.catalogKey) {
    return (
      <CatalogChipList
        label={props.label}
        items={[]}
        values={props.values}
        onChange={props.onChange}
        loading={props.loading}
        error={props.error}
      />
    );
  }
  return <AssistCatalogMultiSelectFromCatalog {...props} catalogKey={props.catalogKey} />;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.caption, marginBottom: spacing.xs },
  hint: { ...typography.caption, marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chipText: { ...typography.caption },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
});
