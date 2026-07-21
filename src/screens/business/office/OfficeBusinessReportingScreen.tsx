import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchOfficeReportingSummary } from '@/lib/office/officeReportingService';
import { spacing, typography } from '@/theme';

export function OfficeBusinessReportingScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeReportingSummary(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Office Auswertungen" subtitle="Wird geladen…">
        <LoadingState message="Auswertungen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Office Auswertungen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const summary = query.data ?? [];

  return (
    <ScreenShell title="Office Auswertungen" subtitle={roleLabel ?? 'Office'}>
      <View style={styles.scroll}>
        <SectionPanel title="Kennzahlen">
          {summary.length === 0 ? (
            <EmptyState title="Keine Kennzahlen" />
          ) : (
            summary.map((item) => (
              <PremiumCard key={item.id} style={styles.card}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.value}>{item.value}</Text>
                {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
              </PremiumCard>
            ))
          )}
        </SectionPanel>
        <PremiumButton title="Insight Center öffnen" onPress={() => router.push('/business/reporting' as never)} />
        <PremiumButton title="Audit-Log" variant="secondary" onPress={() => router.push('/business/office/audit-log' as never)} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.sm },
  card: { marginBottom: spacing.sm },
  label: { ...typography.caption },
  value: { ...typography.h2, marginTop: spacing.xs },
  hint: { ...typography.body, marginTop: spacing.xs },
});
