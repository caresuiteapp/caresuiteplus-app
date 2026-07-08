import { LockedActionBanner } from '@/components/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { WfmOfficeTimeHistoryPanel } from '@/components/wfm/WfmOfficeTimeHistoryPanel';
import { WfmOfficeSectionHeading } from '@/components/wfm/WfmOfficeTimekeepingLayout';

export function WfmPruefqueueScreen() {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const reviewerId = user?.id ?? profile?.id ?? '';
  const { can, check, roleLabel, roleKey } = usePermissions();
  const canView = can('time.tracking.team.view');
  const canCorrect = can('time.tracking.admin.correct');

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('time.tracking.team.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  return (
    <>
      <WfmOfficeSectionHeading
        title="Zeitbuchungen prüfen"
        subtitle="Offene Arbeitszeitfälle zur Prüfung und Freigabe"
      />
      {tenantId && reviewerId ? (
        <WfmOfficeTimeHistoryPanel
          tenantId={tenantId}
          reviewerId={reviewerId}
          roleKey={roleKey}
          canCorrect={canCorrect}
          initialFilterAmpel="pending"
          reviewQueueMode
        />
      ) : null}
    </>
  );
}
