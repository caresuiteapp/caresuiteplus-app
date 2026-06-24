import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { InsightDataSourceItem } from '@/types/modules/insight';
import { colors, typography } from '@/theme';

type InsightDataSourcesListTableProps = {
  items: InsightDataSourceItem[];
  onItemPress?: (id: string) => void;
};

function connectionVariant(status: InsightDataSourceItem['connectionStatus']) {
  switch (status) {
    case 'connected':
      return 'green' as const;
    case 'error':
      return 'red' as const;
    default:
      return 'muted' as const;
  }
}

export function InsightDataSourcesListTable({ items, onItemPress }: InsightDataSourcesListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'label',
          label: 'Quelle',
          flex: 2,
          render: (item) => <Text style={tableText.name}>{item.label}</Text>,
        },
        {
          key: 'module',
          label: 'Modul',
          flex: 1.2,
          render: (item) => <Text style={tableText.cellText}>{item.moduleKey}</Text>,
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.2,
          render: (item) => (
            <PremiumBadge label={item.connectionStatus} variant={connectionVariant(item.connectionStatus)} />
          ),
        },
        {
          key: 'sync',
          label: 'Letzter Sync',
          flex: 1.2,
          render: (item) => (
            <Text style={tableText.cellText}>
              {item.lastSyncAt
                ? new Date(item.lastSyncAt).toLocaleDateString('de-DE')
                : '—'}
            </Text>
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
});
