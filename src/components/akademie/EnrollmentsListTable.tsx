import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { EnrollmentListItem } from '@/types/modules/akademie';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { typography } from '@/theme';

type EnrollmentsListTableProps = {
  items: EnrollmentListItem[];
  selectedId?: string | null;
  onItemPress?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

export function EnrollmentsListTable({
  items,
  selectedId = null,
  onItemPress,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: EnrollmentsListTableProps) {
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
          key: 'participant',
          label: 'Teilnehmer:in',
          flex: 1.6,
          sortable: true,
          render: (item) => <Text style={styles.name}>{item.participantName}</Text>,
        },
        {
          key: 'course',
          label: 'Kurs',
          flex: 2,
          sortable: true,
          render: (item) => (
            <Text style={styles.cellText} numberOfLines={1}>
              {item.courseTitle}
            </Text>
          ),
        },
        {
          key: 'progress',
          label: 'Fortschritt',
          flex: 1,
          sortable: true,
          render: (item) => (
            <PremiumBadge label={`${item.progressPercent} %`} variant="cyan" />
          ),
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
  cellText: { ...typography.body },
});
