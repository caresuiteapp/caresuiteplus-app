import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { CareRecordListItem } from '@/types/modules/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type CareRecordsListTableProps = {
  items: CareRecordListItem[];
  onItemPress?: (id: string) => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CareRecordsListTable({ items, onItemPress }: CareRecordsListTableProps) {
  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'assignment',
          label: 'Einsatz',
          flex: 1.6,
          render: (item) => <Text style={styles.name}>{item.assignmentTitle}</Text>,
        },
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.2,
          render: (item) => <Text style={styles.cellText}>{item.clientName}</Text>,
        },
        {
          key: 'employee',
          label: 'Mitarbeiter:in',
          flex: 1.2,
          render: (item) => <Text style={styles.cellText}>{item.employeeName}</Text>,
        },
        {
          key: 'recordedAt',
          label: 'Zeitpunkt',
          flex: 1.1,
          render: (item) => <Text style={styles.cellText}>{formatDate(item.recordedAt)}</Text>,
        },
        {
          key: 'signature',
          label: 'Signatur',
          flex: 0.9,
          render: (item) => (
            <PremiumBadge
              label={item.hasSignature ? 'Ja' : 'Offen'}
              variant={item.hasSignature ? 'green' : 'orange'}
            />
          ),
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.1,
          render: (item) => (
            <PremiumBadge label={WORKFLOW_STATUS_LABELS[item.status]} variant="muted" dot />
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
