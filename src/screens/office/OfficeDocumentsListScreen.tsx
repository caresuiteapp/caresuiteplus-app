import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { DocumentsListView } from '@/components/office/DocumentsListView';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchOfficeDocumentList } from '@/lib/office/officeDocumentsService';

export function OfficeDocumentsListScreen() {
  const router = useRouter();
  const { can, isReadOnly } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const canUpload = can('office.documents.upload' as never);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeDocumentList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Dokumente" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Dokumente werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Dokumente" subtitle="Fehler" scroll={false}>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  const isEmpty = (query.data ?? []).length === 0;

  return (
    <CareLightPageShell
      title="Dokumente"
      subtitle={`Office Ablage${isReadOnly ? ' · Lesemodus' : ''}`}
      rightSlot={
        canUpload ? (
          <PremiumButton
            title="Upload"
            size="sm"
            onPress={() => router.push('/business/office/documents/upload' as never)}
          />
        ) : null
      }
      scroll={false}
    >
      <View style={styles.content}>
        {isEmpty ? (
          <EmptyState
            title="Keine Dokumente"
            message="Laden Sie das erste Dokument hoch."
            actionLabel={canUpload ? 'Dokument hochladen' : undefined}
            onAction={canUpload ? () => router.push('/business/office/documents/upload' as never) : undefined}
          />
        ) : (
          <DocumentsListView />
        )}
      </View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
