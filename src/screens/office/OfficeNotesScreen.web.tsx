import { useMemo } from 'react';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { NotesWorkspace } from '@/components/office/notes/NotesWorkspace.web';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import type { NotesActor } from '@/lib/office/notes/types.web';

export function OfficeNotesScreen() {
  const { user } = useAuth();
  const tenantId = useServiceTenantId()?.trim() ?? '';
  const userId = user?.id?.trim() ?? '';
  const { roleKey, permissions, can } = usePermissions();
  const actor = useMemo<NotesActor>(() => ({ tenantId, userId, roleKey, permissions }), [tenantId, userId, roleKey, permissions]);
  const allowed = Boolean(tenantId && userId && roleKey && !isPortalOnlyRole(roleKey) && can('office.access'));

  return <ScreenShell title="Notizen" scroll={false} contentOwnsHeader>
    {allowed ? <NotesWorkspace key={JSON.stringify([tenantId, userId, roleKey])} actor={actor} /> :
      <section role="status" style={{ padding: 32, color: '#34465a' }}>
        <h1 style={{ margin: '0 0 12px', color: '#16374b' }}>Notizen</h1>
        <p>Persönliche Notizen sind nach der Anmeldung in einem freigegebenen Office-Bereich verfügbar.</p>
      </section>}
  </ScreenShell>;
}
