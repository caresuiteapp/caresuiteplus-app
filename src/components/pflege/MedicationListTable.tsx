import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { MedicationListItem } from '@/data/demo/medications';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { typography } from '@/theme';

type MedicationListTableProps = {
  items: MedicationListItem[];
  selectedId?: string | null;
  onItemPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
};

function statusVariant(status: MedicationListItem['status']) {
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

export function MedicationListTable({
  items,
  selectedId = null,
  onItemPress,
  onOpenDetail,
}: MedicationListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'medication',
          label: 'Medikament',
          flex: 1.3,
          render: (item) => <Text style={tableText.title}>{item.medicationName}</Text>,
        },
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.2,
          render: (item) => <Text style={tableText.name}>{item.clientName}</Text>,
        },
        {
          key: 'dosage',
          label: 'Dosierung',
          flex: 1,
          render: (item) => <Text style={tableText.cellText}>{item.dosage}</Text>,
        },
        {
          key: 'schedule',
          label: 'Einnahme',
          flex: 1.1,
          render: (item) => <Text style={tableText.cellText}>{item.schedule}</Text>,
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
                onItemPress?.(item.id);
              }}
            />
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
});
