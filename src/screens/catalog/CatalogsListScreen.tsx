import { LockedActionBanner } from '@/components/permissions';
import { CatalogsListView } from '@/components/catalog/CatalogsListView';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
import { useCatalogList } from '@/hooks/useCatalogList';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';

export function CatalogsListScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { items, loading, error, refresh } = useCatalogList();

  if (!can('office.catalogs.view')) {
    return (
      <ScreenShell title="Kataloge" subtitle={roleLabel ?? 'Office'}>
        <LockedActionBanner
          message={check('office.catalogs.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && items.length === 0) {
    return (
      <ScreenShell title="Kataloge" subtitle="Wird geladen…">
        <LoadingState message="Kataloge werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && items.length === 0) {
    return (
      <ScreenShell title="Kataloge" subtitle="Fehler">
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Kataloge" subtitle="Leistungen, Tarife & Qualifikationen" scroll={false}>
      <CatalogsListView
        items={items}
        roleKey={roleKey}
        loading={loading}
        onRefresh={refresh}
      />
    </ScreenShell>
  );
}
