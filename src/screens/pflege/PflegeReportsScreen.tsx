import { StyleSheet, Text, View } from 'react-native';
import { PflegeReportsHero } from '@/components/pflege/PflegeReportsHero';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
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
    <ScreenShell title="Pflege-Auswertungen" subtitle={`Live-Qualitätskennzahlen · ${roleLabel ?? 'Pflege'}`}>
      <PflegeReportsHero stats={stats} roleKey={roleKey} />
      <View style={styles.noteWrap}>
        <Text style={styles.note}>
          Kennzahlen werden mandantenbezogen aus Pflegeplänen, SIS, Vitalwerten, Wundfällen,
          Evaluationen und abgeschlossenen Pflegevisiten berechnet.
        </Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  noteWrap: { marginTop: spacing.md },
  note: { ...typography.caption, color: colors.textMuted },
});
