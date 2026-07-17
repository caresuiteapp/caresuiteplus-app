import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ScreenShell } from '@/components/layout';
import { DocumentsListView } from '@/components/office/DocumentsListView';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchOfficeDocumentList } from '@/lib/office/officeDocumentsService';
import { PortalUploadsOfficePanel } from '@/components/office/PortalUploadsOfficePanel';
import { SectionPanel } from '@/components/ui';

export function OfficeDocumentsListScreen() {
  const router = useRouter();
  const { can, isReadOnly } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const canUpload = can('office.documents.upload' as never);
  const officeAccent = moduleColor('office');

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
      <ScreenShell title="Dokumente" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Dokumente werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Dokumente" subtitle="Fehler" scroll={false}>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const isEmpty = (query.data ?? []).length === 0;

  return (
    <C14vSubpageShell
      title="Dokumente"
      eyebrow="OFFICE · ABLAGE"
      subtitle={`Dokumentenverwaltung${isReadOnly ? ' · Lesemodus' : ''}`}
      moduleLabel="Office"
      showBack={false}
      scroll={false}
      accentColor={officeAccent}
      actions={[
        ...(canUpload
          ? [{ key: 'upload', label: 'Hochladen', onPress: () => router.push('/business/office/documents/upload' as never), variant: 'primary' as const }]
          : []),
        { key: 'refresh', label: 'Aktualisieren', onPress: () => query.refresh(), variant: 'ghost' as const },
      ]}
    >
      <View style={styles.content}>
        {tenantId ? (
          <SectionPanel
            title="Eingang aus Mitarbeiter- und Klient:innenportal"
            subtitle="Hochgeladene Dokumente prüfen und der richtigen Akte zuordnen"
          >
            <PortalUploadsOfficePanel tenantId={tenantId} />
          </SectionPanel>
        ) : null}
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
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 16,
  },
});
