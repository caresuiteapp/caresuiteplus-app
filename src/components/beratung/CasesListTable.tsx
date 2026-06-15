import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { CounselingListItem } from '@/types/modules/beratung';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type CasesListTableProps = {
  cases: CounselingListItem[];
  selectedId?: string | null;
  onCasePress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: CounselingListItem['status']) {
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function CasesListTable({
  cases,
  selectedId = null,
  onCasePress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: CasesListTableProps) {
  return (
    <PremiumDataTable
      data={cases}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={onCasePress ? (item) => onCasePress(item.id) : undefined}
      columns={[
        {
          key: 'subject',
          label: 'Betreff',
          flex: 2,
          sortable: true,
          render: (item) => <Text style={styles.name}>{item.subject}</Text>,
        },
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.5,
          sortable: true,
          render: (item) => <Text style={styles.meta}>{item.clientName}</Text>,
        },
        {
          key: 'counselor',
          label: 'Berater:in',
          flex: 1.5,
          render: (item) => <Text style={styles.meta}>{item.counselorName}</Text>,
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
          key: 'opened',
          label: 'Eröffnet',
          flex: 1,
          sortable: true,
          render: (item) => <Text style={styles.meta}>{formatDate(item.openedAt)}</Text>,
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
                onPress={() => onOpenDetail(item.id)}
              />
            ) : null,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  name: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textMuted },
});
