import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { QaHubHero } from '@/components/qa';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { ErrorState, InfoBanner, LoadingState, PremiumButton } from '@/components/ui';
import { useQaHub } from '@/hooks/useQaHub';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { wp578A11y } from '@/lib/a11y/wp578-qa';
import { isQaLiveReady, QA_PREPARED_MESSAGE } from '@/lib/qa/qaModuleConfig';
import { colors, spacing } from '@/theme';

/** WP563 — QA Hub Dashboard */
export function QaHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh } = useQaHub();

  if (!can('qa.view')) {
    return (
      <ScreenShell title="QA" subtitle={roleLabel ?? 'Betrieb'} showBack={false} a11yMeta={wp578A11y}>
        <LockedActionBanner message={check('qa.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && !data) {
    return (
      <ScreenShell title="QA" showBack={false} a11yMeta={wp578A11y}>
        <LoadingState message="Lädt…" />
      </ScreenShell>
    );
  }

  if (error && !data) {
    return (
      <ScreenShell title="QA" showBack={false} a11yMeta={wp578A11y}>
        <ErrorState title="QA" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="QA & Pilotbetrieb"
      subtitle={`Coverage ${data!.testCoveragePercent}%`}
      showBack={false}
      a11yMeta={wp578A11y}
      rightSlot={
        <PremiumButton title="Triage" size="sm" variant="ghost" onPress={() => router.push('/business/qa/list' as never)} />
      }
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        <QaHubHero data={data!} roleKey={roleKey} />

        {!isQaLiveReady() ? (
          <InfoBanner title="Live-Triage in Vorbereitung" message={QA_PREPARED_MESSAGE} />
        ) : null}

        <PremiumButton
          title="Eintrag anlegen"
          onPress={() => router.push('/business/qa/create' as never)}
          disabled={!can('qa.manage')}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({ scroll: { gap: spacing.md, paddingBottom: spacing.xxl } });
