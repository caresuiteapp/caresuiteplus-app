import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import { EmployeeListAvatar } from './EmployeeListAvatar';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';

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
  const tableText = useTableTextStyles();

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
                size="lg"
              />
              <Text style={[tableText.name, styles.nameFlex]} numberOfLines={1}>
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
          flex: 1.8,
          sortable: true,
          render: (item) => (
            <Text style={tableText.cellText} numberOfLines={1}>
              {resolveEmployeeRoleLabel(item.jobTitle)}
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
    gap: 14,
    flex: 1,
    minWidth: 0,
  },
  nameFlex: {
    flex: 1,
  },
});
