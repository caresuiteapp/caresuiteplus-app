import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useInvoiceDetail } from '@/hooks/useInvoiceDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/lib/office';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

export type InvoiceDetailSummaryPanelProps = {
  invoiceId: string;
  onOpenFullRecord?: () => void;
};

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function statusVariant(status: string) {
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

export function InvoiceDetailSummaryPanel({ invoiceId }: InvoiceDetailSummaryPanelProps) {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const { data: invoice, loading, error, refresh, notFound } = useInvoiceDetail(invoiceId);

  if (loading) {
    return <LoadingState message="Rechnung wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Datensatz existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!invoice) return null;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.orange}>
        <Text style={styles.number}>{invoice.invoiceNumber}</Text>
        <View style={styles.badgeRow}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[invoice.status]}
            variant={statusVariant(invoice.status)}
            dot
          />
        </View>
        <Text style={styles.amount}>
          {formatCurrency(invoice.amountCents, invoice.currency)}
        </Text>
        <Text style={styles.client}>{invoice.clientName}</Text>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Rechnungen einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Abrechnung" subtitle="Fälligkeit & Status">
        <SummaryRow label="Fällig am" value={formatDate(invoice.dueDate)} />
        <SummaryRow label="Ausgestellt" value={invoice.issuedDate ? formatDate(invoice.issuedDate) : null} />
        {invoice.nextActionHint ? (
          <SummaryRow label="Nächster Schritt" value={invoice.nextActionHint} />
        ) : null}
      </SectionPanel>

      {invoice.notes ? (
        <PremiumCard accentColor={colors.amber}>
          <Text style={styles.hintLabel}>Hinweis</Text>
          <Text style={styles.hint}>{invoice.notes}</Text>
        </PremiumCard>
      ) : null}

      {invoice.lineItems.length === 0 ? (
        <EmptyState
          title="Keine Positionen"
          message="Positionsdetails sind in der Vollansicht verfügbar."
        />
      ) : null}

      <View style={styles.actions}>
        <PremiumButton
          title="Vollständige Rechnung öffnen"
          variant="primary"
          fullWidth
          onPress={() => router.push(`/office/invoices/${invoice.id}` as never)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  number: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  amount: {
    ...typography.h3,
    color: colors.orange,
    marginBottom: spacing.xs,
  },
  client: {
    ...typography.caption,
    color: colors.textMuted,
  },
  row: {
    marginBottom: spacing.sm,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  rowValue: {
    ...typography.body,
  },
  hintLabel: {
    ...typography.label,
    color: colors.orange,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.body,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
});
