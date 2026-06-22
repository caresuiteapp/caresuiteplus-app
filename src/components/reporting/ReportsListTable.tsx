import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import { REPORT_CATEGORY_LABELS } from '@/lib/reporting/reportListStats';
import type { ReportListItem } from '@/types/reporting';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type ReportsListTableProps = {
  reports: ReportListItem[];
  selectedId?: string | null;
  onReportPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: ReportListItem['status']) {
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

export function ReportsListTable({
  reports,
  selectedId = null,
  onReportPress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: ReportsListTableProps) {
  return (
    <PremiumDataTable
      data={reports}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={onReportPress ? (item) => onReportPress(item.id) : undefined}
      columns={[
        {
          key: 'title',
          label: 'Titel',
          flex: 2,
          sortable: true,
          render: (item) => <Text style={styles.name}>{item.title}</Text>,
        },
        {
          key: 'category',
          label: 'Kategorie',
          flex: 1.2,
          render: (item) => (
            <Text style={styles.meta}>{REPORT_CATEGORY_LABELS[item.category]}</Text>
          ),
        },
        {
          key: 'period',
          label: 'Zeitraum',
          flex: 1.2,
          render: (item) => <Text style={styles.meta}>{item.period}</Text>,
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
          key: 'updated',
          label: 'Aktualisiert',
          flex: 1,
          sortable: true,
          render: (item) => <Text style={styles.meta}>{formatDate(item.updatedAt)}</Text>,
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
