import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { ThreadDetailSummaryPanel } from '@/components/communication/ThreadDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { CommunicationCenterScreen } from './CommunicationCenterScreen';

export function CommunicationAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!useMasterDetail) {
    return <CommunicationCenterScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <CommunicationCenterScreen
          embedded
          selectedId={selectedId}
          onThreadPress={setSelectedId}
        />
      }
      detail={selectedId ? <ThreadDetailSummaryPanel threadId={selectedId} /> : undefined}
      showDetail={!!selectedId}
    />
  );
}
