import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { Protocol } from '@/types/modules/beratung';
import { typography } from '@/theme';

type ProtocolRow = Protocol & { caseSubject: string };

type ProtocolsListTableProps = {
  items: ProtocolRow[];
  onItemPress?: (id: string) => void;
};

export function ProtocolsListTable({ items, onItemPress }: ProtocolsListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'case',
          label: 'Fall',
          flex: 2,
          render: (item) => <Text style={tableText.name}>{item.caseSubject}</Text>,
        },
        {
          key: 'recordedAt',
          label: 'Datum',
          flex: 1,
          render: (item) => (
            <Text style={tableText.cellText}>
              {new Date(item.recordedAt).toLocaleDateString('de-DE')}
            </Text>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.2,
          render: (item) => <PremiumBadge label={item.status} variant="muted" />,
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
