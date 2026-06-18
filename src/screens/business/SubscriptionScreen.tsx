import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PremiumPreparedNotice } from '@/components/billing/PremiumPreparedNotice';
import { SubscriptionHero } from '@/components/business/SubscriptionHero';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumKpiCard,
  SectionPanel,
} from '@/components/ui';
import { useSubscription } from '@/hooks/useSubscription';
import { usePermissions } from '@/hooks/usePermissions';
import {
  FREE_PLATFORM_FEATURE_KEYS,
  FREE_PLATFORM_PRODUCT_KEYS,
  formatFreePlatformPrice,
  getFreePlatformModules,
} from '@/lib/billing/freePlatformService';
import { PRODUCT_LABELS } from '@/data/demo/products';
import { colors, spacing, typography } from '@/theme';

const STATUS_LABELS: Record<string, string> = {
  free_active: 'Kostenlos aktiv',
  active: 'Aktiv',
  trialing: 'Testphase (Legacy)',
  past_due: 'Überfällig',
  canceled: 'Gekündigt',
  inactive: 'Inaktiv',
};

export function SubscriptionScreen() {
  const router = useRouter();
  const { can, check, roleLabel, roleKey } = usePermissions();
  const { data, loading, error, refresh } = useSubscription();

  if (!can('business.subscription.view')) {
    return (
      <ScreenShell title="Free Platform" subtitle={roleLabel ?? 'Business'} showBack={false}>
        <LockedActionBanner
          message={check('business.subscription.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && !data) {
    return (
      <ScreenShell title="Free Platform" subtitle="Wird geladen…" showBack={false}>
        <LoadingState message="Plattform-Übersicht wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !data) {
    return (
      <ScreenShell title="Free Platform" subtitle="Fehler" showBack={false}>
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  if (!data) return null;

  return (
    <ScreenShell title="CareSuite+ Free Platform" subtitle={data.tenantName} showBack={false}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.scroll}
      >
        <SubscriptionHero
          tenantName={data.tenantName}
          planLabel={data.planLabel}
          moduleCount={data.moduleCount}
          roleKey={roleKey ?? 'business_admin'}
        />

        <PremiumCard accentColor={colors.cyan}>
          <View style={styles.headerRow}>
            <Text style={styles.plan}>{formatFreePlatformPrice()}</Text>
            <PremiumBadge label={STATUS_LABELS[data.status] ?? data.status} variant="green" />
          </View>
          <DetailInfoRow label="Mandant" value={data.tenantName} />
          <DetailInfoRow label="CareSuite+ Office" value="Immer enthalten — kostenlos aktiv" />
          <DetailInfoRow label="Kreditkarte" value="Nicht erforderlich" />
          <DetailInfoRow label="Testphase" value="Keine — dauerhaft kostenlos" />
        </PremiumCard>

        <View style={styles.kpiRow}>
          <PremiumKpiCard
            label="Aktive Module"
            value={data.moduleCount}
            subValue={`${data.includedModuleCount} inklusive`}
          />
          <PremiumKpiCard
            label="Monatlich"
            value="0 €"
            subValue="Alle Hauptmodule"
            accentColor={colors.orange}
          />
        </View>

        <SectionPanel
          title="Hauptmodule — kostenlos"
          subtitle="Alle Module ohne Checkout freischaltbar"
        >
          <View style={styles.moduleList}>
            {FREE_PLATFORM_PRODUCT_KEYS.map((key) => (
              <View key={key} style={styles.moduleRow}>
                <Text style={styles.moduleLabel}>{PRODUCT_LABELS[key]}</Text>
                <PremiumBadge label="Kostenlos" variant="green" />
              </View>
            ))}
          </View>
        </SectionPanel>

        <SectionPanel title="Plattform-Funktionen — kostenlos" subtitle="In Free Platform enthalten">
          <View style={styles.moduleList}>
            {FREE_PLATFORM_FEATURE_KEYS.map((key) => (
              <View key={key} style={styles.moduleRow}>
                <Text style={styles.moduleLabel}>{key}</Text>
                <PremiumBadge label="Inklusive" variant="cyan" />
              </View>
            ))}
          </View>
        </SectionPanel>

        <PremiumPreparedNotice />

        <Text style={styles.footerNote}>
          CareSuite+ Free Platform: {getFreePlatformModules().length} Module und Funktionen — Premium-Connectors nur vorbereitet.
        </Text>

        <PremiumButton
          title="Module verwalten"
          variant="secondary"
          onPress={() => router.push('/business/modules' as never)}
        />

        {can('integrations.view') ? (
          <PremiumButton
            title="Integrationen ansehen"
            variant="secondary"
            onPress={() => router.push('/business/integrations' as never)}
          />
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  plan: { ...typography.h3, flex: 1 },
  kpiRow: { flexDirection: 'row', gap: spacing.sm },
  moduleList: { gap: spacing.xs },
  moduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  moduleLabel: { ...typography.body, flex: 1 },
  footerNote: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
