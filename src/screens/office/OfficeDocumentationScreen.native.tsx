// Generated native presentation from src/screens/office/OfficeDocumentationScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeH1,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { employeePortalDesign } from '@/components/portal/employee/employeePortalDesign';
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { DocumentationWorkspace } from "../../components/office/documentation/DocumentationWorkspace.native.tsx";
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
export function OfficeDocumentationScreen({ employeeView = false }: {
    employeeView?: boolean;
} = {}) {
    const { user, portalSession } = useAuth();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const { roleKey, can } = usePermissions();
    const allowed = tenantId && user?.id && (roleKey === 'employee_portal' || (!isPortalOnlyRole(roleKey) && can('office.access')));
    const scope = JSON.stringify([tenantId, user?.id, roleKey, portalSession?.accountId]);
    const content = allowed ? <DocumentationWorkspace key={scope} employeeView={employeeView} actor={{ tenantId, userId: user!.id, canUpload: !employeeView && !isPortalOnlyRole(roleKey) }}/>
        : <NativeSection role="status" style={{ padding: 28, color: employeeView ? employeePortalDesign.text : '#234457' }}><NativeH1>Dokumentation</NativeH1><NativeP>Bitte mit einem aktiven Teamzugang anmelden, um die gemeinsame Dokumentation zu öffnen.</NativeP></NativeSection>;
    if (employeeView)
        return <PortalTabScreen title="Dokumentation" scroll={false} contentOwnsHero>{content}</PortalTabScreen>;
    return <ScreenShell title="Dokumentation" scroll={false} contentOwnsHeader>{content}</ScreenShell>;
}
