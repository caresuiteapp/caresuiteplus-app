import { StyleSheet, Text } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { CertificateListItem } from '@/types/modules/akademie';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { typography } from '@/theme';

type CertificatesListTableProps = {
  items: CertificateListItem[];
  selectedId?: string | null;
  onItemPress?: (id: string) => void;
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

export function CertificatesListTable({
  items,
  selectedId = null,
  onItemPress,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: CertificatesListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'participant',
          label: 'Teilnehmer:in',
          flex: 1.6,
          sortable: true,
          render: (item) => <Text style={tableText.name}>{item.participantName}</Text>,
        },
        {
          key: 'course',
          label: 'Kurs',
          flex: 2,
          sortable: true,
          render: (item) => (
            <Text style={tableText.cellText} numberOfLines={1}>
              {item.courseTitle}
            </Text>
          ),
        },
        {
          key: 'issued',
          label: 'Ausgestellt',
          flex: 1.2,
          sortable: true,
          render: (item) => <Text style={tableText.cellText}>{formatDate(item.issuedAt)}</Text>,
        },
        {
          key: 'expires',
          label: 'Gültig bis',
          flex: 1.2,
          render: (item) => (
            <Text style={tableText.cellText}>
              {item.expiresAt ? formatDate(item.expiresAt) : 'unbegrenzt'}
            </Text>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.2,
          render: (item) => (
            <PremiumBadge label={WORKFLOW_STATUS_LABELS[item.status]} variant="green" dot />
          ),
        },
        {
          key: 'actions',
          label: 'Aktionen',
          width: 100,
          align: 'right',
          render: (item) => (
            <PremiumButton
              title="Details"
              size="sm"
              variant="ghost"
              onPress={() => onItemPress?.(item.id)}
            />
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
});
