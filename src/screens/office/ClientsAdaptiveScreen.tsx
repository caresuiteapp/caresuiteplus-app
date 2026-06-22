import { useState } from 'react';
import { AdaptiveListDetail } from '@/components/adaptive';
import { ClientDetailSummaryPanel } from '@/components/office/ClientDetailSummaryPanel';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { ClientsListScreen } from './ClientsListScreen';

export function ClientsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const shellHostsAurora = useShellHostsAurora();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listRefreshToken, setListRefreshToken] = useState(0);

  if (shellHostsAurora) {
    return <ClientsListScreen />;
  }

  if (!useMasterDetail) {
    return <ClientsListScreen />;
  }

  return (
    <AdaptiveListDetail
      list={
        <ClientsListScreen
          embedded
          useModals={false}
          selectedId={selectedId}
          onClientPress={setSelectedId}
          refreshToken={listRefreshToken}
        />
      }
      detail={
        selectedId ? (
          <ClientDetailSummaryPanel
            clientId={selectedId}
            onDeleted={() => {
              setSelectedId(null);
              setListRefreshToken((value) => value + 1);
            }}
          />
        ) : undefined
      }
      showDetail={!!selectedId}
    />
  );
}
