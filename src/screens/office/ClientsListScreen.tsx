import { useEffect, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenShell } from '@/components/layout';

import { ClientDetailModal } from '@/components/office/clientdetailmodal';

import { ClientIntakeModal } from '@/components/office/clientintakemodal';

import { ClientsListView } from '@/components/office/ClientsListView';

import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';

import { useClientList } from '@/hooks/useClientList';

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

  const list = useClientList();



  const [createOpen, setCreateOpen] = useState(false);

  const [detailClientId, setDetailClientId] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEditOpen, setDetailEditOpen] = useState(false);



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

    if (onClientPress) {

      onClientPress(id);

      return;

    }

  };



  const handleClientPress = onClientPress ?? (modalMode ? openDetail : undefined);



  const listView = (

    <ClientsListView

      onClientPress={handleClientPress}

      onOpenDetail={modalMode ? openDetail : undefined}

      onCreatePress={canCreate ? openCreate : undefined}

      selectedId={selectedId ?? detailClientId}

      embedded={embedded}

      refreshToken={refreshToken}

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

          void list.refresh();

        }}

        initialEditOpen={detailEditOpen}

      />

      {canCreate ? (

        <ClientIntakeModal

          visible={createOpen}

          onClose={() => setCreateOpen(false)}

          onCreated={(id) => {

            setCreateOpen(false);

            void list.refresh();

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



  if (list.loading && list.allItems.length === 0) {

    return (

      <ScreenShell title="Klient:innen" subtitle="Wird geladen…" scroll={false}>

        <LoadingState message="Daten werden geladen…" />

      </ScreenShell>

    );

  }



  if (list.error && list.allItems.length === 0) {

    return (

      <ScreenShell title="Klient:innen" subtitle="Fehler" scroll={false}>

        <ErrorState message={list.error} onRetry={list.refresh} />

      </ScreenShell>

    );

  }



  return (

    <>

      <ScreenShell

        title="Klient:innen"

        subtitle={`Office Stammdaten${isReadOnly ? ' · Lesemodus' : ''}`}

        rightSlot={

          canCreate ? (

            <PremiumButton title="+ Neu" onPress={openCreate} />

          ) : null

        }

        scroll={false}

      >

        <View style={styles.content}>

          {list.isEmpty && !list.hasActiveFilters ? (

            <EmptyState

              title="Keine Klient:innen"

              message="Legen Sie die erste Klient:in im Demo-Mandanten an."

              actionLabel={canCreate ? 'Klient:in anlegen' : undefined}

              onAction={canCreate ? openCreate : undefined}

            />

          ) : (

            listView

          )}

        </View>

      </ScreenShell>

      {modals}

    </>

  );

}



const styles = StyleSheet.create({

  content: {

    flex: 1,

  },

});

