import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { PremiumButton, PremiumDataTable } from '@/components/ui';
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import {
  buildAssignmentStatusBadges,
  StatusBadgesDropdown,
} from '@/components/assist/StatusBadgesDropdown';
import type { AssignmentListItem } from '@/types/modules/assist';
import {
  formatAssignmentTimeRange,
  formatDate,
  formatDurationMinutes,
  formatWeekday,
} from '@/lib/formatters/dateTimeFormatters';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { isAssignmentListItemDeletable } from '@/lib/assist/assignmentCardPresentation';
import type { ServiceResult } from '@/types';

type AssignmentsListTableProps = {
  assignments: AssignmentListItem[];
  selectedId?: string | null;
  onAssignmentPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  onDelete?: (id: string) => Promise<ServiceResult<void>>;
  onDeleted?: () => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

export function AssignmentsListTable({
  assignments,
  selectedId = null,
  onAssignmentPress,
  onOpenDetail,
  onDelete,
  onDeleted,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: AssignmentsListTableProps) {
  const tableText = useTableTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        primary: tableText.name,
        meta: { ...tableText.meta, fontSize: 13 },
        actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
      }),
    [tableText],
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
          key: 'weekday',
          label: 'Wochentag',
          flex: 1,
          minWidth: 92,
          sortable: true,
          render: (item) => (
            <Text style={styles.primary}>{formatWeekday(item.scheduledStart)}</Text>
          ),
        },
        {
          key: 'date',
          label: 'Datum',
          flex: 1,
          minWidth: 96,
          sortable: true,
          render: (item) => (
            <Text style={styles.meta}>{formatDate(item.scheduledStart)}</Text>
          ),
        },
        {
          key: 'timeRange',
          label: 'Uhrzeit von bis',
          flex: 1.6,
          minWidth: 128,
          sortable: true,
          render: (item) => (
            <Text style={styles.meta}>
              {formatAssignmentTimeRange(item.scheduledStart, item.scheduledEnd)}
            </Text>
          ),
        },
        {
          key: 'duration',
          label: 'Zeit insgesamt',
          flex: 1,
          minWidth: 112,
          render: (item) => (
            <Text style={styles.meta}>{formatDurationMinutes(item.durationMinutes) || '—'}</Text>
          ),
        },
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.3,
          minWidth: 120,
          sortable: true,
          render: (item) => <Text style={styles.primary}>{item.clientName}</Text>,
        },
        {
          key: 'employee',
          label: 'Mitarbeiter:in',
          flex: 1.3,
          minWidth: 120,
          render: (item) => <Text style={styles.meta}>{item.employeeName}</Text>,
        },
        {
          key: 'service',
          label: 'Leistung',
          flex: 1.4,
          minWidth: 140,
          render: (item) => (
            <View>
              <Text style={styles.meta}>{item.serviceName ?? item.title}</Text>
              {item.serviceName && item.serviceName !== item.title ? (
                <Text style={styles.meta}>{item.title}</Text>
              ) : null}
            </View>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.2,
          minWidth: 100,
          render: (item) => (
            <StatusBadgesDropdown badges={buildAssignmentStatusBadges(item)} />
          ),
        },
        {
          key: 'actions',
          label: 'Aktionen',
          flex: 1.8,
          minWidth: 190,
          render: (item) => (
            <View style={styles.actions}>
              {onOpenDetail ? (
                <PremiumButton
                  title="Öffnen"
                  variant="secondary"
                  size="sm"
                  onPress={() => onOpenDetail(item.id)}
                />
              ) : null}
              {onDelete && isAssignmentListItemDeletable(item) ? (
                <OfficeRecordDeleteButton
                  recordLabel="Einsatz"
                  displayName={`${item.clientName} · ${formatDate(item.scheduledStart)}`}
                  onDelete={() => onDelete(item.id)}
                  onDeleted={onDeleted}
                  confirmTitle="Einsatz endgültig löschen?"
                  buttonTitle="Löschen"
                  fullWidth={false}
                />
              ) : null}
            </View>
          ),
        },
      ]}
    />
  );
}
