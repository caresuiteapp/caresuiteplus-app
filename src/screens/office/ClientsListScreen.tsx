import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ClientDetailModal } from '@/components/office/clientdetailmodal';
import { ClientIntakeModal } from '@/components/office/clientintakemodal';
import { ClientsListView } from '@/components/office/ClientsListView';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';
import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';

export function ClientsListScreen({
  onClientPress,
  selectedId,
  embedded = false,
  refreshToken = 0,
  useModals = true,
}: {
  onClientPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
  refreshToken?: number;
  /** When false, list actions navigate to full-page routes (master-detail embed). */
  useModals?: boolean;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string; client?: string; edit?: string }>();
  const { can, isReadOnly } = usePermissions();
  const canCreate = can('office.clients.create');
  const officeAccent = moduleColor('office');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEditOpen, setDetailEditOpen] = useState(false);
  const [localRefreshToken, setLocalRefreshToken] = useState(0);
  const modalMode = useModals && !onClientPress;

  useEffect(() => {
    if (params.create === '1' && canCreate && modalMode) {
      setCreateOpen(true);
      router.setParams({ create: undefined } as never);
    }
  }, [params.create, canCreate, modalMode, router]);

  useEffect(() => {
    const clientParam = params.client;
    if (typeof clientParam === 'string' && clientParam.trim() && modalMode) {
      setDetailClientId(clientParam);
      setDetailOpen(true);
      if (params.edit === '1') {
        setDetailEditOpen(true);
        router.setParams({ edit: undefined } as never);
      }
    }
  }, [params.client, params.edit, modalMode, router]);

  const triggerRefresh = () => setLocalRefreshToken((value) => value + 1);

  const openCreate = () => {
    if (modalMode) {
      setCreateOpen(true);
      return;
    }
    router.push(CLIENT_INTAKE_NEW_ROUTE as never);
  };

  const openDetail = (id: string) => {
    if (modalMode) {
      setDetailClientId(id);
      setDetailOpen(true);
      return;
    }
    onClientPress?.(id);
  };

  const handleClientPress = onClientPress ?? (modalMode ? openDetail : undefined);
  const effectiveRefreshToken = refreshToken + localRefreshToken;
  const listView = (
    <ClientsListView
      onClientPress={handleClientPress}
      onOpenDetail={modalMode ? openDetail : undefined}
      onCreatePress={canCreate ? openCreate : undefined}
      selectedId={selectedId ?? detailClientId}
      embedded={embedded}
      refreshToken={effectiveRefreshToken}
    />
  );

  const modals = modalMode ? (
    <>
      <ClientDetailModal
        visible={detailOpen}
        clientId={detailClientId}
        onClose={() => {
          setDetailOpen(false);
          setDetailClientId(null);
          setDetailEditOpen(false);
        }}
        onDeleted={() => {
          setDetailOpen(false);
          setDetailClientId(null);
          setDetailEditOpen(false);
          triggerRefresh();
        }}
        initialEditOpen={detailEditOpen}
      />
      {canCreate ? (
        <ClientIntakeModal
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            triggerRefresh();
            setDetailClientId(id);
            setDetailOpen(true);
          }}
        />
      ) : null}
    </>
  ) : null;

  if (embedded) {
    return (
      <>
        {listView}
        {modals}
      </>
    );
  }

  return (
    <>
      <C14vSubpageShell
        title="Klient:innen"
        subtitle={`Klientenverwaltung${isReadOnly ? ' · Lesemodus' : ''}`}
        moduleLabel="Office"
        showBack={false}
        scroll={false}
        accentColor={officeAccent}
        actions={[
          ...(canCreate
            ? [
                {
                  key: 'create',
                  label: '+ Neue Klient:in',
                  onPress: openCreate,
                  variant: 'primary' as const,
                },
              ]
            : []),
          {
            key: 'refresh',
            label: 'Aktualisieren',
            onPress: triggerRefresh,
            variant: 'ghost' as const,
          },
        ]}
      >
        <View style={styles.content}>{listView}</View>
      </C14vSubpageShell>
      {modals}
    </>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, minWidth: 0, minHeight: 0 },
});
