import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import { AI_JOB_TYPE_LABELS, type AiJobListItem } from '@/types/modules/platform';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type AiJobsListTableProps = {
  items: AiJobListItem[];
  onItemPress?: (id: string) => void;
};

function statusVariant(status: AiJobListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'in_bearbeitung':
      return 'orange' as const;
    case 'fehlerhaft':
      return 'red' as const;
    default:
      return 'muted' as const;
  }
}

export function AiJobsListTable({ items, onItemPress }: AiJobsListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'prompt',
          label: 'Auftrag',
          flex: 2,
          render: (item) => <Text style={tableText.name} numberOfLines={2}>{item.promptSummary}</Text>,
        },
        {
          key: 'type',
          label: 'Typ',
          flex: 1.4,
          render: (item) => <Text style={tableText.cellText}>{AI_JOB_TYPE_LABELS[item.jobType]}</Text>,
        },
        {
          key: 'provider',
          label: 'Provider',
          flex: 1,
          render: (item) => <Text style={tableText.cellText}>{item.providerKey}</Text>,
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
