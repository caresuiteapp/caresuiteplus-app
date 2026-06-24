import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { MessageListItem } from '@/types/portal/communication';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type OfficeMessagesListTableProps = {
  messages: MessageListItem[];
  selectedId?: string | null;
  onMessagePress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusVariant(status: MessageListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function OfficeMessagesListTable({
  messages,
  selectedId = null,
  onMessagePress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: OfficeMessagesListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={messages}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={onMessagePress ? (item) => onMessagePress(item.id) : undefined}
      columns={[
        {
          key: 'subject',
          label: 'Betreff',
          flex: 1.6,
          sortable: true,
          render: (item) => (
            <Text style={[styles.subject, !item.readAt && styles.unreadSubject]} numberOfLines={1}>
              {item.subject}
            </Text>
          ),
        },
        {
          key: 'senderName',
          label: 'Von',
          flex: 1.1,
          render: (item) => (
            <Text style={styles.meta} numberOfLines={1}>
              {item.senderName}
            </Text>
          ),
        },
        {
          key: 'recipientName',
          label: 'An',
          flex: 1.1,
          render: (item) => (
            <Text style={styles.meta} numberOfLines={1}>
              {item.recipientName}
            </Text>
          ),
        },
        {
          key: 'updatedAt',
          label: 'Aktualisiert',
          flex: 1.2,
          sortable: true,
          render: (item) => <Text style={styles.meta}>{formatDateTime(item.updatedAt)}</Text>,
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
          key: 'read',
          label: 'Gelesen',
          flex: 0.7,
          render: (item) =>
            item.readAt ? (
              <PremiumBadge label="Ja" variant="muted" />
            ) : (
              <PremiumBadge label="Neu" variant="orange" />
            ),
        },
        {
          key: 'actions',
          label: '',
          flex: 0.8,
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

const styles = StyleSheet.create({
  subject: { ...typography.bodyStrong },
  unreadSubject: { color: colors.orange },
  meta: { ...typography.caption, color: colors.textMuted },
});
