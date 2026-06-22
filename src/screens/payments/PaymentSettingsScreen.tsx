import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  PaymentSettingsHero,
  PaymentTestModeNotice,
} from '@/components/payments';
import {
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumCard,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchPaymentSettings,
  savePaymentSettings,
  type PaymentSettingsForm,
} from '@/lib/payments';
import type { PaymentEnvironment, PaymentProviderKey } from '@/types/payments';
import { PAYMENT_PROVIDER_LABELS } from '@/types/payments';
import { colors, spacing, typography } from '@/theme';

const PROVIDER_OPTIONS: { key: PaymentProviderKey; label: string }[] = [
  { key: 'none', label: 'Keiner' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'mollie', label: 'Mollie' },
  { key: 'gocardless', label: 'GoCardless' },
  { key: 'paypal', label: 'PayPal' },
];

export function PaymentSettingsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<PaymentSettingsForm>({
    providerKey: 'none',
    environment: 'sandbox',
    sepaEnabled: false,
    subscriptionBillingEnabled: false,
  });

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchPaymentSettings(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const snapshot = query.data;
  const active = snapshot?.activeConfig;

  useEffect(() => {
    if (!active) return;
    setForm({
      providerKey: active.providerKey,
      environment: active.environment,
      sepaEnabled: active.sepaEnabled,
      subscriptionBillingEnabled: active.subscriptionBillingEnabled,
    });
  }, [active?.id, active?.providerKey, active?.environment, active?.sepaEnabled, active?.subscriptionBillingEnabled]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaveError(null);
    setSaved(false);
    const result = await savePaymentSettings(tenantId, form, profile?.roleKey);
    if (result.ok) {
      setSaved(true);
      await query.refresh();
    } else {
      setSaveError(result.error);
    }
  };

  if (!can('connect.configure')) {
    return (
      <ScreenShell title="Zahlungen">
        <LockedActionBanner
          message={check('connect.configure').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (query.loading && !snapshot) {
    return (
      <ScreenShell title="Zahlungen">
        <LoadingState message="Zahlungseinstellungen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !snapshot) {
    return (
      <ScreenShell title="Zahlungen">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Zahlungen" subtitle="Anbieter & Webhooks">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={query.loading} onRefresh={query.refresh} tintColor={colors.cyan} />
        }
        contentContainerStyle={styles.scroll}
      >
        <PaymentSettingsHero
          providerLabel={PAYMENT_PROVIDER_LABELS[active?.providerKey ?? 'none']}
          environmentLabel={active?.environment === 'production' ? 'Produktion' : 'Sandbox'}
          webhookStatus={active?.webhookStatus ?? 'not_configured'}
        />
        <PaymentTestModeNotice message={snapshot?.testModeNotice ?? 'Testmodus aktiv.'} />
        {saved ? <SuccessState message="Einstellungen gespeichert (Demo)." /> : null}
        {saveError ? <ErrorState message={saveError} /> : null}

        <SectionPanel title="Zahlungsanbieter">
          <FilterChipGroup
            options={PROVIDER_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
            value={form.providerKey}
            onChange={(key) => setForm((f) => ({ ...f, providerKey: key as PaymentProviderKey }))}
          />
        </SectionPanel>

        <SectionPanel title="Umgebung">
          <FilterChipGroup
            options={[
              { key: 'sandbox', label: 'Sandbox' },
              { key: 'production', label: 'Produktion (blockiert)' },
            ]}
            value={form.environment}
            onChange={(key) => setForm((f) => ({ ...f, environment: key as PaymentEnvironment }))}
          />
        </SectionPanel>

        <SectionPanel title="Funktionen">
          <FilterChipGroup
            options={[
              { key: 'sepa_off', label: 'SEPA aus' },
              { key: 'sepa_on', label: 'SEPA an' },
            ]}
            value={form.sepaEnabled ? 'sepa_on' : 'sepa_off'}
            onChange={(key) => setForm((f) => ({ ...f, sepaEnabled: key === 'sepa_on' }))}
          />
          <FilterChipGroup
            options={[
              { key: 'sub_off', label: 'Abo aus' },
              { key: 'sub_on', label: 'Abo an' },
            ]}
            value={form.subscriptionBillingEnabled ? 'sub_on' : 'sub_off'}
            onChange={(key) =>
              setForm((f) => ({ ...f, subscriptionBillingEnabled: key === 'sub_on' }))
            }
          />
        </SectionPanel>

        <PremiumCard accentColor={colors.cyan}>
          <Text style={styles.cardTitle}>Webhook-Status</Text>
          <Text style={styles.cardMeta}>Status: {active?.webhookStatus ?? 'not_configured'}</Text>
          <Text style={styles.cardMeta}>
            Credential: {snapshot?.credentialMasked ?? 'Nicht konfiguriert'}
          </Text>
          {active?.webhookLastError ? (
            <Text style={styles.error}>{active.webhookLastError}</Text>
          ) : null}
        </PremiumCard>

        <PremiumButton title="Speichern" onPress={handleSave} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  cardTitle: { ...typography.bodyStrong },
  cardMeta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
});
