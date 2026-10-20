import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAssistCatalogItems } from "@/hooks/assistCatalog/useAssistCatalog";
import { spacing, typography, colors } from "@/theme";
import type { CatalogItem } from "@/types/assistCatalog";

type Props = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  error?: string;
  catalogKey?: string;
  items?: CatalogItem[];
  loading?: boolean;
};

type ChipListProps = Omit<Props, "catalogKey"> & { items: CatalogItem[] };

function CatalogChipList({
  label,
  items,
  values,
  onChange,
  loading,
  error,
}: ChipListProps) {
  const toggle = (key: string) => {
    onChange(
      values.includes(key)
        ? values.filter((value) => value !== key)
        : [...values, key],
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {loading ? <Text style={styles.hint}>Katalog wird geladen…</Text> : null}
      {!loading && items.length === 0 ? (
        <Text style={styles.hint}>Keine Katalogeinträge verfügbar.</Text>
      ) : null}
      <View style={styles.row}>
        {items.map((item) => {
          const selected = values.includes(item.itemKey);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggle(item.itemKey)}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
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

function FromCatalog({ catalogKey, ...rest }: Props & { catalogKey: string }) {
  const { items, loading } = useAssistCatalogItems(catalogKey);
  return <CatalogChipList items={items} loading={loading} {...rest} />;
}

export function AssistCatalogMultiSelect(props: Props) {
  if (props.items) return <CatalogChipList {...props} items={props.items} />;
  if (!props.catalogKey) return <CatalogChipList {...props} items={[]} />;
  return <FromCatalog {...props} catalogKey={props.catalogKey} />;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    ...typography.caption,
    color: "#EAF5FF",
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  hint: { ...typography.caption, color: "#AFC8DA", marginBottom: spacing.xs },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(105, 215, 255, 0.34)",
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: "#123452",
  },
  chipSelected: { borderColor: "#69D7FF", backgroundColor: "#155386" },
  chipText: { ...typography.caption, color: "#D5E8F7", fontWeight: "700" },
  chipTextSelected: { color: "#FFFFFF", fontWeight: "800" },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
});
