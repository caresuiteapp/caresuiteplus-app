import { ScrollView, StyleSheet } from 'react-native';
import { FilterChipGroup } from '@/components/ui';
import { spacing } from '@/theme';
import type { ThreadListFilter } from '@/features/communication/communication.types';

type ConversationFilterBarProps = {
  filter: ThreadListFilter;
  onChange: (filter: ThreadListFilter) => void;
  filters: { key: ThreadListFilter; label: string }[];
};

export function ConversationFilterBar({ filter, onChange, filters }: ConversationFilterBarProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <FilterChipGroup
        options={filters.map((f) => ({ key: f.key, label: f.label }))}
        value={filter}
        onChange={(v) => onChange(v as ThreadListFilter)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
});
