import { StyleSheet, Text } from 'react-native';
import { useMemo } from 'react';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { ClientListItem } from '@/types/modules/office';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';

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
  const text = useAuroraAdaptiveText();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        name: {
          color: text.primary,
          fontWeight: '700',
          fontSize: 15,
        },
        cellText: {
          color: text.primary,
          fontSize: 14,
        },
        muted: {
          color: text.muted,
          fontSize: 13,
        },
      }),
    [text],
  );

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
          key: 'city',
          label: 'Ort',
          flex: 1.2,
          sortable: true,
          render: (item) => (
            <Text style={styles.cellText} numberOfLines={1}>
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
              <Text style={styles.muted}>—</Text>
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
