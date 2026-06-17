import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumDataTable } from '@/components/ui';
import { buildOfficeDocumentSubtitle, formatOfficeDocumentSizeDisplay } from '@/lib/office/officeDocumentDisplay';
import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type DocumentsListTableProps = {
  documents: PortalDocumentListItem[];
  selectedId?: string | null;
  onDocumentPress?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

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
  selectedId = null,
  onDocumentPress,
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
      onRowPress={onDocumentPress ? (item) => onDocumentPress(item.id) : undefined}
      selectedId={selectedId}
      columns={[
        {
          key: 'title',
          label: 'Titel',
          flex: 2,
          sortable: true,
          render: (item) => <Text style={styles.name}>{item.title}</Text>,
        },
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.5,
          render: (item) => (
            <Text style={styles.meta} numberOfLines={1}>
              {item.clientName ?? '—'}
            </Text>
          ),
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
          key: 'size',
          label: 'Größe',
          flex: 0.9,
          render: (item) => {
            const sizeLabel = formatOfficeDocumentSizeDisplay(item.sizeLabel, item.fileSizeBytes);
            return <Text style={styles.meta}>{sizeLabel ?? '—'}</Text>;
          },
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
          flex: 1.2,
          sortable: true,
          render: (item) => (
            <Text style={styles.meta} numberOfLines={1}>
              {buildOfficeDocumentSubtitle(item)}
            </Text>
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  name: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textMuted },
});
