import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router';
import { useWebBackNavigation } from '@/hooks/useWebBackNavigation.web';
import { webPageHref } from '@/lib/navigation/webPageHref';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ClientDetailModal } from '@/components/office/clientdetailmodal';
import { ClientIntakeModal } from '@/components/office/clientintakemodal';
import { ClientsListExperience } from '@/components/office/ClientsListExperience.web';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';
import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';

export function ClientsListScreen({
  onClientPress,
  selectedId,
  embedded = false,
  refreshToken = 0,
  useModals = true,
  moduleLabel = 'Office',
  contextLabel = 'Klientenverwaltung',
}: {
  onClientPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
  refreshToken?: number;
  /** When false, list actions navigate to full-page routes (master-detail embed). */
  useModals?: boolean;
  moduleLabel?: string;
  contextLabel?: string;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string; client?: string; edit?: string; tab?: string }>();
  const pathname = usePathname();
  const focused = useIsFocused();
  const listHref = webPageHref(pathname, params, { client: undefined, edit: undefined, tab: undefined, create: undefined });
  const closeDetail = useWebBackNavigation(listHref);
  const { can, isReadOnly } = usePermissions();
  const canCreate = can('office.clients.create');
  const accent = moduleColor(moduleLabel === 'Pflege' ? 'pflege' : 'office');
  const createOpen = focused && params.create === '1';
  const detailClientId = typeof params.client === 'string' && params.client.trim() ? params.client : null;
  const detailOpen = focused && Boolean(detailClientId);
  const detailEditOpen = params.edit === '1';
  const [localRefreshToken, setLocalRefreshToken] = useState(0);
  const modalMode = useModals && !onClientPress;

  const triggerRefresh = () => setLocalRefreshToken((value) => value + 1);

  const openCreate = () => {
    if (modalMode) {
      router.push(webPageHref(pathname, params, { create: '1', client: undefined, tab: undefined, edit: undefined }) as never);
      return;
    }
    router.push(CLIENT_INTAKE_NEW_ROUTE as never);
  };

  const openDetail = (id: string) => {
    if (modalMode) {
      router.push(webPageHref(pathname, params, { client: id, tab: undefined, edit: undefined, create: undefined }) as never);
      return;
    }
    onClientPress?.(id);
  };

  const handleClientPress = onClientPress ?? (modalMode ? openDetail : undefined);
  const effectiveRefreshToken = refreshToken + localRefreshToken;
  const listView = (
    <ClientsListExperience
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
        onClose={closeDetail}
        onDeleted={() => {
          router.setParams({ client: undefined, tab: undefined, edit: undefined });
          triggerRefresh();
        }}
        initialEditOpen={detailEditOpen}
      />
      {canCreate ? (
        <ClientIntakeModal
          visible={createOpen}
          onClose={closeDetail}
          onCreated={(id) => {
            triggerRefresh();
            router.setParams({ create: undefined, client: id, tab: undefined });
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
        subtitle={`${contextLabel}${isReadOnly ? ' · Lesemodus' : ''}`}
        moduleLabel={moduleLabel}
        showBack={false}
        scroll={false}
        accentColor={accent}
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
