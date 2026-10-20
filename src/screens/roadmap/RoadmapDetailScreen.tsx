import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { RoadmapDetailHero } from '@/components/roadmap';
import { ScreenShell } from '@/components/layout';
import { ErrorState, InfoBanner, LoadingState, PremiumCard } from '@/components/ui';
import { useRoadmapDetail } from '@/hooks/useRoadmapHub';
import { useAuth } from '@/lib/auth/context';
import { isRoadmapLiveReady, ROADMAP_PREPARED_MESSAGE } from '@/lib/roadmap/roadmapModuleConfig';
import { ROADMAP_PHASE_LABELS } from '@/types/roadmap';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

/** WP585 — Roadmap Detail */
export function RoadmapDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh } = useRoadmapDetail(id);

  if (loading && !data) return <ScreenShell title="Meilenstein" showBack><LoadingState message="Lädt…" /></ScreenShell>;
  if (error && !data) return <ScreenShell title="Meilenstein" showBack><ErrorState title="Fehler" message={error} onRetry={refresh} /></ScreenShell>;

  const d = data!;
  return (
    <ScreenShell title={d.title} subtitle={WORKFLOW_STATUS_LABELS[d.status]} showBack>
      <ScrollView contentContainerStyle={styles.scroll}>
        <RoadmapDetailHero detail={d} roleKey={roleKey} />
        {!isRoadmapLiveReady() ? (
          <InfoBanner title="Live-Sync in Vorbereitung" message={ROADMAP_PREPARED_MESSAGE} />
        ) : null}
        <PremiumCard accentColor={colors.violet}>
          <Text style={styles.meta}>{ROADMAP_PHASE_LABELS[d.phase]} · {d.quarter}</Text>
          <Text style={styles.meta}>Owner: {d.owner} · Markt: {d.market}</Text>
          <Text style={styles.label}>Erfolgskriterien</Text>
          {d.successCriteria.map((c) => <Text key={c} style={styles.body}>• {c}</Text>)}
        </PremiumCard>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  label: { ...typography.bodyStrong, marginTop: spacing.sm, marginBottom: spacing.xs },
  body: { ...typography.body, color: colors.textSecondary },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
});
