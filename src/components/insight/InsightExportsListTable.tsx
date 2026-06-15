import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { InsightExportItem } from '@/types/modules/insight';
import { colors, typography } from '@/theme';

type InsightExportsListTableProps = {
  items: InsightExportItem[];
  onItemPress?: (id: string) => void;
};

export function InsightExportsListTable({ items, onItemPress }: InsightExportsListTableProps) {
  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'title',
          label: 'Export',
          flex: 2,
          render: (item) => <Text style={styles.name}>{item.title}</Text>,
        },
        {
          key: 'format',
          label: 'Format',
          flex: 0.8,
          render: (item) => <Text style={styles.cellText}>{item.format.toUpperCase()}</Text>,
        },
        {
          key: 'schedule',
          label: 'Rhythmus',
          flex: 1.2,
          render: (item) => <Text style={styles.cellText}>{item.scheduleLabel}</Text>,
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1,
          render: (item) => (
            <PremiumBadge
              label={item.status === 'planned' ? 'Geplant' : 'Pausiert'}
              variant="muted"
            />
          ),
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
