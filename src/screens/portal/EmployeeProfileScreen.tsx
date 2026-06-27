import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { PortalEmployeeProfileHero } from '@/components/portal';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useEmployeePortalProfile } from '@/hooks/useEmployeePortalProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

export function EmployeeProfileScreen() {
  const { can, check, roleLabel } = usePermissions();
  const canViewProfile = can('portal.employee.profile.view');
  const canViewTimesheet = can('portal.employee.timesheet.view');

  const { profile, timesheet, loading, error, refresh } = useEmployeePortalProfile();

  if (!canViewProfile) {
    return (
      <ScreenShell title="Profil" subtitle={resolvePortalScreenSubtitle(roleLabel, 'employee')} showBack={false}>
        <LockedActionBanner
          message={check('portal.employee.profile.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && !profile) {
    return (
      <ScreenShell title="Profil" subtitle="Wird geladen…" showBack={false}>
        <LoadingState message="Profil wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !profile) {
    return (
      <ScreenShell title="Profil" subtitle="Fehler" showBack={false}>
        <ErrorState title="Profil nicht verfügbar" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  if (!profile) return null;

  return (
    <ScreenShell title="Profil" subtitle={profile.displayName} showBack={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.scroll}
      >
        <PortalEmployeeProfileHero profile={profile} />

        <PremiumCard accentColor={colors.cyan}>
          {profile.jobTitle ? (
            <DetailInfoRow label="Funktion" value={resolveEmployeeRoleLabel(profile.jobTitle)} />
          ) : null}
          <DetailInfoRow label="Team" value={profile.teamName} />
          {profile.email ? <DetailInfoRow label="E-Mail" value={profile.email} /> : null}
          {profile.phone ? <DetailInfoRow label="Telefon" value={profile.phone} /> : null}
        </PremiumCard>

        {canViewTimesheet ? (
          <SectionPanel title="Zeiterfassung (letzte Einsätze)">
            {timesheet.length === 0 ? (
              <EmptyState
                title="Keine Einträge"
                message="Für diese Woche sind noch keine Zeiten erfasst."
              />
            ) : (
              timesheet.map((entry) => (
                <PremiumCard key={entry.id} style={styles.timesheetCard}>
                  <Text style={styles.entryTitle}>{entry.assignmentTitle}</Text>
                  <Text style={styles.entryMeta}>
                    {entry.date} · {entry.startTime}–{entry.endTime} ({entry.durationMinutes} Min.)
                  </Text>
                  <Text style={styles.entryMeta}>Klient:in: {entry.clientName}</Text>
                  <PremiumBadge
                    label={WORKFLOW_STATUS_LABELS[entry.status]}
                    variant="muted"
                  />
                </PremiumCard>
              ))
            )}
          </SectionPanel>
        ) : (
          <LockedActionBanner
            message={check('portal.employee.timesheet.view').reason ?? 'Keine Berechtigung.'}
            roleLabel={roleLabel}
          />
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  timesheetCard: {
    marginBottom: spacing.sm,
  },
  entryTitle: {
    ...typography.bodyStrong,
    marginBottom: spacing.xs,
  },
  entryMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
});
