import { StyleSheet, Text } from 'react-native';
import { useMemo } from 'react';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { AssignmentListItem } from '@/types/modules/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useLegacyTheme } from '@/design/tokens/themeBridge';

type AssignmentsListTableProps = {
  assignments: AssignmentListItem[];
  selectedId?: string | null;
  onAssignmentPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: AssignmentListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const datePart = startDate.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });
  const startTime = startDate.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = endDate.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} · ${startTime}–${endTime}`;
}

export function AssignmentsListTable({
  assignments,
  selectedId = null,
  onAssignmentPress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: AssignmentsListTableProps) {
  const { colors, typography } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        name: { ...typography.bodyStrong, color: colors.textPrimary },
        meta: { ...typography.caption, color: colors.textSecondary },
      }),
    [colors, typography],
  );

  return (
    <PremiumDataTable
      data={assignments}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={onAssignmentPress ? (item) => onAssignmentPress(item.id) : undefined}
      columns={[
        {
          key: 'title',
          label: 'Einsatz',
          flex: 2,
          render: (item) => <Text style={styles.name}>{item.title}</Text>,
        },
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.5,
          sortable: true,
          render: (item) => <Text style={styles.meta}>{item.clientName}</Text>,
        },
        {
          key: 'employee',
          label: 'Mitarbeitende:r',
          flex: 1.5,
          render: (item) => <Text style={styles.meta}>{item.employeeName}</Text>,
        },
        {
          key: 'time',
          label: 'Zeit',
          flex: 1.5,
          sortable: true,
          render: (item) => (
            <Text style={styles.meta}>{formatTimeRange(item.scheduledStart, item.scheduledEnd)}</Text>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1,
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
          label: '',
          flex: 0.8,
          render: (item) =>
            onOpenDetail ? (
              <PremiumButton
                title="Öffnen"
                variant="secondary"
                onPress={() => onOpenDetail(item.id)}
              />
            ) : null,
        },
      ]}
    />
  );
}

