import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { PremiumButton, PremiumDataTable } from '@/components/ui';
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

type AssignmentsListTableProps = {
  assignments: AssignmentListItem[];
  selectedId?: string | null;
  onAssignmentPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

export function AssignmentsListTable({
  assignments,
  selectedId = null,
  onAssignmentPress,
  onOpenDetail,
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
          sortable: true,
          render: (item) => (
            <Text style={styles.primary}>{formatWeekday(item.scheduledStart)}</Text>
          ),
        },
        {
          key: 'date',
          label: 'Datum',
          flex: 1,
          sortable: true,
          render: (item) => (
            <Text style={styles.meta}>{formatDate(item.scheduledStart)}</Text>
          ),
        },
        {
          key: 'timeRange',
          label: 'Uhrzeit von bis',
          flex: 1.6,
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
          render: (item) => (
            <Text style={styles.meta}>{formatDurationMinutes(item.durationMinutes) || '—'}</Text>
          ),
        },
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.3,
          sortable: true,
          render: (item) => <Text style={styles.primary}>{item.clientName}</Text>,
        },
        {
          key: 'employee',
          label: 'Mitarbeiter:in',
          flex: 1.3,
          render: (item) => <Text style={styles.meta}>{item.employeeName}</Text>,
        },
        {
          key: 'service',
          label: 'Leistung',
          flex: 1.4,
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
          render: (item) => (
            <StatusBadgesDropdown badges={buildAssignmentStatusBadges(item)} />
          ),
        },
        {
          key: 'actions',
          label: 'Öffnen',
          flex: 0.9,
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
