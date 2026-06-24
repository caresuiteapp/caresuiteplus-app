import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumDataTable } from '@/components/ui';
import type { ShiftScheduleListItem } from '@/lib/pflege/shiftScheduleDemo';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { typography } from '@/theme';

type ShiftScheduleListTableProps = {
  items: ShiftScheduleListItem[];
  selectedId?: string | null;
};

function statusVariant(status: ShiftScheduleListItem['status']) {
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

export function ShiftScheduleListTable({
  items,
  selectedId = null,
}: ShiftScheduleListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      columns={[
        {
          key: 'employee',
          label: 'Mitarbeiter:in',
          flex: 1.3,
          render: (item) => <Text style={tableText.title}>{item.employeeName}</Text>,
        },
        {
          key: 'role',
          label: 'Rolle',
          flex: 1.1,
          render: (item) => <Text style={tableText.cellText}>{item.roleLabel}</Text>,
        },
        {
          key: 'date',
          label: 'Datum',
          flex: 1,
          render: (item) => (
            <Text style={tableText.cellText}>
              {new Date(item.shiftDate).toLocaleDateString('de-DE')}
            </Text>
          ),
        },
        {
          key: 'time',
          label: 'Zeit',
          flex: 1,
          render: (item) => (
            <Text style={tableText.cellText}>
              {item.startTime} – {item.endTime}
            </Text>
          ),
        },
        {
          key: 'location',
          label: 'Einsatzort',
          flex: 1.2,
          render: (item) => (
            <Text style={tableText.cellText} numberOfLines={1}>
              {item.location}
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
      ]}
    />
  );
}

const styles = StyleSheet.create({
});
