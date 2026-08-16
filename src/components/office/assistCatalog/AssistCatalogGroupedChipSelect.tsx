import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { spacing, typography } from "@/theme";
import type { CatalogItem } from "@/types/assistCatalog";

const GROUP_LABELS: Record<string, string> = {
  regelversorgung: "Regelversorgung",
  zusatzversorgung: "Zusatzversorgung",
  aufnahme: "Aufnahme",
  besonderheiten: "Besonderheiten",
};

type Props = {
  label: string;
  items: CatalogItem[];
  value: string;
  onChange: (itemKey: string) => void;
  error?: string;
};

function groupItems(items: CatalogItem[]) {
  const map = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const key = String(item.payloadJson?.groupKey ?? "sonstiges");
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "de"))
    .map(([groupKey, entries]) => ({
      groupKey,
      label: GROUP_LABELS[groupKey] ?? groupKey.replace(/_/g, " "),
      items: entries.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    }));
}

export function AssistCatalogGroupedChipSelect({
  label,
  items,
  value,
  onChange,
  error,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {groupItems(items).map((group) => (
        <View key={group.groupKey} style={styles.group}>
          <Text style={styles.groupTitle}>{group.label}</Text>
          <View style={styles.row}>
            {group.items.map((item) => {
              const selected = value === item.itemKey;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => onChange(item.itemKey)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    ...typography.caption,
    color: "#EAF5FF",
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  group: { marginBottom: spacing.sm },
  groupTitle: {
    ...typography.caption,
    color: "#BFD8EB",
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
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
  error: { ...typography.caption, color: "#FF8F9F", marginTop: spacing.xs },
});
