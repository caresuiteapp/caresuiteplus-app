import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SecurityHubHero } from '@/components/security';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumCard,
} from '@/components/ui';
import { useSecurityHub } from '@/hooks/useSecurityHub';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { wp558A11y } from '@/lib/a11y/wp558-security';
import { isSecurityLiveReady, SECURITY_PREPARED_MESSAGE } from '@/lib/security/securityModuleConfig';
import { colors, spacing, typography } from '@/theme';

/** WP543 — Security Hub Dashboard */
export function SecurityHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh } = useSecurityHub();

  if (!can('security.view')) {
    return (
      <ScreenShell title="Security" subtitle={roleLabel ?? 'Betrieb'} showBack={false} a11yMeta={wp558A11y}>
        <LockedActionBanner message={check('security.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && !data) {
    return (
      <ScreenShell title="Security" showBack={false} a11yMeta={wp558A11y}>
        <LoadingState message="Lädt…" />
      </ScreenShell>
    );
  }

  if (error && !data) {
    return (
      <ScreenShell title="Security" showBack={false} a11yMeta={wp558A11y}>
        <ErrorState title="Security" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Security & DSGVO"
      subtitle={`DSGVO ${data!.dsgvoScorePercent}%`}
      showBack={false}
      a11yMeta={wp558A11y}
      rightSlot={
        <View style={styles.headerActions}>
          <PremiumButton
            title="DSGVO-Anfragen"
            size="sm"
            variant="ghost"
            onPress={() => router.push('/business/security/data-requests' as never)}
          />
          <PremiumButton
            title="Findings"
            size="sm"
            variant="ghost"
            onPress={() => router.push('/business/security/list' as never)}
          />
        </View>
      }
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        <SecurityHubHero data={data!} roleKey={roleKey} />

        {!isSecurityLiveReady() ? (
          <InfoBanner title="Live-Monitoring in Vorbereitung" message={SECURITY_PREPARED_MESSAGE} />
        ) : null}

        <Text style={styles.section}>Performance</Text>
        {data!.performanceKpis.map((kpi) => (
          <PremiumCard key={kpi.id} accentColor={colors.cyan}>
            <Text style={styles.title}>
              {kpi.label}: {kpi.value}
            </Text>
            <Text style={styles.meta}>{kpi.subValue}</Text>
          </PremiumCard>
        ))}

        <PremiumButton
          title="Finding anlegen"
          onPress={() => router.push('/business/security/create' as never)}
          disabled={!can('security.manage')}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  section: { ...typography.bodyStrong, marginTop: spacing.sm },
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
});
