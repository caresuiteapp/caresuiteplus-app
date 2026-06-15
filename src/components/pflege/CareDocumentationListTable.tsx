import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { CareDocumentationListItem } from '@/lib/pflege/careDocumentationTypes';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type CareDocumentationListTableProps = {
  items: CareDocumentationListItem[];
  selectedId?: string | null;
  onItemPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
};

function statusVariant(status: CareDocumentationListItem['status']) {
  switch (status) {
    case 'abgeschlossen':
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

export function CareDocumentationListTable({
  items,
  selectedId = null,
  onItemPress,
  onOpenDetail,
}: CareDocumentationListTableProps) {
  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'title',
          label: 'Titel',
          flex: 1.4,
          render: (item) => <Text style={styles.title}>{item.title}</Text>,
        },
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.2,
          render: (item) => <Text style={styles.name}>{item.clientName}</Text>,
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
          key: 'recorded',
          label: 'Erfasst',
          flex: 1.1,
          render: (item) => (
            <Text style={styles.time}>
              {new Date(item.recordedAt).toLocaleDateString('de-DE')}
            </Text>
          ),
        },
        {
          key: 'flags',
          label: 'Hinweis',
          flex: 0.9,
          render: (item) => (
            <Text style={styles.flags}>
              {item.hasSignature ? '✓ Signiert' : item.pdfReady ? 'PDF' : '—'}
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
  title: { ...typography.bodyStrong },
  name: { ...typography.body },
  time: { ...typography.caption, color: colors.cyan },
  flags: { ...typography.caption, color: colors.textMuted },
});
