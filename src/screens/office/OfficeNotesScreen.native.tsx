// Generated native presentation from src/screens/office/OfficeNotesScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeH1,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo } from 'react';
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { NotesWorkspace } from "../../components/office/notes/NotesWorkspace.native.tsx";
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import type { NotesActor } from "../../lib/office/notes/types.native.ts";
export function OfficeNotesScreen() {
    const { user } = useAuth();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const userId = user?.id?.trim() ?? '';
    const { roleKey, permissions, can } = usePermissions();
    const actor = useMemo<NotesActor>(() => ({ tenantId, userId, roleKey, permissions }), [tenantId, userId, roleKey, permissions]);
    const allowed = Boolean(tenantId && userId && roleKey && !isPortalOnlyRole(roleKey) && can('office.access'));
    return <ScreenShell title="Notizen" scroll={false} contentOwnsHeader>
    {allowed ? <NotesWorkspace key={JSON.stringify([tenantId, userId, roleKey])} actor={actor}/> :
            <NativeSection role="status" style={{ padding: 32, color: '#34465a' }}>
        <NativeH1 style={{ margin: '0 0 12px', color: '#16374b' }}>Notizen</NativeH1>
        <NativeP>Persönliche Notizen sind nach der Anmeldung in einem freigegebenen Office-Bereich verfügbar.</NativeP>
      </NativeSection>}
  </ScreenShell>;
}
