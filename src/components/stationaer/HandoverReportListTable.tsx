import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { HandoverReportListItem } from '@/types/modules/stationaer';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { typography } from '@/theme';

type HandoverReportListTableProps = {
  items: HandoverReportListItem[];
  selectedId?: string | null;
  onItemPress?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HandoverReportListTable({
  items,
  selectedId = null,
  onItemPress,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: HandoverReportListTableProps) {
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
          key: 'shift',
          label: 'Schicht',
          flex: 1.2,
          sortable: true,
          render: (item) => <Text style={styles.name}>{item.shiftLabel}</Text>,
        },
        {
          key: 'wing',
          label: 'Bereich',
          flex: 1,
          render: (item) => (
            <Text style={styles.cellText} numberOfLines={1}>
              {item.wing ?? '—'}
            </Text>
          ),
        },
        {
          key: 'author',
          label: 'Autor:in',
          flex: 1.4,
          render: (item) => <Text style={styles.cellText}>{item.authorName}</Text>,
        },
        {
          key: 'handoverAt',
          label: 'Zeitpunkt',
          flex: 1.4,
          sortable: true,
          render: (item) => <Text style={styles.cellText}>{formatDateTime(item.handoverAt)}</Text>,
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.2,
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
              title="Lesen"
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
  cellText: { ...typography.body },
});
