import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { formatCurrency } from '@/lib/office';
import type { InvoiceListItem } from '@/types/modules/billing';
import { INVOICE_STATUS_LABELS } from '@/lib/office/invoiceStatus';
import { colors, spacing, typography } from '@/theme';

type InvoiceListCardProps = {
  invoice: InvoiceListItem;
  onPress?: () => void;
  selected?: boolean;
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
    case 'paid':
      return 'green' as const;
    case 'overdue':
    case 'cancelled':
      return 'red' as const;
    case 'ready':
    case 'sent':
    case 'partly_paid':
    case 'draft':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function InvoiceListCard({ invoice, onPress, selected = false }: InvoiceListCardProps) {
  const inner = (
    <View style={styles.row}>
      <View style={styles.main}>
        <Text style={styles.number}>{invoice.invoiceNumber}</Text>
        <Text style={styles.client}>{invoice.clientName}</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amount}>
            {formatCurrency(invoice.amountCents, invoice.currency)}
          </Text>
          <Text style={styles.due}>Fällig: {formatDate(invoice.dueDate)}</Text>
        </View>
      </View>
      <PremiumBadge
          label={INVOICE_STATUS_LABELS[invoice.status]}
        variant={statusVariant(invoice.status)}
        dot
      />
    </View>
  );

  if (!onPress) {
    return (
      <PremiumCard accentColor={colors.orange} style={styles.card}>
        {inner}
      </PremiumCard>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        accentColor={colors.orange}
        style={[styles.card, selected ? styles.cardSelected : null]}
        onPress={onPress}
      >
        {inner}
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  cardSelected: {
    borderColor: colors.orange,
    borderWidth: 2,
    backgroundColor: 'rgba(255,149,0,0.08)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  number: {
    ...typography.bodyStrong,
  },
  client: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  amount: {
    ...typography.h3,
    color: colors.orange,
  },
  due: {
    ...typography.caption,
  },
});
