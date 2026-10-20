import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumCard } from '@/components/ui';
import { useQaDetail } from '@/hooks/useQaHub';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

/** WP565 — QA Detailansicht */
export function QaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, refresh } = useQaDetail(id);

  if (loading && !data) return <ScreenShell title="QA" showBack><LoadingState message="Lädt…" /></ScreenShell>;
  if (error && !data) return <ScreenShell title="QA" showBack><ErrorState title="Fehler" message={error} onRetry={refresh} /></ScreenShell>;

  const d = data!;
  return (
    <ScreenShell title={d.title} subtitle={WORKFLOW_STATUS_LABELS[d.status]} showBack>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.body}>{d.summary}</Text>
        <PremiumCard accentColor={colors.orange}>
          <Text style={styles.meta}>Modul: {d.module} · Reporter: {d.reporter}</Text>
          {d.stepsToReproduce ? <Text style={styles.body}>{d.stepsToReproduce}</Text> : null}
          {d.coveragePercent != null ? <Text style={styles.meta}>Coverage: {d.coveragePercent}%</Text> : null}
        </PremiumCard>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  body: { ...typography.body, color: colors.textSecondary },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
});
