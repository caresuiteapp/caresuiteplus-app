import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { InsightSnapshotItem } from '@/types/modules/insight';
import { colors, typography } from '@/theme';

type InsightSnapshotsListTableProps = {
  items: InsightSnapshotItem[];
  onItemPress?: (id: string) => void;
};

export function InsightSnapshotsListTable({ items, onItemPress }: InsightSnapshotsListTableProps) {
  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'title',
          label: 'Snapshot',
          flex: 2,
          render: (item) => <Text style={styles.name}>{item.title}</Text>,
        },
        {
          key: 'module',
          label: 'Modul',
          flex: 1.2,
          render: (item) => <Text style={styles.cellText}>{item.moduleLabel}</Text>,
        },
        {
          key: 'updated',
          label: 'Aktualisiert',
          flex: 1.2,
          render: (item) => (
            <Text style={styles.cellText}>
              {new Date(item.updatedAt).toLocaleDateString('de-DE')}
            </Text>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1,
          render: () => <PremiumBadge label="preparedOnly" variant="muted" />,
        },
        {
          key: 'actions',
          label: 'Aktionen',
          width: 100,
          align: 'right',
          render: (item) => (
            <PremiumButton
              title="Details"
              size="sm"
              variant="ghost"
              onPress={() => onItemPress?.(item.id)}
            />
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  name: { ...typography.bodyStrong },
  cellText: { ...typography.body, color: colors.textSecondary },
});
