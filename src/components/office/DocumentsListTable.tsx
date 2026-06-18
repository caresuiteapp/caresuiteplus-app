import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumDataTable } from '@/components/ui';
import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type DocumentsListTableProps = {
  documents: PortalDocumentListItem[];
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusVariant(status: PortalDocumentListItem['status']) {
  switch (status) {
    case 'aktiv':
    case 'abgeschlossen':
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

export function DocumentsListTable({
  documents,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: DocumentsListTableProps) {
  return (
    <PremiumDataTable
      data={documents}
      keyExtractor={(item) => item.id}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
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
            <PremiumBadge
              label={PORTAL_DOCUMENT_CATEGORY_LABELS[item.category]}
              variant="muted"
            />
          ),
        },
        {
          key: 'fileName',
          label: 'Datei',
          flex: 1.5,
          render: (item) => (
            <Text style={styles.meta} numberOfLines={1}>
              {item.fileName}
            </Text>
          ),
        },
        {
          key: 'size',
          label: 'Größe',
          flex: 0.9,
          render: (item) => <Text style={styles.meta}>{formatFileSize(item.fileSizeBytes)}</Text>,
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
      ]}
    />
  );
}

const styles = StyleSheet.create({
  name: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textMuted },
});
