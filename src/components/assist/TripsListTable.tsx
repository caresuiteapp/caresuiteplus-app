import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import { PURPOSE_LABELS } from '@/lib/assist';
import type { TripLogListItem } from '@/types/modules/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type TripsListTableProps = {
  trips: TripLogListItem[];
  selectedId?: string | null;
  onTripPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: TripLogListItem['status']) {
  switch (status) {
    case 'in_bearbeitung':
      return 'green' as const;
    case 'abgeschlossen':
      return 'cyan' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'aktiv':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

function formatStartedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TripsListTable({
  trips,
  selectedId = null,
  onTripPress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: TripsListTableProps) {
  return (
    <PremiumDataTable
      data={trips}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={
        onTripPress
          ? (item) => onTripPress(item.id)
          : undefined
      }
      columns={[
        {
          key: 'driver',
          label: 'Fahrer',
          flex: 1.6,
          sortable: true,
          render: (item) => <Text style={styles.name}>{item.employeeName}</Text>,
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
          key: 'purpose',
          label: 'Zweck',
          flex: 1.2,
          render: (item) => (
            <Text style={styles.cellText} numberOfLines={1}>
              {PURPOSE_LABELS[item.purpose]}
            </Text>
          ),
        },
        {
          key: 'route',
          label: 'Route',
          flex: 2,
          render: (item) => (
            <Text style={styles.cellText} numberOfLines={2}>
              {item.routeSummary}
            </Text>
          ),
        },
        {
          key: 'time',
          label: 'Zeit',
          flex: 1.2,
          sortable: true,
          render: (item) => (
            <Text style={styles.time} numberOfLines={1}>
              {formatStartedAt(item.startedAt)}
            </Text>
          ),
        },
        {
          key: 'distance',
          label: 'km',
          width: 56,
          align: 'right',
          render: (item) => (
            <Text style={styles.distance}>
              {item.distanceKm != null ? `${item.distanceKm}` : '—'}
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
              title="Fahrt"
              size="sm"
              variant="ghost"
              onPress={() => {
                if (onOpenDetail) {
                  onOpenDetail(item.id);
                  return;
                }
                onTripPress?.(item.id);
              }}
            />
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  name: {
    ...typography.bodyStrong,
  },
  cellText: {
    ...typography.body,
  },
  time: {
    ...typography.caption,
    color: colors.cyan,
  },
  distance: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
