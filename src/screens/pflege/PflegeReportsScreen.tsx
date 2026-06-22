import { StyleSheet, Text, View } from 'react-native';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { PflegeReportsHero, PFLEGE_REPORTS_PREPARED_MESSAGE } from '@/components/pflege/PflegeReportsHero';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchPflegeReportStats } from '@/lib/pflege/moduleExtensionService';
import { colors, spacing, typography } from '@/theme';

export function PflegeReportsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchPflegeReportStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Pflege-Auswertungen" subtitle="Wird geladen…">
        <LoadingState message="Kennzahlen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Pflege-Auswertungen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const stats = query.data!;

  return (
    <ScreenShell title="Pflege-Auswertungen" subtitle={`Kennzahlen · ${roleLabel ?? 'Demo'}`}>
      <PflegeReportsHero stats={stats} roleKey={roleKey} />
      <PreparedModeBanner hint={PFLEGE_REPORTS_PREPARED_MESSAGE} />
      <View style={styles.noteWrap}>
        <Text style={styles.note}>
          Auswertungen basieren auf Demo-Daten. Export und MDK-Schnittstelle sind vorbereitet (P-READY).
        </Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  noteWrap: { marginTop: spacing.md },
  note: { ...typography.caption, color: colors.textMuted },
});
