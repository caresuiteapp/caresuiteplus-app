import { StyleSheet, Text, View } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import { ClientAnimalAvatar } from '@/components/clients/ClientAnimalAvatar';
import type { ClientListItem } from '@/types/modules/office';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';

type ClientsListTableProps = {
  clients: ClientListItem[];
  selectedId?: string | null;
  onClientPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: ClientListItem['status']) {
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

export function ClientsListTable({
  clients,
  selectedId = null,
  onClientPress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: ClientsListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={clients}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      emptyMessage="Keine Klient:innen in dieser Ansicht"
      onRowPress={
        onClientPress
          ? (item) => onClientPress(item.id)
          : undefined
      }
      columns={[
        {
          key: 'name',
          label: 'Name',
          flex: 2,
          sortable: true,
          render: (item) => (
            <View style={styles.identity}>
              <ClientAnimalAvatar
                clientId={item.id}
                clientName={`${item.firstName} ${item.lastName}`.trim()}
                size={34}
              />
              <Text style={[tableText.name, styles.name]} numberOfLines={1}>
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
          key: 'city',
          label: 'Ort',
          flex: 1.2,
          sortable: true,
          render: (item) => (
            <Text style={[tableText.cellText, styles.cellText]} numberOfLines={1}>
              {item.city ?? '—'}
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
              <Text style={styles.meta}>—</Text>
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
                onClientPress?.(item.id);
              }}
            />
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    color: '#0B2342',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  cellText: {
    color: '#173B61',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  meta: {
    color: '#526F8C',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
