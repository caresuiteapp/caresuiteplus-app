import { StyleSheet, Text, View } from 'react-native';
import type { KIMMessageStatus } from '@/types/modules/ti';
import { FilterChipGroup, PremiumInput } from '@/components/ui';
import { spacing, typography } from '@/theme';

type FilterOption = { key: KIMMessageStatus | 'all'; label: string };

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: KIMMessageStatus | 'all';
  onStatusChange: (value: KIMMessageStatus | 'all') => void;
  statusFilters: FilterOption[];
  filteredCount: number;
  totalCount: number;
};

export function KIMFilterToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  statusFilters,
  filteredCount,
  totalCount,
}: Props) {
  return (
    <View style={styles.toolbar}>
      <PremiumInput
        label="Suche"
        placeholder="Absender oder Betreff…"
        value={search}
        onChangeText={onSearchChange}
        hint={`${filteredCount} von ${totalCount} Nachrichten`}
        accessibilityLabel="KIM-Nachrichten durchsuchen"
      />
      <Text style={styles.filterLabel}>Filter</Text>
      <FilterChipGroup options={statusFilters} value={statusFilter} onChange={onStatusChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { gap: spacing.sm },
  filterLabel: { ...typography.caption, marginTop: spacing.xs },
});
