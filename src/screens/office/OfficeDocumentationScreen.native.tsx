// Generated native presentation from src/screens/office/OfficeDocumentationScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeH1,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { DocumentationWorkspace } from "../../components/office/documentation/DocumentationWorkspace.native.tsx";
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
export function OfficeDocumentationScreen() {
    const { user, portalSession } = useAuth();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const { roleKey, can } = usePermissions();
    const allowed = tenantId && user?.id && (roleKey === 'employee_portal' || (!isPortalOnlyRole(roleKey) && can('office.access')));
    const scope = JSON.stringify([tenantId, user?.id, roleKey, portalSession?.accountId]);
    return <ScreenShell title="Dokumentation" scroll={false} contentOwnsHeader>
    {allowed ? <DocumentationWorkspace key={scope} actor={{ tenantId, userId: user!.id, canUpload: !isPortalOnlyRole(roleKey) }}/> : <NativeSection role="status" style={{ padding: 28, color: '#234457' }}><NativeH1>Dokumentation</NativeH1><NativeP>Bitte mit einem aktiven Teamzugang anmelden, um die gemeinsame Dokumentation zu öffnen.</NativeP></NativeSection>}
  </ScreenShell>;
}
