import { employeePortalDesign } from '@/components/portal/employee/employeePortalDesign';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { DocumentationWorkspace } from '@/components/office/documentation/DocumentationWorkspace.web';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export function OfficeDocumentationScreen({ employeeView = false }: { employeeView?: boolean } = {}) {
  const { user, portalSession } = useAuth();
  const tenantId = useServiceTenantId()?.trim() ?? '';
  const { roleKey, can } = usePermissions();
  const allowed = tenantId && user?.id && (roleKey === 'employee_portal' || (!isPortalOnlyRole(roleKey) && can('office.access')));
  const scope = JSON.stringify([tenantId, user?.id, roleKey, portalSession?.accountId]);
  const content = allowed ? <DocumentationWorkspace key={scope} employeeView={employeeView} actor={{ tenantId, userId: user!.id, canUpload: !employeeView && !isPortalOnlyRole(roleKey) }} />
    : <section role="status" style={{ padding: 28, color: employeeView ? employeePortalDesign.text : '#234457' }}><h1>Dokumentation</h1><p>Bitte mit einem aktiven Teamzugang anmelden, um die gemeinsame Dokumentation zu öffnen.</p></section>;
  if (employeeView) return <PortalTabScreen title="Dokumentation" scroll={false} contentOwnsHero>{content}</PortalTabScreen>;
  return <ScreenShell title="Dokumentation" scroll={false} contentOwnsHeader>{content}</ScreenShell>;
}
