import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { VitalReadingListItem } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type VitalReadingsListTableProps = {
  readings: VitalReadingListItem[];
  selectedId?: string | null;
  onReadingPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: VitalReadingListItem['status']) {
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

function formatMeasuredAt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VitalReadingsListTable({
  readings,
  selectedId = null,
  onReadingPress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: VitalReadingsListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={readings}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={onReadingPress ? (item) => onReadingPress(item.id) : undefined}
      columns={[
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.4,
          sortable: true,
          render: (item) => <Text style={tableText.name}>{item.clientName}</Text>,
        },
        {
          key: 'type',
          label: 'Messart',
          flex: 1.2,
          render: (item) => (
            <Text style={tableText.cellText} numberOfLines={1}>
              {item.typeLabel}
            </Text>
          ),
        },
        {
          key: 'value',
          label: 'Wert',
          flex: 1,
          render: (item) => (
            <Text style={[styles.value, item.isAlert ? styles.alertValue : null]}>
              {item.value} {item.unit}
            </Text>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.1,
          render: (item) => (
            <PremiumBadge
              label={WORKFLOW_STATUS_LABELS[item.status]}
              variant={statusVariant(item.status)}
              dot
            />
          ),
        },
        {
          key: 'measured',
          label: 'Gemessen',
          flex: 1.2,
          sortable: true,
          render: (item) => (
            <Text style={styles.time} numberOfLines={1}>
              {formatMeasuredAt(item.measuredAt)}
            </Text>
          ),
        },
        {
          key: 'flags',
          label: 'Hinweis',
          flex: 0.9,
          render: (item) => (
            <Text style={styles.flags}>
              {item.isAlert ? '⚠ Auffällig' : item.isDue ? '⏱ Fällig' : '—'}
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
              title="Detail"
              size="sm"
              variant="ghost"
              onPress={() => {
                if (onOpenDetail) {
                  onOpenDetail(item.id);
                  return;
                }
                onReadingPress?.(item.id);
              }}
            />
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  value: { ...typography.bodyStrong },
  alertValue: { color: colors.danger },
  time: { ...typography.caption, color: colors.cyan },
  flags: { ...typography.caption, color: colors.textMuted },
});
