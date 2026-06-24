import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import { CATALOG_TYPE_LABELS } from '@/types/modules/catalog';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import type { CatalogListItem } from '@/types/modules/catalog';
import { colors, typography } from '@/theme';

type CatalogsListTableProps = {
  items: CatalogListItem[];
  onItemPress?: (id: string) => void;
};

export function CatalogsListTable({ items, onItemPress }: CatalogsListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'name',
          label: 'Katalog',
          flex: 2,
          render: (item) => <Text style={tableText.name}>{item.name}</Text>,
        },
        {
          key: 'type',
          label: 'Typ',
          flex: 1.2,
          render: (item) => (
            <PremiumBadge label={CATALOG_TYPE_LABELS[item.catalogType]} variant="muted" />
          ),
        },
        {
          key: 'positions',
          label: 'Positionen',
          flex: 0.8,
          render: (item) => <Text style={tableText.cellText}>{item.itemCount}</Text>,
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1,
          render: (item) => (
            <PremiumBadge label={WORKFLOW_STATUS_LABELS[item.status]} variant="muted" />
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
