import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { PortalClientProfileHero } from '@/components/portal';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { useClientPortalProfile } from '@/hooks/useClientPortalProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ClientPortalProfileScreen() {
  const { can, check, roleLabel } = usePermissions();
  const canViewProfile = can('portal.client.profile.view');
  const canViewCarePlan = can('portal.client.careplan.view');

  const { profile, carePlans, loading, error, refresh } = useClientPortalProfile();

  if (!canViewProfile) {
    return (
      <CareLightPageShell title="Profil" subtitle={roleLabel ?? 'Portal'} showBack={false}>
        <LockedActionBanner
          message={check('portal.client.profile.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </CareLightPageShell>
    );
  }

  if (loading && !profile) {
    return (
      <CareLightPageShell title="Profil" subtitle="Wird geladen…" showBack={false}>
        <LoadingState message="Profil wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && !profile) {
    return (
      <CareLightPageShell title="Profil" subtitle="Fehler" showBack={false}>
        <ErrorState title="Profil nicht verfügbar" message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  if (!profile) return null;

  return (
    <CareLightPageShell title="Profil" subtitle={profile.displayName} showBack={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.scroll}
      >
        <PortalClientProfileHero profile={profile} />

        <PremiumCard accentColor={colors.primary}>
          {profile.careLevel ? (
            <DetailInfoRow label="Pflegegrad" value={formatCareLevel(profile.careLevel)} />
          ) : null}
          {profile.city ? (
            <DetailInfoRow
              label="Wohnort"
              value={`${profile.zip ?? ''} ${profile.city}`.trim()}
            />
          ) : null}
          {profile.primaryContactPhone ? (
            <DetailInfoRow label="Telefon" value={profile.primaryContactPhone} />
          ) : null}
          {profile.emergencyContact ? (
            <DetailInfoRow label="Notfallkontakt" value={profile.emergencyContact} />
          ) : null}
        </PremiumCard>

        {canViewCarePlan ? (
          <SectionPanel title="Pflegepläne">
            {carePlans.length === 0 ? (
              <EmptyState
                title="Keine Pflegepläne"
                message="Aktuell sind keine Pflegepläne für Sie freigegeben."
              />
            ) : (
              carePlans.map((plan) => (
                <PremiumCard key={plan.id} style={styles.planCard}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.planMeta}>
                    {plan.validUntil
                      ? `Gültig bis ${formatDate(plan.validUntil)} · `
                      : ''}
                    {plan.taskCount} Maßnahmen
                  </Text>
                  <Text style={styles.planSummary}>{plan.summary}</Text>
                  <PremiumBadge
                    label={WORKFLOW_STATUS_LABELS[plan.status]}
                    variant="green"
                  />
                </PremiumCard>
              ))
            )}
          </SectionPanel>
        ) : (
          <LockedActionBanner
            message={check('portal.client.careplan.view').reason ?? 'Keine Berechtigung.'}
            roleLabel={roleLabel}
          />
        )}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  planCard: {
    marginBottom: spacing.sm,
  },
  planTitle: {
    ...typography.bodyStrong,
    marginBottom: spacing.xs,
  },
  planMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  planSummary: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
});
