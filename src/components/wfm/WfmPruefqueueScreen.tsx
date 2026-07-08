import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { WfmOfficeTimeHistoryPanel } from '@/components/wfm/WfmOfficeTimeHistoryPanel';

export function WfmPruefqueueScreen() {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const reviewerId = user?.id ?? profile?.id ?? '';
  const { can, check, roleLabel, roleKey } = usePermissions();
  const canView = can('time.tracking.team.view');
  const canCorrect = can('time.tracking.admin.correct');

  if (!canView) {
    return (
      <ScreenShell title="Zeitbuchungen prüfen" showBack={false}>
        <LockedActionBanner
          message={check('time.tracking.team.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Zeitbuchungen prüfen"
      subtitle="Offene Arbeitszeitfälle zur Prüfung und Freigabe"
      showBack={false}
      scroll
    >
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
    </ScreenShell>
  );
}
