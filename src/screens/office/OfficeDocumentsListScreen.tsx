import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { DocumentsListView } from '@/components/office/DocumentsListView';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { PortalUploadsOfficePanel } from '@/components/office/PortalUploadsOfficePanel';
import { SectionPanel } from '@/components/ui';

export function OfficeDocumentsListScreen() {
  const router = useRouter();
  const { can, isReadOnly } = usePermissions();
  const tenantId = useServiceTenantId();
  const canUpload = can('office.documents.upload' as never);
  const officeAccent = moduleColor('office');

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
        <DocumentsListView />
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
