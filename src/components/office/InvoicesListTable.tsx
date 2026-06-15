import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import { formatCurrency } from '@/lib/office';
import type { InvoiceListItem } from '@/types/modules/billing';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type InvoicesListTableProps = {
  invoices: InvoiceListItem[];
  selectedId?: string | null;
  onInvoicePress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
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

function statusVariant(status: InvoiceListItem['status']) {
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

export function InvoicesListTable({
  invoices,
  selectedId = null,
  onInvoicePress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: InvoicesListTableProps) {
  return (
    <PremiumDataTable
      data={invoices}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={onInvoicePress ? (item) => onInvoicePress(item.id) : undefined}
      columns={[
        {
          key: 'invoiceNumber',
          label: 'Nummer',
          flex: 1.2,
          sortable: true,
          render: (item) => <Text style={styles.name}>{item.invoiceNumber}</Text>,
        },
        {
          key: 'clientName',
          label: 'Klient:in',
          flex: 1.5,
          render: (item) => (
            <Text style={styles.meta} numberOfLines={1}>
              {item.clientName}
            </Text>
          ),
        },
        {
          key: 'amount',
          label: 'Betrag',
          flex: 1,
          render: (item) => (
            <Text style={styles.amount}>{formatCurrency(item.amountCents, item.currency)}</Text>
          ),
        },
        {
          key: 'dueDate',
          label: 'Fällig',
          flex: 1,
          sortable: true,
          render: (item) => <Text style={styles.meta}>{formatDate(item.dueDate)}</Text>,
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
  name: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textMuted },
  amount: { ...typography.bodyStrong, color: colors.orange },
});
