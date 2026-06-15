import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumCard } from '@/components/ui';
import { useSecurityDetail } from '@/hooks/useSecurityHub';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

/** WP545 — Security Detailansicht */
export function SecurityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, refresh } = useSecurityDetail(id);

  if (loading && !data) return <ScreenShell title="Finding" showBack><LoadingState message="Lädt…" /></ScreenShell>;
  if (error && !data) return <ScreenShell title="Finding" showBack><ErrorState title="Fehler" message={error} onRetry={refresh} /></ScreenShell>;

  const d = data!;
  return (
    <ScreenShell title={d.title} subtitle={WORKFLOW_STATUS_LABELS[d.status]} showBack>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.body}>{d.summary}</Text>
        <PremiumCard accentColor={colors.warning}>
          <Text style={styles.label}>Maßnahme</Text>
          <Text style={styles.body}>{d.remediation}</Text>
          <Text style={styles.meta}>Verantwortlich: {d.owner} · Fällig: {d.dueDate}</Text>
          {d.performanceMs ? <Text style={styles.meta}>Messwert: {d.performanceMs} ms</Text> : null}
        </PremiumCard>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  label: { ...typography.bodyStrong, marginBottom: spacing.xs },
  body: { ...typography.body, color: colors.textSecondary },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
