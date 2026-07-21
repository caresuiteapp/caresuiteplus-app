import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
  Timeline,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  ACCOUNTING_EXPORT_STATUS_LABELS,
  ACCOUNTING_PROVIDER_LABELS,
  INVOICE_ACCOUNTING_STATUS_LABELS,
  type AccountingProviderKey,
} from '@/types/accounting';
import {
  ACCOUNTING_EXPORT_PROVIDER_KEYS,
  createSteuerberaterPackage,
  executeInvoiceAccountingExport,
  fetchInvoiceAccountingSnapshot,
  GOBD_NOTICE_TEXT,
  prepareInvoiceAccountingExport,
} from '@/lib/accounting';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';

type InvoiceAccountingPanelProps = {
  invoiceId: string;
  invoiceNumber: string;
};

export function InvoiceAccountingPanel({ invoiceId, invoiceNumber }: InvoiceAccountingPanelProps) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, roleLabel } = usePermissions();
  const canManage = can('integrations.manage');
  const [selectedProvider, setSelectedProvider] = useState<AccountingProviderKey>('datev');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInvoiceAccountingSnapshot(invoiceId, tenantId, profile?.roleKey);
    },
    [tenantId, invoiceId, profile?.roleKey],
    { enabled: !!tenantId && !!invoiceId },
  );

  const snapshot = query.data;

  const providerOptions = useMemo(
    () => ACCOUNTING_EXPORT_PROVIDER_KEYS.filter((key) => key !== 'gobd_archiv'),
    [],
  );

  const runAction = useCallback(
    async (action: () => Promise<{ ok: boolean; error?: string }>) => {
      setLoading(true);
      setActionMessage(null);
      setActionError(null);
      const result = await action();
      setLoading(false);
      if (result.ok) {
        setActionMessage('Aktion ausgeführt — kein externer Transfer ohne Anbieter-Konfiguration.');
        await query.refresh();
      } else {
        setActionError(result.error ?? 'Aktion fehlgeschlagen.');
        await query.refresh();
      }
    },
    [query],
  );

  const handlePrepare = useCallback(async () => {
    if (!tenantId) return;
    await runAction(async () =>
      prepareInvoiceAccountingExport(
        invoiceId,
        invoiceNumber,
        tenantId,
        selectedProvider,
        profile?.roleKey,
        profile?.id,
      ),
    );
  }, [tenantId, invoiceId, invoiceNumber, selectedProvider, profile?.roleKey, profile?.id, runAction]);

  const handleExecute = useCallback(async () => {
    if (!tenantId) return;
    await runAction(async () =>
      executeInvoiceAccountingExport(
        invoiceId,
        invoiceNumber,
        tenantId,
        selectedProvider,
        profile?.roleKey,
        profile?.id,
      ),
    );
  }, [tenantId, invoiceId, invoiceNumber, selectedProvider, profile?.roleKey, profile?.id, runAction]);

  const handleSteuerberaterPackage = useCallback(async () => {
    if (!tenantId) return;
    await runAction(async () =>
      createSteuerberaterPackage(
        invoiceId,
        invoiceNumber,
        tenantId,
        ['csv', 'xml', 'pdf'],
        profile?.roleKey,
      ),
    );
  }, [tenantId, invoiceId, invoiceNumber, profile?.roleKey, runAction]);

  if (query.loading) {
    return (
      <SectionPanel title="Buchhaltung" subtitle="Wird geladen…">
        <Text style={styles.muted}>Buchhaltungsstatus wird geladen…</Text>
      </SectionPanel>
    );
  }

  if (!snapshot) {
    return (
      <SectionPanel title="Buchhaltung">
        <EmptyState title="Keine Daten" message={query.error ?? 'Buchhaltungsdaten nicht verfügbar.'} />
      </SectionPanel>
    );
  }

  const statusLabel = INVOICE_ACCOUNTING_STATUS_LABELS[snapshot.status.accountingStatus];

  return (
    <>
      <SectionPanel title="Buchhaltung" subtitle="Connect in Vorbereitung">
        <View style={styles.badgeRow}>
          <PremiumBadge label={statusLabel} variant="orange" dot />
          {snapshot.status.providerKey ? (
            <PremiumBadge
              label={ACCOUNTING_PROVIDER_LABELS[snapshot.status.providerKey]}
              variant="muted"
            />
          ) : null}
          {snapshot.isGobdArchived ? (
            <PremiumBadge label="GoBD geschützt" variant="red" dot />
          ) : (
            <PremiumBadge label="In Vorbereitung" variant="muted" />
          )}
        </View>

        <Text style={styles.notice}>{GOBD_NOTICE_TEXT}</Text>

        {actionMessage ? <Text style={styles.success}>{actionMessage}</Text> : null}
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

        {!canManage ? (
          <LockedActionBanner
            message="Export-Aktionen erfordern integrations.manage."
            roleLabel={roleLabel}
          />
        ) : !snapshot.canDirectEdit ? (
          <LockedActionBanner
            message="GoBD-archiviert — keine direkten Export-Änderungen."
            roleLabel={roleLabel}
          />
        ) : (
          <>
            <Text style={styles.sectionLabel}>Anbieter</Text>
            <View style={styles.providerRow}>
              {providerOptions.map((key) => (
                <PremiumButton
                  key={key}
                  title={ACCOUNTING_PROVIDER_LABELS[key]}
                  size="sm"
                  variant={selectedProvider === key ? 'primary' : 'secondary'}
                  onPress={() => setSelectedProvider(key)}
                />
              ))}
            </View>

            <View style={styles.actionRow}>
              <PremiumButton
                title="Export vorbereiten"
                variant="secondary"
                size="sm"
                loading={loading}
                onPress={handlePrepare}
              />
              <PremiumButton
                title="Export ausführen"
                variant="secondary"
                size="sm"
                loading={loading}
                onPress={handleExecute}
              />
              <PremiumButton
                title="Steuerberater-Paket"
                variant="secondary"
                size="sm"
                loading={loading}
                onPress={handleSteuerberaterPackage}
              />
            </View>
          </>
        )}
      </SectionPanel>

      {snapshot.exportHistory.length > 0 ? (
        <SectionPanel title="Export-Verlauf" subtitle={`${snapshot.exportHistory.length} Läufe`}>
          <Timeline
            items={snapshot.exportHistory.map((entry) => ({
              id: entry.id,
              icon: entry.externalTransfer ? '✅' : '📋',
              title: `${ACCOUNTING_PROVIDER_LABELS[entry.providerKey]} — ${ACCOUNTING_EXPORT_STATUS_LABELS[entry.status]}`,
              subtitle: entry.packageLabel ?? entry.errorSummary ?? 'Kein externer Transfer',
              timestamp: entry.createdAt,
              status: entry.status === 'failed' ? ('fehlerhaft' as const) : ('aktiv' as const),
              type: 'invoice' as const,
            }))}
          />
        </SectionPanel>
      ) : null}

      {snapshot.exportErrors.length > 0 ? (
        <SectionPanel title="Fehlerprotokoll">
          {snapshot.exportErrors.map((entry) => (
            <View key={entry.id} style={styles.errorRow}>
              <Text style={styles.errorTitle}>
                {ACCOUNTING_PROVIDER_LABELS[entry.providerKey]} — {entry.errorSummary}
              </Text>
              <Text style={styles.muted}>{entry.createdAt}</Text>
            </View>
          ))}
        </SectionPanel>
      ) : null}

      {snapshot.gobdAuditEvents.length > 0 ? (
        <SectionPanel title="GoBD Audit" subtitle="Änderungshistorie">
          <Timeline
            items={snapshot.gobdAuditEvents.map((event) => ({
              id: event.id,
              icon: '🔒',
              title: event.summary,
              subtitle: event.eventType,
              timestamp: event.createdAt,
              status: 'aktiv' as const,
              type: 'invoice' as const,
            }))}
          />
        </SectionPanel>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  notice: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  sectionLabel: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  providerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  success: { ...typography.caption, color: colors.orange, marginBottom: spacing.sm },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
  muted: { ...typography.caption, color: colors.textMuted },
  errorRow: { paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  errorTitle: { ...typography.bodyStrong, color: colors.error },
});
