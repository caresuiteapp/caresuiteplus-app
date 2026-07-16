import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { generatePlatformInvoicePreview } from '@/lib/platformConsole';
import { formatPlatformCents } from '@/lib/platformConsole/platformFormat';
import { LoadingState } from '@/components/ui';
import { PlatformAuditLink } from './PlatformAuditLink';
import { PLATFORM_COLORS } from './PlatformColors';
import { spacing } from '@/theme';

type PlatformBillingPreviewPanelProps = {
  tenantId: string;
  canWrite?: boolean;
  compact?: boolean;
};

export function PlatformBillingPreviewPanel({ tenantId, canWrite = true, compact = false }: PlatformBillingPreviewPanelProps) {
  const [periodStart, setPeriodStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function runPreview() {
    if (!canWrite) return;
    if (reason.trim().length < 5) {
      setError('Grund mit mindestens 5 Zeichen erforderlich.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await generatePlatformInvoicePreview(
      tenantId,
      `${periodStart}T00:00:00.000Z`,
      `${periodEnd}T23:59:59.999Z`,
      reason.trim(),
      true,
    );
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setPreview(null);
      return;
    }
    setPreview(res.data);
  }

  return (
    <View style={[styles.panel, compact && styles.compact]}>
      <Text style={styles.title}>Billing Preview</Text>
      <Text style={styles.disclaimer}>
        Preview — keine finale Rechnung. Keine Zahlung erzeugt. Keine Rechnung finalisiert.
      </Text>
      {!canWrite ? <Text style={styles.hint}>Lesemodus — billing.write erforderlich.</Text> : null}
      {canWrite ? (
        <>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Zeitraum von</Text>
              <TextInput
                style={styles.input}
                value={periodStart}
                onChangeText={setPeriodStart}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={PLATFORM_COLORS.muted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Zeitraum bis</Text>
              <TextInput
                style={styles.input}
                value={periodEnd}
                onChangeText={setPeriodEnd}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={PLATFORM_COLORS.muted}
              />
            </View>
          </View>
          <Text style={styles.label}>Grund (Pflicht)</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Grund für Preview…"
            placeholderTextColor={PLATFORM_COLORS.muted}
          />
          <Pressable style={styles.btn} onPress={() => void runPreview()} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Berechne…' : 'Preview generieren'}</Text>
          </Pressable>
        </>
      ) : null}
      {loading ? <LoadingState message="Preview wird berechnet…" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {preview ? (
        <View style={styles.breakdown}>
          <BreakdownRow label="Plan" value={preview.subtotal_cents ?? preview.subtotalCents} />
          <BreakdownRow label="Add-ons" value={preview.addon_cents ?? preview.addonCents ?? 0} />
          <BreakdownRow label="Rabatte" value={preview.discount_cents ?? preview.discountCents ?? 0} negative />
          <BreakdownRow label="Credits" value={preview.credit_cents ?? preview.creditCents ?? 0} negative />
          <BreakdownRow
            label="Total"
            value={preview.total_cents ?? preview.totalCents ?? 0}
            highlight
          />
          <PlatformAuditLink tenantId={tenantId} action="billing.preview" label="Preview im Audit" />
        </View>
      ) : null}
    </View>
  );
}

function BreakdownRow({
  label,
  value,
  negative,
  highlight,
}: {
  label: string;
  value: unknown;
  negative?: boolean;
  highlight?: boolean;
}) {
  const cents = Number(value ?? 0);
  const formatted = formatPlatformCents(Math.abs(cents));
  const sign = negative && cents !== 0 ? '−' : '';
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, highlight && styles.highlight]}>{label}</Text>
      <Text style={[styles.breakdownValue, highlight && styles.highlight]}>
        {sign}
        {formatted}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
  },
  compact: { marginTop: 0 },
  title: { color: PLATFORM_COLORS.text, fontWeight: '700', fontSize: 15 },
  disclaimer: { color: PLATFORM_COLORS.muted, fontSize: 11, lineHeight: 16 },
  hint: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  row: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1, gap: 4 },
  label: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    color: PLATFORM_COLORS.text,
    backgroundColor: PLATFORM_COLORS.bg,
  },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  btnText: { color: PLATFORM_COLORS.accent, fontWeight: '600', fontSize: 13 },
  error: { color: PLATFORM_COLORS.danger, fontSize: 12 },
  breakdown: { gap: 6, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: PLATFORM_COLORS.border },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { color: PLATFORM_COLORS.muted, fontSize: 13 },
  breakdownValue: { color: PLATFORM_COLORS.text, fontWeight: '600', fontSize: 13 },
  highlight: { color: PLATFORM_COLORS.accent, fontWeight: '700' },
});
