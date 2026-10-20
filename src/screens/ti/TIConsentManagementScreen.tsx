import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { TISecurityNotice, TIConsentListHero } from '@/components/ti';
import { ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useTIConsents } from '@/hooks/ti';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { TI_CONSENT_SCOPE_LABELS, TI_CONSENT_STATUS_LABELS } from '@/types/modules/ti';
import { colors, spacing, typography } from '@/theme';

export function TIConsentManagementScreen() {
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { consents, loading, error, refresh, grantConsent, revokeConsent, actionMessage } = useTIConsents();

  if (!can('ti.view')) {
    return (
      <ScreenShell title="TI-Einwilligungen">
        <LockedActionBanner message={check('ti.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && consents.length === 0) {
    return (
      <ScreenShell title="TI-Einwilligungen">
        <LoadingState message="Einwilligungen werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && consents.length === 0) {
    return (
      <ScreenShell title="TI-Einwilligungen">
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="TI-Einwilligungen" subtitle="DSGVO-konforme Verarbeitung">
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.cyan} />}
        contentContainerStyle={styles.scroll}
      >
        <TISecurityNotice compact />
        <TIConsentListHero consents={consents} roleKey={roleKey} />
        {actionMessage ? <Text style={styles.actionMsg}>{actionMessage}</Text> : null}
        {consents.map((c) => (
          <PremiumCard key={c.id} accentColor={c.status === 'granted' ? colors.success : colors.warning}>
            <Text style={styles.scope}>{TI_CONSENT_SCOPE_LABELS[c.scope]}</Text>
            <Text style={styles.status}>{TI_CONSENT_STATUS_LABELS[c.status]} · Version {c.version}</Text>
            <Text style={styles.desc}>{c.description}</Text>
            <Text style={styles.legal}>Rechtsgrundlage: {c.legalBasis}</Text>
            {c.grantedBy ? <Text style={styles.meta}>Erteilt von: {c.grantedBy}</Text> : null}
            <View style={styles.actions}>
              {c.status === 'pending' && can('ti.consent.manage') ? (
                <PremiumButton title="Erteilen" size="sm" onPress={() => grantConsent(c.id)} />
              ) : null}
              {c.status === 'granted' && can('ti.consent.manage') ? (
                <PremiumButton title="Widerrufen" size="sm" variant="secondary" onPress={() => revokeConsent(c.id)} />
              ) : null}
            </View>
          </PremiumCard>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  scope: { ...typography.bodyStrong },
  status: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  desc: { ...typography.body, marginTop: spacing.sm },
  legal: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  meta: { ...typography.caption, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionMsg: { ...typography.body, color: colors.success },
});
