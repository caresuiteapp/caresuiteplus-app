import { useState } from 'react';
import { AdaptiveListDetail } from '@/components/adaptive';
import { ClientDetailSummaryPanel } from '@/components/office/ClientDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { ClientsListScreen } from './ClientsListScreen';

export function ClientsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
