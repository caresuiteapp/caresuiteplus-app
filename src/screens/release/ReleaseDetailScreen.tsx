import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ReleaseDetailHero } from '@/components/release';
import { ScreenShell } from '@/components/layout';
import { ErrorState, InfoBanner, LoadingState, PremiumBadge, PremiumCard, SuccessState } from '@/components/ui';
import { useReleaseDetail } from '@/hooks/useReleaseHub';
import { useAuth } from '@/lib/auth/context';
import { toggleReleaseChecklist } from '@/lib/release';
import { isReleaseLiveReady, RELEASE_PREPARED_MESSAGE } from '@/lib/release/releaseModuleConfig';
import { RELEASE_DEMO_TENANT } from '@/data/demo/domains/releaseDemo';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

/** WP525 — Release Detailansicht */
export function ReleaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh } = useReleaseDetail(id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleToggle = useCallback(
    async (itemId: string) => {
      if (!id) return;
      setBusy(true);
      const result = await toggleReleaseChecklist(RELEASE_DEMO_TENANT, id, itemId, profile?.roleKey);
      setBusy(false);
      if (result.ok) {
        setMessage('Checkliste aktualisiert.');
        refresh();
        setTimeout(() => setMessage(null), 2000);
      }
    },
    [id, profile?.roleKey, refresh],
  );

  if (loading && !data) {
    return (
      <ScreenShell title="Release" showBack>
        <LoadingState message="Release wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !data) {
    return (
      <ScreenShell title="Release" showBack>
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const detail = data!;

  return (
    <ScreenShell title={detail.title} subtitle={WORKFLOW_STATUS_LABELS[detail.status]} showBack>
      {message ? <SuccessState message={message} /> : null}
      <ScrollView contentContainerStyle={styles.scroll}>
        <ReleaseDetailHero detail={detail} roleKey={roleKey} />
        {!isReleaseLiveReady() ? (
          <InfoBanner title="Live-Deployment in Vorbereitung" message={RELEASE_PREPARED_MESSAGE} />
        ) : null}
        <PremiumCard accentColor={colors.cyan}>
          <Text style={styles.section}>Deployment-Checkliste</Text>
          {detail.checklist.map((item) => (
            <Pressable key={item.id} style={styles.checkRow} onPress={() => handleToggle(item.id)} disabled={busy}>
              <PremiumBadge label={item.done ? '✓' : '○'} variant={item.done ? 'green' : 'orange'} />
              <View style={styles.checkText}>
                <Text style={styles.checkLabel}>{item.label}</Text>
                <Text style={styles.meta}>{item.assignee}</Text>
              </View>
            </Pressable>
          ))}
        </PremiumCard>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  section: { ...typography.bodyStrong, marginBottom: spacing.md },
  checkRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm },
  checkText: { flex: 1 },
  checkLabel: { ...typography.body },
  meta: { ...typography.caption, color: colors.textMuted },
});
