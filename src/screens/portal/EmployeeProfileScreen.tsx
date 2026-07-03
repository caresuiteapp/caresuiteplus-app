import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LockedActionBanner } from '@/components/permissions';
import {
  OFFICE_PROFILE_HINT,
  PortalEmployeeProfileTabContent,
  PORTAL_EMPLOYEE_PROFILE_TABS,
  PortalEmployeeProfileHero,
} from '@/components/portal';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  SegmentedTabs,
} from '@/components/ui';
import { HealthOSAlert } from '@/components/healthos';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useEmployeePortalPersonnelView } from '@/hooks/useEmployeePortalPersonnelView';
import { useEmployeePortalProfile } from '@/hooks/useEmployeePortalProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { isTechnicalPortalErrorMessage } from '@/lib/portal/portalErrorSanitizer';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import type { PortalEmployeeProfileTabKey } from '@/types/portal/employeePersonnel';
import { useLegacyTheme } from '@/design/tokens/themeBridge';

export function EmployeeProfileScreen() {
  const { isPhone, isTablet, isDesktop, width } = useDeviceClass();
  const { can, check, roleLabel } = usePermissions();
  const canViewProfile = can('portal.employee.profile.view');
  const text = useAuroraAdaptiveText();
  const { colors } = useLegacyTheme();
  const type = resolveGalaxyTypography(width);
  const insets = useSafeAreaInsets();
  const { showBottomTabs } = usePlatformLayout();
  const [activeTab, setActiveTab] = useState<PortalEmployeeProfileTabKey>('overview');

  const { profile, loading: profileLoading, error: profileError, refresh: refreshProfile, missingEmployeeLink } =
    useEmployeePortalProfile();
  const {
    personnelView,
    loading: personnelLoading,
    error: personnelError,
    refresh: refreshPersonnel,
  } = useEmployeePortalPersonnelView();

  const loading = profileLoading || personnelLoading;
  const error = profileError ?? personnelError;
  const isWide = isTablet || isDesktop;

  const contentPadding = useMemo(
    () => ({
      paddingHorizontal: careSpacing.md,
      paddingBottom: showBottomTabs
        ? PORTAL_MOBILE_NAV_HEIGHT + Math.max(insets.bottom, careSpacing.sm)
        : careSpacing.xl + insets.bottom,
      gap: careSpacing.md,
    }),
    [insets.bottom, showBottomTabs],
  );

  const handleRefresh = useCallback(() => {
    void Promise.all([refreshProfile(), refreshPersonnel()]);
  }, [refreshProfile, refreshPersonnel]);

  const tabLayout = isPhone ? 'scroll' : 'wrap';

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

  if (loading && !profile && !personnelView) {
    return (
      <PortalTabScreen title="Profil" subtitle="Wird geladen…" hideHeaderOnPhone scroll={false}>
        <LoadingState message="Profil wird geladen…" />
      </PortalTabScreen>
    );
  }

  if (missingEmployeeLink) {
    return (
      <PortalTabScreen title="Profil" hideHeaderOnPhone scroll={false}>
        <EmptyState
          title="Profil nicht verfügbar"
          message="Ihr Portalzugang ist noch keinem Mitarbeiterprofil zugeordnet. Bitte wenden Sie sich an das Office."
        />
      </PortalTabScreen>
    );
  }

  if (error && !profile && !personnelView) {
    const friendlyMessage = isTechnicalPortalErrorMessage(error)
      ? 'Keine Profildaten hinterlegt. Bitte wenden Sie sich an das Office.'
      : error;

    return (
      <PortalTabScreen title="Profil" subtitle="Fehler" hideHeaderOnPhone scroll={false}>
        <ErrorState title="Profil nicht verfügbar" message={friendlyMessage} onRetry={handleRefresh} />
      </PortalTabScreen>
    );
  }

  if (!profile || !personnelView) {
    return (
      <PortalTabScreen title="Profil" hideHeaderOnPhone scroll={false}>
        <EmptyState
          title="Keine Profildaten"
          message="Keine Profildaten hinterlegt. Bitte wenden Sie sich an das Office."
        />
      </PortalTabScreen>
    );
  }

  const contactLine = [profile.email, profile.mobile ?? profile.phone].filter(Boolean).join(' · ');

  return (
    <PortalTabScreen title="Profil" subtitle={profile.displayName} hideHeaderOnPhone scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={[styles.scroll, contentPadding]}
      >
        <PortalEmployeeProfileHero profile={profile} />

        <GlassCard>
          <View style={styles.headerMeta}>
            {profile.jobTitleLabel && profile.jobTitleLabel !== '—' ? (
              <Text style={[type.body, { color: text.primary }]}>{profile.jobTitleLabel}</Text>
            ) : null}
            <View style={styles.statusRow}>
              <PremiumBadge
                label={WORKFLOW_STATUS_LABELS[profile.status]}
                variant={profile.status === 'aktiv' ? 'green' : 'orange'}
                dot
              />
            </View>
            {contactLine ? (
              <Text style={[type.caption, { color: text.secondary }]}>{contactLine}</Text>
            ) : null}
          </View>
          <HealthOSAlert variant="info" title="Stammdaten" message={OFFICE_PROFILE_HINT} />
        </GlassCard>

        <SegmentedTabs
          tabs={PORTAL_EMPLOYEE_PROFILE_TABS}
          activeKey={activeTab}
          onSelect={(key) => setActiveTab(key as PortalEmployeeProfileTabKey)}
          layout={tabLayout}
          rows={isWide ? 2 : undefined}
        />

        <PortalEmployeeProfileTabContent tab={activeTab} view={personnelView} />
      </ScrollView>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  headerMeta: {
    gap: careSpacing.xs,
    marginBottom: careSpacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
