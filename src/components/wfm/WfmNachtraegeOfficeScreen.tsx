import { useCallback } from 'react';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { listWfmActiveEmployees } from '@/lib/wfm/wfmPlanningService';
import { WfmOfficeManualEntryPanel } from '@/components/wfm/WfmOfficeManualEntryPanel';

export function WfmNachtraegeOfficeScreen() {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const actorId = user?.id ?? profile?.id ?? '';
  const { can, check, roleLabel, roleKey } = usePermissions();
  const canCorrect = can('time.tracking.admin.correct');

  const teamQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canCorrect) {
        return { ok: true as const, data: { rows: [] } };
      }
      const result = await listWfmActiveEmployees(tenantId);
      if (!result.ok) return result;
      return { ok: true as const, data: { employees: result.data } };
    }, [tenantId, canCorrect]),
    [tenantId, canCorrect],
    { enabled: !!tenantId && canCorrect },
  );

  if (!canCorrect) {
    return (
      <ScreenShell title="Nachträge" showBack={false}>
        <LockedActionBanner
          message={check('time.tracking.admin.correct').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  const employees = teamQuery.data?.employees ?? [];

  return (
    <ScreenShell title="Nachträge" subtitle="Manuelle Office-Zeitbuchungen" showBack={false} scroll>
      {teamQuery.loading && !teamQuery.data ? <LoadingState message="Mitarbeitende werden geladen…" /> : null}
      {teamQuery.error ? (
        <ErrorState title="Fehler" message={teamQuery.error} onRetry={() => void teamQuery.refresh()} />
      ) : null}
      {tenantId && actorId ? (
        <WfmOfficeManualEntryPanel
          tenantId={tenantId}
          actorId={actorId}
          roleKey={roleKey}
          employees={employees}
        />
      ) : null}
    </ScreenShell>
  );
}
