import { CertificatesListView } from '@/components/akademie';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchCertificateList } from '@/lib/akademie/moduleExtensionService';

export function CertificatesScreen() {
  const { roleLabel } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCertificateList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title="Zertifikate" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Zertifikate werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title="Zertifikate" subtitle="Fehler" scroll={false}>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Zertifikate" subtitle={`Nachweise · ${roleLabel ?? 'Demo'}`} scroll={false}>
      {items.length === 0 ? (
        <EmptyState title="Keine Zertifikate" message="Es sind noch keine Zertifikate ausgestellt." />
      ) : (
        <CertificatesListView />
      )}
    </ScreenShell>
  );
}

void fetchCertificateList;
