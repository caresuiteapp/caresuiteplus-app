import { useState } from 'react';
import { AdaptiveListDetail } from '@/components/adaptive';
import { ClientDetailSummaryPanel } from '@/components/office/ClientDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { ClientsListScreen } from './ClientsListScreen';

export function ClientsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listRefreshToken, setListRefreshToken] = useState(0);

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
