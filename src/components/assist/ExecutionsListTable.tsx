import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import { EXECUTION_PHASE_LABELS } from '@/lib/assist/executionListStats';
import type { ActiveExecutionItem } from '@/types/modules/assist';
import { colors, typography } from '@/theme';

type ExecutionsListTableProps = {
  executions: ActiveExecutionItem[];
  selectedId?: string | null;
  onExecutionPress?: (assignmentId: string) => void;
  onOpenDetail?: (assignmentId: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function phaseVariant(phase: ActiveExecutionItem['phase']) {
  switch (phase) {
    case 'pending':
      return 'orange' as const;
    case 'checked_in':
    case 'in_progress':
      return 'green' as const;
    case 'completed':
      return 'cyan' as const;
    case 'cancelled':
      return 'red' as const;
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

export function ExecutionsListTable({
  executions,
  selectedId = null,
  onExecutionPress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: ExecutionsListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={executions}
      keyExtractor={(item) => item.assignmentId}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={
        onExecutionPress
          ? (item) => onExecutionPress(item.assignmentId)
          : undefined
      }
      columns={[
        {
          key: 'title',
          label: 'Einsatz',
          flex: 2,
          render: (item) => <Text style={tableText.name}>{item.title}</Text>,
        },
        {
          key: 'client',
          label: 'Klient',
          flex: 1.4,
          sortable: true,
          render: (item) => (
            <Text style={tableText.cellText} numberOfLines={1}>
              {item.clientName}
            </Text>
          ),
        },
        {
          key: 'phase',
          label: 'Phase',
          flex: 1.2,
          render: (item) => (
            <PremiumBadge
              label={EXECUTION_PHASE_LABELS[item.phase]}
              variant={phaseVariant(item.phase)}
              dot
            />
          ),
        },
        {
          key: 'time',
          label: 'Zeit',
          flex: 1.6,
          sortable: true,
          render: (item) => (
            <Text style={styles.time} numberOfLines={1}>
              {formatTimeRange(item.scheduledStart, item.scheduledEnd)}
            </Text>
          ),
        },
        {
          key: 'location',
          label: 'Ort',
          flex: 1.4,
          render: (item) => (
            <Text style={tableText.cellText} numberOfLines={1}>
              {item.location}
            </Text>
          ),
        },
        {
          key: 'actions',
          label: 'Aktionen',
          width: 100,
          align: 'right',
          render: (item) => (
            <PremiumButton
              title="Start"
              size="sm"
              variant="ghost"
              onPress={() => {
                if (onOpenDetail) {
                  onOpenDetail(item.assignmentId);
                  return;
                }
                onExecutionPress?.(item.assignmentId);
              }}
            />
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  time: {
    ...typography.caption,
    color: colors.cyan,
  },
});
