import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { InvoiceDetailHero } from '@/components/office';
import { InvoiceAccountingPanel } from '@/components/office/accounting/InvoiceAccountingPanel';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
  SuccessState,
  Timeline,
} from '@/components/ui';
import { useCallback, useEffect, useState } from 'react';
import { InvoicePaymentPanel } from '@/components/payments';
import {
  fetchInvoicePaymentSnapshot,
  prepareInvoicePaymentLink,
  reconcileInvoicePayment,
} from '@/lib/payments';
import type { InvoicePaymentSnapshot } from '@/types/payments';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchInvoiceDetail, updateInvoiceStatus } from '@/lib/office/invoiceDetailService';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { formatCurrency } from '@/lib/office';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel, isReadOnly } = usePermissions();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const tenantId = useServiceTenantId();
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSnapshot, setPaymentSnapshot] = useState<InvoicePaymentSnapshot | undefined>(
    undefined,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const canView = can('office.invoices.view');
  const canChangeStatus = can('office.invoices.status_change');
  const canEdit = can('office.invoices.view') && !isReadOnly;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!id) return Promise.resolve({ ok: false as const, error: 'Keine Rechnungs-ID.' });
      return fetchInvoiceDetail(id, tenantId, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  const invoice = query.data;
  const loading = query.loading;
  const error = query.error;
  const notFound = !query.loading && !query.error && !query.data;
  const refresh = query.refresh;

  const loadPaymentSnapshot = useCallback(async () => {
    if (!tenantId || !id) return;
    const result = await fetchInvoicePaymentSnapshot(tenantId, id, profile?.roleKey);
    if (result.ok) setPaymentSnapshot(result.data);
  }, [tenantId, id, profile?.roleKey]);

  useEffect(() => {
    void loadPaymentSnapshot();
  }, [loadPaymentSnapshot]);

  const handlePreparePaymentLink = useCallback(async () => {
    if (!tenantId || !id) return;
    setPaymentLoading(true);
    const result = await prepareInvoicePaymentLink(
      tenantId,
      id,
      'one_time',
      profile?.roleKey,
    );
    setPaymentLoading(false);
    if (result.ok) {
      setPaymentSnapshot(result.data);
      setSuccessMessage('Zahlungslink vorbereitet (Demo — keine echte Zahlung).');
    }
  }, [tenantId, id, profile?.roleKey]);

  const handleReconcilePayment = useCallback(async () => {
    if (!tenantId || !id) return;
    setPaymentLoading(true);
    const result = await reconcileInvoicePayment(tenantId, id, profile?.roleKey);
    setPaymentLoading(false);
    if (result.ok) {
      setPaymentSnapshot(result.data);
      setSuccessMessage('Abgleich vorbereitet — Status bleibt bis Provider-Bestätigung offen.');
    }
  }, [tenantId, id, profile?.roleKey]);

  const changeStatus = useCallback(
    async (newStatus: Parameters<typeof updateInvoiceStatus>[2]) => {
      if (!tenantId || !id) return;
      setActionLoading(true);
      const result = await updateInvoiceStatus(
        id,
        tenantId,
        newStatus,
        profile?.roleKey,
        profile?.displayName ?? 'Büro Demo',
      );
      setActionLoading(false);
      if (result.ok) {
        setSuccessMessage('Rechnungsstatus erfolgreich aktualisiert.');
        await refresh();
      }
    },
    [tenantId, id, profile?.roleKey, profile?.displayName, refresh],
  );

  if (!canView) {
    return (
      <CareLightPageShell title="Rechnung" subtitle="Kein Zugriff">
        <ErrorState
          title="Zugriff verweigert"
          message={`Rechnungen sind für ${roleLabel ?? 'Ihre Rolle'} nicht freigegeben.`}
        />
      </CareLightPageShell>
    );
  }

  if (loading) {
    return (
      <CareLightPageShell title="Rechnung" subtitle="Wird geladen…">
        <LoadingState message="Rechnungsdetails werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (notFound || error) {
    return (
      <CareLightPageShell title="Rechnung" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Die Rechnung existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  if (!invoice) return null;

  return (
    <CareLightPageShell
      title={invoice.invoiceNumber}
      subtitle="Rechnungsdetails"
      rightSlot={
        canEdit ? (
          <PremiumButton
            title="Bearbeiten"
            size="sm"
            variant="ghost"
            onPress={() => router.push(`/business/office/invoices/${id}/edit` as never)}
          />
        ) : undefined
      }
    >
      {successMessage ? <SuccessState message={successMessage} /> : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <InvoiceDetailHero invoice={invoice} roleKey={roleKey} isReadOnly={isReadOnly} />

        <SectionPanel title="Zuordnung">
          <DetailInfoRow label="Klient:in" value={invoice.clientName} />
          <DetailInfoRow label="Fällig am" value={formatDate(invoice.dueDate)} />
          <DetailInfoRow
            label="Rechnungsdatum"
            value={invoice.issuedDate ? formatDate(invoice.issuedDate) : null}
          />
          {invoice.notes ? <DetailInfoRow label="Hinweise" value={invoice.notes} /> : null}
        </SectionPanel>

        {invoice.lineItems.length > 0 ? (
          <SectionPanel title="Positionen" subtitle={`${invoice.lineItems.length} Posten`}>
            {invoice.lineItems.map((line) => (
              <View key={line.id} style={styles.lineRow}>
                <View style={styles.lineMain}>
                  <Text style={styles.lineDesc}>{line.description}</Text>
                  <Text style={styles.lineMeta}>
                    {line.quantity} × {formatCurrency(line.unitPriceCents, invoice.currency)}
                  </Text>
                </View>
                <Text style={styles.lineTotal}>
                  {formatCurrency(line.totalCents, invoice.currency)}
                </Text>
              </View>
            ))}
          </SectionPanel>
        ) : (
          <SectionPanel title="Positionen">
            <EmptyState title="Keine Positionen" message="Für diese Demo-Rechnung sind keine Posten hinterlegt." />
          </SectionPanel>
        )}

        {paymentSnapshot ? (
          <InvoicePaymentPanel
            snapshot={paymentSnapshot}
            loading={paymentLoading}
            readOnly={isReadOnly}
            onPrepareLink={handlePreparePaymentLink}
            onReconcile={handleReconcilePayment}
          />
        ) : null}

        <InvoiceAccountingPanel invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} />

        {invoice.auditEntries.length > 0 ? (
          <SectionPanel title="Audit-Verlauf">
            <Timeline
              items={invoice.auditEntries.map((entry) => ({
                id: entry.id,
                icon: '📋',
                title: entry.action,
                subtitle: entry.details ? `${entry.actorName} — ${entry.details}` : entry.actorName,
                timestamp: entry.timestamp,
                status: 'aktiv' as const,
                type: 'invoice' as const,
              }))}
            />
          </SectionPanel>
        ) : null}

        <SectionPanel title="Status ändern">
          {!canChangeStatus ? (
            <LockedActionBanner
              message={
                check('office.invoices.status_change').reason ??
                'Statusänderungen sind für Ihre Rolle gesperrt.'
              }
              roleLabel={roleLabel}
            />
          ) : invoice.allowedStatusActions.length === 0 ? (
            <EmptyState title="Keine Aktionen" message="Für diesen Status sind keine Wechsel möglich." />
          ) : (
            <View style={styles.actionGrid}>
              {invoice.allowedStatusActions.map((status) => (
                <PremiumButton
                  key={status}
                  title={WORKFLOW_STATUS_LABELS[status]}
                  variant="secondary"
                  size="sm"
                  loading={actionLoading}
                  onPress={() => changeStatus(status)}
                />
              ))}
            </View>
          )}
        </SectionPanel>

        <PremiumButton
          title="Zur Klient:in"
          variant="secondary"
          fullWidth
          onPress={() => router.push(clientRecordRoute(invoice.clientId) as never)}
        />
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  lineMain: { flex: 1 },
  lineDesc: { ...typography.bodyStrong },
  lineMeta: { ...typography.caption },
  lineTotal: { ...typography.bodyStrong, color: colors.orange },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
