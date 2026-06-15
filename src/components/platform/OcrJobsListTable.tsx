import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { OcrJobListItem } from '@/types/modules/platform';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type OcrJobsListTableProps = {
  items: OcrJobListItem[];
  onItemPress?: (id: string) => void;
};

function statusVariant(status: OcrJobListItem['status']) {
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

export function OcrJobsListTable({ items, onItemPress }: OcrJobsListTableProps) {
  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'document',
          label: 'Dokument',
          flex: 2,
          render: (item) => <Text style={styles.name}>{item.sourceDocumentTitle}</Text>,
        },
        {
          key: 'provider',
          label: 'Provider',
          flex: 1.2,
          render: (item) => <Text style={styles.cellText}>{item.providerKey}</Text>,
        },
        {
          key: 'confidence',
          label: 'Konfidenz',
          flex: 0.9,
          render: (item) => (
            <Text style={styles.cellText}>
              {item.confidence != null ? `${Math.round(item.confidence * 100)}%` : '—'}
            </Text>
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
  name: { ...typography.bodyStrong },
  cellText: { ...typography.body, color: colors.textSecondary },
});
