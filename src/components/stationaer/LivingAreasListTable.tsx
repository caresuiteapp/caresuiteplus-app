import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { LivingAreaListItem } from '@/types/modules/stationaer';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type LivingAreasListTableProps = {
  items: LivingAreaListItem[];
  selectedId?: string | null;
  onItemPress?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: LivingAreaListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'in_bearbeitung':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function LivingAreasListTable({
  items,
  selectedId = null,
  onItemPress,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: LivingAreasListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'name',
          label: 'Bereich',
          flex: 2,
          sortable: true,
          render: (item) => <Text style={tableText.name}>{item.name}</Text>,
        },
        {
          key: 'wing',
          label: 'Flügel',
          flex: 1.2,
          render: (item) => (
            <Text style={tableText.cellText} numberOfLines={1}>
              {item.wing ?? '—'}
            </Text>
          ),
        },
        {
          key: 'capacity',
          label: 'Kapazität',
          flex: 0.9,
          sortable: true,
          render: (item) => <Text style={tableText.cellText}>{item.capacity}</Text>,
        },
        {
          key: 'occupied',
          label: 'Belegt',
          flex: 0.8,
          sortable: true,
          render: (item) => <Text style={tableText.cellText}>{item.occupiedBeds}</Text>,
        },
        {
          key: 'free',
          label: 'Frei',
          flex: 0.8,
          render: (item) => (
            <PremiumBadge
              label={String(item.freeBeds)}
              variant={item.freeBeds > 0 ? 'green' : 'muted'}
            />
          ),
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.2,
          render: (item) => (
            <PremiumBadge
              label={WORKFLOW_STATUS_LABELS[item.status]}
              variant={statusVariant(item.status)}
              dot
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
});
