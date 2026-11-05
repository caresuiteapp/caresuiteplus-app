import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { DocumentationWorkspace } from '@/components/office/documentation/DocumentationWorkspace.web';
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
    {allowed ? <DocumentationWorkspace key={scope} actor={{ tenantId, userId: user!.id }} /> : <section role="status" style={{ padding: 28, color: '#234457' }}><h1>Dokumentation</h1><p>Bitte mit einem aktiven Teamzugang anmelden, um die gemeinsame Dokumentation zu öffnen.</p></section>}
  </ScreenShell>;
}
