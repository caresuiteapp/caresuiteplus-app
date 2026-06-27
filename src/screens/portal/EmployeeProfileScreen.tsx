import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { PortalEmployeeProfileHero } from '@/components/portal';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useEmployeePortalProfile } from '@/hooks/useEmployeePortalProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

function ProfileBody({
  loading,
  refresh,
  profile,
  timesheet,
  canViewTimesheet,
  timesheetDeniedMessage,
  roleLabel,
}: {
  loading: boolean;
  refresh: () => void;
  profile: NonNullable<ReturnType<typeof useEmployeePortalProfile>['profile']>;
  timesheet: NonNullable<ReturnType<typeof useEmployeePortalProfile>['timesheet']>;
  canViewTimesheet: boolean;
  timesheetDeniedMessage: string;
  roleLabel: string | null;
}) {
  return (
    <>
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
                <PremiumBadge label={WORKFLOW_STATUS_LABELS[entry.status]} variant="muted" />
              </PremiumCard>
            ))
          )}
        </SectionPanel>
      ) : (
        <LockedActionBanner message={timesheetDeniedMessage} roleLabel={roleLabel} />
      )}

      {loading ? (
        <LoadingState message="Profil wird aktualisiert…" />
      ) : (
        <View style={styles.refreshSpacer} />
      )}
    </>
  );
}

export function EmployeeProfileScreen() {
  const { isPhone } = useDeviceClass();
  const { can, check, roleLabel } = usePermissions();
  const canViewProfile = can('portal.employee.profile.view');
  const canViewTimesheet = can('portal.employee.timesheet.view');

  const { profile, timesheet, loading, error, refresh } = useEmployeePortalProfile();

  if (!canViewProfile) {
    return (
      <PortalTabScreen title="Profil" subtitle={resolvePortalScreenSubtitle(roleLabel, 'employee')} scroll={false}>
        <LockedActionBanner
          message={check('portal.employee.profile.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </PortalTabScreen>
    );
  }

  if (loading && !profile) {
    return (
      <PortalTabScreen title="Profil" subtitle="Wird geladen…" hideHeaderOnPhone scroll={false}>
        <LoadingState message="Profil wird geladen…" />
      </PortalTabScreen>
    );
  }

  if (error && !profile) {
    return (
      <PortalTabScreen title="Profil" subtitle="Fehler" hideHeaderOnPhone scroll={false}>
        <ErrorState title="Profil nicht verfügbar" message={error} onRetry={refresh} />
      </PortalTabScreen>
    );
  }

  if (!profile) return null;

  const body = (
    <ProfileBody
      loading={loading}
      refresh={refresh}
      profile={profile}
      timesheet={timesheet}
      canViewTimesheet={canViewTimesheet}
      timesheetDeniedMessage={
        check('portal.employee.timesheet.view').reason ?? 'Keine Berechtigung.'
      }
      roleLabel={roleLabel}
    />
  );

  if (isPhone) {
    return (
      <PortalTabScreen title="Profil" subtitle={profile.displayName} hideHeaderOnPhone scroll={false}>
        {body}
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title="Profil" subtitle={profile.displayName} scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.scroll}
      >
        {body}
      </ScrollView>
    </PortalTabScreen>
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
  refreshSpacer: {
    height: spacing.xs,
  },
});
