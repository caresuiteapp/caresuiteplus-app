import { useState } from 'react';
import { AdaptiveListDetail } from '@/components/adaptive';
import { ClientDetailModal } from '@/components/office/clientdetailmodal';
import { ClientDetailSummaryPanel } from '@/components/office/ClientDetailSummaryPanel';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { ClientsListScreen } from './ClientsListScreen';

export function ClientsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const shellHostsAurora = useShellHostsAurora();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (shellHostsAurora) {
    return (
      <>
        <ClientsListScreen onClientPress={setSelectedId} selectedId={selectedId} />
        <ClientDetailModal
          visible={!!selectedId}
          clientId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      </>
    );
  }

  if (!useMasterDetail) {
    return <ClientsListScreen />;
  }

  return (
    <AdaptiveListDetail
      list={
        <ClientsListScreen
          embedded
          selectedId={selectedId}
          onClientPress={setSelectedId}
        />
      }
      detail={
        selectedId ? (
          <ClientDetailSummaryPanel clientId={selectedId} />
        ) : undefined
      }
      showDetail={!!selectedId}
    />
  );
}
