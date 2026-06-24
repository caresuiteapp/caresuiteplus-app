import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { FollowUp } from '@/types/modules/beratung';
import { typography } from '@/theme';

type FollowUpsListTableProps = {
  items: FollowUp[];
  onItemPress?: (id: string) => void;
};

export function FollowUpsListTable({ items, onItemPress }: FollowUpsListTableProps) {
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
          key: 'dueAt',
          label: 'Fällig',
          flex: 1,
          render: (item) => (
            <Text style={tableText.cellText}>{new Date(item.dueAt).toLocaleDateString('de-DE')}</Text>
          ),
        },
        {
          key: 'assignee',
          label: 'Zuständig',
          flex: 1.2,
          render: (item) => <Text style={tableText.cellText}>{item.assigneeName}</Text>,
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.1,
          render: (item) => <PremiumBadge label={item.status} variant="orange" dot />,
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
