import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AccountingBankReconciliationPanel,
  AccountingErrorLogPanel,
  AccountingExportHistoryPanel,
  AccountingPaymentImportPanel,
} from '@/components/accounting/connect';
import { ConnectPreparedBanner } from '@/components/connect';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, PremiumButton } from '@/components/ui';
import { useConnectAccountingPrepare } from '@/hooks/useConnectAccountingPrepare';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ACCOUNTING_PROVIDER_LABELS,
  type AccountingProviderKey,
} from '@/types/accounting';
import { ACCOUNTING_EXPORT_PROVIDER_KEYS } from '@/lib/accounting';
import { spacing, typography, colors } from '@/theme';

export function ConnectAccountingPrepareScreen() {
  const { can, check, roleLabel } = usePermissions();
  const {
    dashboard,
    selectedProvider,
    setSelectedProvider,
    loading,
    error,
    message,
    runInvoiceExport,
    runBelegpaket,
    runTaxAdvisorPackage,
    runPaymentImport,
    runBankReconciliation,
  } = useConnectAccountingPrepare();

  if (!can('connect.view')) {
    return (
      <ScreenShell title="Buchhaltung vorbereiten" subtitle={roleLabel ?? 'Connect'}>
        <LockedActionBanner
          message={check('connect.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  const canConfigure = can('connect.configure');

  return (
    <ScreenShell
      title="Buchhaltung vorbereiten"
      subtitle="DATEV · Lexware · sevDesk · Steuerberater · Bankabgleich"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <ConnectPreparedBanner />
        <InfoBanner
          title="Keine produktive API-Übertragung"
          message="Exports, Belegpakete und Zahlungsabgleich sind vorbereitet — externer Transfer nur nach Anbieter-Konfiguration und Freigabe."
        />

        <Section title="Anbieter">
          <View style={styles.providerRow}>
            {ACCOUNTING_EXPORT_PROVIDER_KEYS.filter((key: AccountingProviderKey) => key !== 'gobd_archiv').map((key) => (
              <PremiumButton
                key={key}
                title={ACCOUNTING_PROVIDER_LABELS[key]}
                variant={selectedProvider === key ? 'primary' : 'secondary'}
                onPress={() => setSelectedProvider(key as AccountingProviderKey)}
                disabled={!canConfigure}
              />
            ))}
          </View>
        </Section>

        <Section title="Rechnungsexport">
          <AccountingExportHistoryPanel batches={dashboard?.exportBatches ?? []} />
          <PremiumButton
            title="Rechnungsexport vorbereiten"
            onPress={() => void runInvoiceExport()}
            loading={loading}
            disabled={!canConfigure}
          />
          <PremiumButton
            title="Belegpaket vorbereiten"
            variant="secondary"
            onPress={() => void runBelegpaket()}
            loading={loading}
            disabled={!canConfigure}
          />
        </Section>

        <Section title="Steuerberater-Paket">
          <PremiumButton
            title="Steuerberater-ZIP vorbereiten"
            variant="secondary"
            onPress={() => void runTaxAdvisorPackage()}
            loading={loading}
            disabled={!canConfigure}
          />
        </Section>

        <Section title="Zahlungsimport & Bankabgleich">
          <AccountingPaymentImportPanel imports={dashboard?.bankImports ?? []} />
          <AccountingBankReconciliationPanel suggestions={dashboard?.paymentSuggestions ?? []} />
          <PremiumButton
            title="Zahlungsimport CSV vorbereiten"
            variant="secondary"
            onPress={() => void runPaymentImport()}
            loading={loading}
            disabled={!canConfigure}
          />
          <PremiumButton
            title="Bankabgleich testen (Beleg-Block)"
            variant="secondary"
            onPress={() => void runBankReconciliation()}
            loading={loading}
            disabled={!canConfigure}
          />
        </Section>

        <Section title="Fehlerprotokoll">
          <AccountingErrorLogPanel
            exportErrors={dashboard?.exportErrors ?? []}
            auditEvents={dashboard?.auditEvents ?? []}
          />
        </Section>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </ScreenShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.lg, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  providerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  message: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.error },
});
