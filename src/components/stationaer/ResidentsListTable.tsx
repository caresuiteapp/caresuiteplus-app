import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import type { ResidentListItem } from '@/types/modules/stationaer';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type ResidentsListTableProps = {
  residents: ResidentListItem[];
  selectedId?: string | null;
  onResidentPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: ResidentListItem['status']) {
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ResidentsListTable({
  residents,
  selectedId = null,
  onResidentPress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: ResidentsListTableProps) {
  return (
    <PremiumDataTable
      data={residents}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={
        onResidentPress
          ? (item) => onResidentPress(item.id)
          : undefined
      }
      columns={[
        {
          key: 'name',
          label: 'Name',
          flex: 2,
          sortable: true,
          render: (item) => (
            <Text style={styles.name}>
              {item.lastName}, {item.firstName}
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
          key: 'room',
          label: 'Zimmer',
          flex: 1,
          render: (item) => (
            <Text style={styles.cellText} numberOfLines={1}>
              {item.roomName ?? '—'}
            </Text>
          ),
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
          key: 'careLevel',
          label: 'Pflegegrad',
          flex: 0.9,
          render: (item) =>
            item.careLevel ? (
              <PremiumBadge label={formatCareLevel(item.careLevel)} variant="cyan" />
            ) : (
              <Text style={styles.muted}>—</Text>
            ),
        },
        {
          key: 'admission',
          label: 'Aufnahme',
          flex: 1,
          sortable: true,
          render: (item) => (
            <Text style={styles.cellText}>{formatDate(item.admissionDate)}</Text>
          ),
        },
        {
          key: 'actions',
          label: 'Aktionen',
          width: 100,
          align: 'right',
          render: (item) => (
            <PremiumButton
              title="Akte"
              size="sm"
              variant="ghost"
              onPress={() => {
                if (onOpenDetail) {
                  onOpenDetail(item.id);
                  return;
                }
                onResidentPress?.(item.id);
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
  muted: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
