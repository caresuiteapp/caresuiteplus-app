import { ScrollView, StyleSheet } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { EmployeeMobilitySettingsForm } from '@/components/portal/EmployeeMobilitySettingsForm';
import { LoadingState } from '@/components/ui';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePermissions } from '@/hooks/usePermissions';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { spacing } from '@/theme';

export function EmployeeMobilitySettingsScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { tenantId, employeeId, isReady } = usePortalActor();
  const canViewProfile = can('portal.employee.profile.view');

  if (!canViewProfile) {
    return (
      <PortalTabScreen title="Mobilität" subtitle={resolvePortalScreenSubtitle(roleLabel, 'employee')} scroll={false}>
        <LockedActionBanner
          message={check('portal.employee.profile.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </PortalTabScreen>
    );
  }

  if (!isReady || !tenantId || !employeeId) {
    return (
      <PortalTabScreen title="Mobilität" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Mobilitätseinstellungen werden geladen…" />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title="Mobilität" subtitle="Verkehrsmittel & Routen" scroll={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <EmployeeMobilitySettingsForm tenantId={tenantId} employeeId={employeeId} />
      </ScrollView>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
});
