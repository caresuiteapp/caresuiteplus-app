import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  BillingExportPackagePanel,
  BillingModeSelector,
  BillingValidationChecklist,
  CostCarrierSearchPanel,
  RejectionManagementPanel,
  TenantIkProfilePanel,
} from '@/components/billing/connect';
import { ConnectPreparedBanner } from '@/components/connect';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, PremiumButton } from '@/components/ui';
import { useConnectBillingPrepare } from '@/hooks/useConnectBillingPrepare';
import { usePermissions } from '@/hooks/usePermissions';
import { spacing, typography, colors } from '@/theme';

export function ConnectBillingPrepareScreen() {
  const { can, check, roleLabel } = usePermissions();
  const {
    ikProfile,
    billingMode,
    billingModeOptions,
    costCarriers,
    carrierQuery,
    providers,
    validation,
    preparation,
    exportBatch,
    rejections,
    loading,
    error,
    selectBillingMode,
    searchCarriers,
    runPrepareBilling,
    createExport,
  } = useConnectBillingPrepare();

  if (!can('connect.view')) {
    return (
      <ScreenShell title="Abrechnung vorbereiten" subtitle={roleLabel ?? 'Connect'}>
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
      title="Abrechnung vorbereiten"
      subtitle="GKV · SGB XI/V · Pflegekassen · Kostenträger"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <ConnectPreparedBanner />
        <InfoBanner
          title="Keine produktive Abrechnung"
          message="DTA-Dateien und Direktabrechnung an Pflegekassen sind nicht freigeschaltet. Es werden nur Vorbereitung und Exportpakete erstellt."
        />

        <Section title="Abrechnungsmodus">
          <BillingModeSelector
            options={billingModeOptions}
            selected={billingMode}
            onSelect={selectBillingMode}
            disabled={!canConfigure}
          />
        </Section>

        <Section title="IK-Profil">
          <TenantIkProfilePanel profile={ikProfile} />
        </Section>

        <Section title="Kostenträger">
          <CostCarrierSearchPanel
            carriers={costCarriers}
            query={carrierQuery}
            onQueryChange={searchCarriers}
          />
        </Section>

        <Section title="Validierung">
          <BillingValidationChecklist report={validation} />
          {preparation ? (
            <Text style={styles.message}>{preparation.message}</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PremiumButton
            title="Abrechnung vorbereiten"
            onPress={() => void runPrepareBilling()}
            loading={loading}
            disabled={!canConfigure}
          />
        </Section>

        <Section title="Export">
          <BillingExportPackagePanel batch={exportBatch} providers={providers} />
          <PremiumButton
            title="Exportpaket erstellen"
            variant="secondary"
            onPress={() => void createExport()}
            loading={loading}
            disabled={!canConfigure || !validation?.passed}
          />
        </Section>

        <Section title="Rückläufer">
          <RejectionManagementPanel cases={rejections} />
        </Section>
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
  message: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.error },
});
