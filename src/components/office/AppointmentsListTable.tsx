import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { AppointmentListItem } from '@/types/modules/appointmentList';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type AppointmentsListTableProps = {
  appointments: AppointmentListItem[];
  selectedId?: string | null;
  onAppointmentPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusVariant(status: AppointmentListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function AppointmentsListTable({
  appointments,
  selectedId = null,
  onAppointmentPress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: AppointmentsListTableProps) {
  return (
    <PremiumDataTable
      data={appointments}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={onAppointmentPress ? (item) => onAppointmentPress(item.id) : undefined}
      columns={[
        {
          key: 'title',
          label: 'Titel',
          flex: 1.5,
          sortable: true,
          render: (item) => <Text style={styles.name}>{item.title}</Text>,
        },
        {
          key: 'clientName',
          label: 'Klient:in',
          flex: 1.2,
          render: (item) => (
            <Text style={styles.meta} numberOfLines={1}>
              {item.clientName}
            </Text>
          ),
        },
        {
          key: 'startsAt',
          label: 'Beginn',
          flex: 1.3,
          sortable: true,
          render: (item) => <Text style={styles.meta}>{formatDateTime(item.startsAt)}</Text>,
        },
        {
          key: 'location',
          label: 'Ort',
          flex: 1,
          render: (item) => (
            <Text style={styles.meta} numberOfLines={1}>
              {item.location ?? '—'}
            </Text>
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
                size="sm"
                onPress={() => onOpenDetail(item.id)}
              />
            ) : null,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  name: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textMuted },
});
