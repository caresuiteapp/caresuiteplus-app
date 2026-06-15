import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { RoadmapHubHero } from '@/components/roadmap';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumCard,
} from '@/components/ui';
import { useRoadmapHub } from '@/hooks/useRoadmapHub';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { wp598A11y } from '@/lib/a11y/wp598-roadmap';
import { isRoadmapLiveReady, ROADMAP_PREPARED_MESSAGE } from '@/lib/roadmap/roadmapModuleConfig';
import { ROADMAP_PHASE_LABELS } from '@/types/roadmap';
import { colors, spacing, typography } from '@/theme';

/** WP583 — Roadmap Hub */
export function RoadmapHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh } = useRoadmapHub();

  if (!can('roadmap.view')) {
    return (
      <ScreenShell title="Roadmap" subtitle={roleLabel ?? 'Strategie'} showBack={false} a11yMeta={wp598A11y}>
        <LockedActionBanner message={check('roadmap.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && !data) {
    return (
      <ScreenShell title="Roadmap" showBack={false} a11yMeta={wp598A11y}>
        <LoadingState message="Lädt…" />
      </ScreenShell>
    );
  }

  if (error && !data) {
    return (
      <ScreenShell title="Roadmap" showBack={false} a11yMeta={wp598A11y}>
        <ErrorState title="Roadmap" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Strategische Roadmap"
      subtitle={`Launch-Readiness ${data!.launchReadinessPercent}%`}
      showBack={false}
      a11yMeta={wp598A11y}
      rightSlot={
        <PremiumButton
          title="Meilensteine"
          size="sm"
          variant="ghost"
          onPress={() => router.push('/business/roadmap/list' as never)}
        />
      }
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        <RoadmapHubHero data={data!} roleKey={roleKey} />

        {!isRoadmapLiveReady() ? (
          <InfoBanner title="Live-Sync in Vorbereitung" message={ROADMAP_PREPARED_MESSAGE} />
        ) : null}

        {data!.phases.map((p) => (
          <PremiumCard key={p.phase} accentColor={colors.violet}>
            <Text style={styles.title}>{ROADMAP_PHASE_LABELS[p.phase]}</Text>
            <Text style={styles.meta}>{p.count} Meilenstein(e)</Text>
          </PremiumCard>
        ))}
        <PremiumButton
          title="Meilenstein anlegen"
          onPress={() => router.push('/business/roadmap/create' as never)}
          disabled={!can('roadmap.manage')}
        />
        <PremiumButton
          title="Live-Pilot Readiness"
          variant="secondary"
          onPress={() => router.push('/business/roadmap/pilot-readiness' as never)}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary },
});
