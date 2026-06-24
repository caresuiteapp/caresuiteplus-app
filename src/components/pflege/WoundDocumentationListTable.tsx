import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { WoundDocumentation } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { typography } from '@/theme';

type WoundDocumentationListTableProps = {
  items: WoundDocumentation[];
  selectedId?: string | null;
  onItemPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
};

function statusVariant(status: WoundDocumentation['status']) {
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

export function WoundDocumentationListTable({
  items,
  selectedId = null,
  onItemPress,
  onOpenDetail,
}: WoundDocumentationListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'location',
          label: 'Lokalisation',
          flex: 1.3,
          render: (item) => <Text style={tableText.title}>{item.bodyLocation}</Text>,
        },
        {
          key: 'description',
          label: 'Beschreibung',
          flex: 1.6,
          render: (item) => (
            <Text style={tableText.cellText} numberOfLines={2}>
              {item.description}
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
          key: 'documented',
          label: 'Dokumentiert',
          flex: 1.1,
          render: (item) => (
            <Text style={styles.time}>
              {new Date(item.documentedAt).toLocaleDateString('de-DE')}
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
  time: { ...typography.caption },
});
