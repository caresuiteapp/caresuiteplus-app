import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { LoadingState } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';

/** Legacy /edit route — redirects to client record and opens the intake edit modal. */
export function ClientEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canEdit = can('office.clients.edit');

  useEffect(() => {
    if (!canEdit || !id) return;
    router.replace(`${clientRecordRoute(id)}?edit=1` as never);
  }, [canEdit, id, router]);

  if (!canEdit) {
    return (
      <ScreenShell title="Bearbeiten" subtitle="Kein Zugriff">
        <LockedActionBanner
          message={check('office.clients.edit').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (!id) {
    return (
      <ScreenShell title="Bearbeiten" subtitle="Fehler">
        <LockedActionBanner message="Keine Klient:innen-ID." roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Stammdaten bearbeiten" subtitle="Wird geöffnet…">
      <LoadingState message="Bearbeitungsdialog wird geladen…" />
    </ScreenShell>
  );
}
