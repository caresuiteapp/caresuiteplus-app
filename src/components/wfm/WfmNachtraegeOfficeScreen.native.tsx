// Generated native presentation from src/components/wfm/WfmNachtraegeOfficeScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeP,NativeButton,NativeDiv} from '@/components/layout/NativeWorkspaceElements.native';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { listWfmActiveEmployees } from '@/lib/wfm/wfmPlanningService';
import { WfmOfficeManualEntryPanel } from "./WfmOfficeManualEntryPanel.native.tsx";
import { WfmSecondaryWorkspace, WfmWebNotice } from "./WfmSecondaryWorkspace.native.tsx";
import { queryValue } from "./wfmTimeAccountsModel.native.ts";
import { validManualDate } from "./wfmManualEntryDraft.native.ts";
export function WfmNachtraegeOfficeScreen() {
    const auth = useAuth();
    const tenantId = useServiceTenantId() ?? '';
    const { roleKey, permissions, can } = usePermissions();
    const actorId = auth.user?.id ?? '';
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && tenantId && actorId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('time.tracking.admin.correct'));
    const scope = JSON.stringify([tenantId, actorId, roleKey, [...new Set(permissions)].sort()]);
    const query = useAsyncQuery(() => listWfmActiveEmployees(tenantId), [scope], { enabled: allowed, queryKey: `worktime-manual-team:${scope}` });
    const params = useLocalSearchParams<{
        employee?: string | string[];
        employeeId?: string | string[];
        date?: string | string[];
    }>();
    const requestedEmployee = queryValue(params.employeeId) || queryValue(params.employee);
    const date = queryValue(params.date);
    const router = useRouter();
    const focused = useIsFocused();
    return <WfmSecondaryWorkspace title="Nachträge" description="Vergessene oder fehlende Arbeitszeiten vollständig und nachvollziehbar erfassen.">
    {!auth.authReady ? <NativeP role="status">Zugang wird geprüft …</NativeP> : !allowed ? <WfmWebNotice>Für Nachträge benötigen Sie einen Verwaltungszugang und die Berechtigung für Arbeitszeit-Korrekturen.</WfmWebNotice>
            : <>{query.loading && !query.data ? <NativeP role="status">Mitarbeitende werden geladen …</NativeP> : null}{query.error || query.refreshError ? <WfmWebNotice tone="error">{query.error || query.refreshError}<NativeButton type="button" disabled={query.refreshing} onClick={() => void query.refresh()}>Erneut laden</NativeButton></WfmWebNotice> : null}
        {query.data && !query.error ? <NativeDiv className="wts-panel"><WfmOfficeManualEntryPanel key={scope} tenantId={tenantId} actorId={actorId} roleKey={roleKey} employees={query.data} initialEmployeeId={requestedEmployee || undefined} initialDate={validManualDate(date) ? date : undefined}/></NativeDiv> : null}
        <NativeP className="wts-muted">Gespeicherte Nachträge erscheinen in den Zeitkonten und unter „Offene Prüfungen“. Die Freigabe erfolgt nach der Prüfung.</NativeP><NativeDiv className="wts-actions"><NativeButton type="button" onClick={() => { if (focused)
                router.push('/business/office/time-tracking/historie' as never); }}>Historie öffnen</NativeButton></NativeDiv></>}
  </WfmSecondaryWorkspace>;
}
