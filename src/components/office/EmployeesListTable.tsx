import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import { EmployeeListAvatar } from './EmployeeListAvatar';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type EmployeesListTableProps = {
  employees: EmployeeListItem[];
  selectedId?: string | null;
  onEmployeePress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: EmployeeListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function EmployeesListTable({
  employees,
  selectedId = null,
  onEmployeePress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: EmployeesListTableProps) {
  return (
    <PremiumDataTable
      data={employees}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={
        onEmployeePress
          ? (item) => onEmployeePress(item.id)
          : undefined
      }
      columns={[
        {
          key: 'name',
          label: 'Name',
          flex: 2,
          sortable: true,
          render: (item) => (
            <View style={styles.nameCell}>
              <EmployeeListAvatar
                firstName={item.firstName}
                lastName={item.lastName}
                avatarUrl={item.avatarUrl}
                size="sm"
              />
              <Text style={styles.name}>
                {item.lastName}, {item.firstName}
              </Text>
            </View>
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
          key: 'role',
          label: 'Rolle',
          flex: 1.4,
          sortable: true,
          render: (item) => (
            <Text style={styles.cellText} numberOfLines={1}>
              {item.jobTitle ?? '—'}
            </Text>
          ),
        },
        {
          key: 'email',
          label: 'E-Mail',
          flex: 1.6,
          render: (item) => (
            <Text style={styles.cellText} numberOfLines={1}>
              {item.email ?? '—'}
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
              title="Profil"
              size="sm"
              variant="ghost"
              onPress={() => {
                if (onOpenDetail) {
                  onOpenDetail(item.id);
                  return;
                }
                onEmployeePress?.(item.id);
              }}
            />
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  nameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.bodyStrong,
    flex: 1,
  },
  cellText: {
    ...typography.body,
  },
  muted: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
