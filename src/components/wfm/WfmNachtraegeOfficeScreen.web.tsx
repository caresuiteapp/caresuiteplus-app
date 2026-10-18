import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { listWfmActiveEmployees } from '@/lib/wfm/wfmPlanningService';
import { WfmOfficeManualEntryPanel } from './WfmOfficeManualEntryPanel.web';
import { WfmSecondaryWorkspace, WfmWebNotice } from './WfmSecondaryWorkspace.web';
import { queryValue } from './wfmTimeAccountsModel.web';
import { validManualDate } from './wfmManualEntryDraft.web';

export function WfmNachtraegeOfficeScreen() {
  const auth = useAuth(); const tenantId = useServiceTenantId() ?? ''; const { roleKey, permissions, can } = usePermissions();
  const actorId = auth.user?.id ?? '';
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && tenantId && actorId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('time.tracking.admin.correct'));
  const scope = JSON.stringify([tenantId, actorId, roleKey, [...new Set(permissions)].sort()]);
  const query = useAsyncQuery(() => listWfmActiveEmployees(tenantId), [scope], { enabled: allowed, queryKey: `worktime-manual-team:${scope}` });
  const params = useLocalSearchParams<{ employee?: string | string[]; employeeId?: string | string[]; date?: string | string[] }>();
  const requestedEmployee = queryValue(params.employeeId) || queryValue(params.employee);
  const date = queryValue(params.date);
  const router = useRouter(); const focused = useIsFocused();
  return <WfmSecondaryWorkspace title="Nachträge" description="Vergessene oder fehlende Arbeitszeiten vollständig und nachvollziehbar erfassen.">
    {!auth.authReady ? <p role="status">Zugang wird geprüft …</p> : !allowed ? <WfmWebNotice>Für Nachträge benötigen Sie einen Verwaltungszugang und die Berechtigung für Arbeitszeit-Korrekturen.</WfmWebNotice>
      : <>{query.loading && !query.data ? <p role="status">Mitarbeitende werden geladen …</p> : null}{query.error || query.refreshError ? <WfmWebNotice tone="error">{query.error || query.refreshError}<button type="button" disabled={query.refreshing} onClick={() => void query.refresh()}>Erneut laden</button></WfmWebNotice> : null}
        {query.data && !query.error ? <div className="wts-panel"><WfmOfficeManualEntryPanel key={scope} tenantId={tenantId} actorId={actorId} roleKey={roleKey} employees={query.data} initialEmployeeId={requestedEmployee || undefined} initialDate={validManualDate(date) ? date : undefined} /></div> : null}
        <p className="wts-muted">Gespeicherte Nachträge erscheinen in den Zeitkonten und unter „Offene Prüfungen“. Die Freigabe erfolgt nach der Prüfung.</p><div className="wts-actions"><button type="button" onClick={() => { if (focused) router.push('/business/office/time-tracking/historie' as never); }}>Historie öffnen</button></div></>}
  </WfmSecondaryWorkspace>;
}
