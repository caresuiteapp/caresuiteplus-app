// Generated native presentation from src/components/wfm/WfmPruefqueueScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { LockedActionBanner } from '@/components/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { WfmOfficeTimeHistoryPanel } from "./WfmOfficeTimeHistoryPanel.native.tsx";
export function WfmPruefqueueScreen() {
    const tenantId = useServiceTenantId();
    const { user } = useAuth();
    const { can, check, roleLabel, roleKey } = usePermissions();
    if (!can('time.tracking.team.view'))
        return <LockedActionBanner message={check('time.tracking.team.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel}/>;
    if (!tenantId || !user?.id)
        return <NativeP role="status">Der Firmenzugang wird geladen …</NativeP>;
    return <WfmOfficeTimeHistoryPanel tenantId={tenantId} reviewerId={user.id} roleKey={roleKey} canCorrect={can('time.tracking.admin.correct')} initialFilterAmpel="pending" reviewQueueMode/>;
}
