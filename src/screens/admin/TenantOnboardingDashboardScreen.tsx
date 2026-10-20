import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TenantOnboardingDashboardHero } from '@/components/admin/TenantOnboardingDashboardHero';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  fetchOnboardingProgress,
  fetchStartReadinessReport,
  resumeOnboardingSession,
  runStartReadinessCheck,
  startOnboardingSession,
} from '@/lib/admin/tenantOnboardingService';
import { ONBOARDING_STEP_LABELS } from '@/types/admin/tenantOnboarding';
import { colors, spacing, typography } from '@/theme';

export function TenantOnboardingDashboardScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return Promise.resolve({ ok: true as const, data: fetchOnboardingProgress(tenantId) });
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Einrichtung / Onboarding" subtitle="Wird geladen…" scroll>
        <LoadingState message="Onboarding-Fortschritt wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Einrichtung / Onboarding" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const progress = query.data;
  if (!progress) {
    return (
      <ScreenShell title="Einrichtung / Onboarding" scroll>
        <EmptyState title="Keine Session" message="Onboarding noch nicht gestartet." />
      </ScreenShell>
    );
  }

  const readiness = tenantId ? fetchStartReadinessReport(tenantId) : null;

  return (
    <ScreenShell title="Einrichtung / Onboarding" subtitle="Mehr → Verwaltung → Onboarding" scroll>
      <TenantOnboardingDashboardHero progress={progress} />

      <SectionPanel title="Wizard-Schritte" subtitle="Speichern & fortsetzen">
        <View style={styles.stepList}>
          {progress.steps.map((step) => (
            <View key={step.id} style={styles.stepRow}>
              <Text style={styles.stepLabel}>{ONBOARDING_STEP_LABELS[step.stepKey]}</Text>
              <Text style={styles.stepStatus}>{step.status}</Text>
            </View>
          ))}
        </View>
      </SectionPanel>

      {readiness ? (
        <SectionPanel title="Startprüfung" subtitle={`Bereit: ${readiness.overallReady ? 'Ja' : 'Nein'}`}>
          <View style={styles.stepList}>
            {readiness.checks.map((check) => (
              <View key={check.checkKey} style={styles.stepRow}>
                <Text style={styles.stepLabel}>{check.label}</Text>
                <Text style={styles.stepStatus}>{check.status}</Text>
              </View>
            ))}
          </View>
        </SectionPanel>
      ) : null}

      <View style={styles.actions}>
        <PremiumButton
          title="Onboarding starten"
          onPress={() => {
            if (tenantId) startOnboardingSession(tenantId);
            query.refresh();
          }}
        />
        <PremiumButton
          title="Fortsetzen"
          variant="secondary"
          onPress={() => {
            if (tenantId) resumeOnboardingSession(tenantId);
            query.refresh();
          }}
        />
        <PremiumButton
          title="Startprüfung ausführen"
          variant="secondary"
          onPress={() => {
            if (tenantId) runStartReadinessCheck(tenantId);
            query.refresh();
          }}
        />
        <PremiumButton
          title="Datenqualität öffnen"
          variant="ghost"
          onPress={() => router.push('/business/office/admin/data-quality' as never)}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  stepList: { gap: spacing.xs },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.textMuted,
  },
  stepLabel: { ...typography.body, flex: 1 },
  stepStatus: { ...typography.caption, color: colors.textMuted },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
