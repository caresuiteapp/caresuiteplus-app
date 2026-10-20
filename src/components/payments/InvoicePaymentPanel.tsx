import { StyleSheet, Text, View } from 'react-native';
import type { InvoicePaymentSnapshot } from '@/types/payments';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/types/payments';
import { LockedActionBanner } from '@/components/permissions';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { formatCurrency } from '@/lib/office';
import { colors, spacing, typography } from '@/theme';

type InvoicePaymentPanelProps = {
  snapshot: InvoicePaymentSnapshot;
  loading?: boolean;
  blockedMessage?: string | null;
  onPrepareLink?: () => void;
  onReconcile?: () => void;
  readOnly?: boolean;
};

export function InvoicePaymentPanel({
  snapshot,
  loading,
  blockedMessage,
  onPrepareLink,
  onReconcile,
  readOnly,
}: InvoicePaymentPanelProps) {
  const effectiveStatus = snapshot.providerConfirmedPaid
    ? snapshot.status
    : snapshot.status === 'paid'
      ? 'processing'
      : snapshot.status;

  return (
    <SectionPanel title="Online-Zahlung" subtitle="Vorbereitung — keine echten Zahlungen">
      <DetailRow label="Status" value={PAYMENT_STATUS_LABELS[effectiveStatus]} />
      {snapshot.methodType ? (
        <DetailRow label="Zahlungsart" value={PAYMENT_METHOD_LABELS[snapshot.methodType]} />
      ) : null}
      {snapshot.providerKey && snapshot.providerKey !== 'none' ? (
        <DetailRow label="Anbieter" value={snapshot.providerKey.toUpperCase()} />
      ) : null}
      <DetailRow label="Betrag" value={formatCurrency(snapshot.amountCents)} />
      <DetailRow
        label="Abgleich"
        value={
          snapshot.reconciliationStatus === 'none'
            ? 'Kein Abgleich'
            : snapshot.reconciliationStatus === 'pending'
              ? 'Abgleich ausstehend'
              : snapshot.reconciliationStatus === 'matched'
                ? 'Abgeglichen'
                : 'Teilweise'
        }
      />
      {snapshot.mandateStatus ? (
        <DetailRow label="SEPA-Mandat" value={snapshot.mandateStatus} />
      ) : null}
      {snapshot.dunningEligible ? (
        <Text style={styles.dunning}>
          Mahnwesen: Rechnung ist für Mahnstufe vorgemerkt (offener Posten).
        </Text>
      ) : null}
      {blockedMessage || snapshot.paymentLinkBlockedReason ? (
        <LockedActionBanner
          message={blockedMessage ?? snapshot.paymentLinkBlockedReason ?? 'Zahlung blockiert.'}
        />
      ) : null}
      {!readOnly ? (
        <View style={styles.actions}>
          <PremiumButton
            title={snapshot.paymentLinkPrepared ? 'Link vorbereitet' : 'Zahlungslink vorbereiten'}
            variant="secondary"
            loading={loading}
            disabled={!!snapshot.paymentLinkBlockedReason || snapshot.paymentLinkPrepared}
            onPress={onPrepareLink}
          />
          <PremiumButton
            title="Zahlungseingang abgleichen"
            variant="secondary"
            loading={loading}
            disabled={!snapshot.paymentLinkPrepared}
            onPress={onReconcile}
          />
        </View>
      ) : null}
    </SectionPanel>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  label: { ...typography.caption, color: colors.textMuted },
  value: { ...typography.bodyStrong },
  dunning: { ...typography.caption, color: colors.warning, marginTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
