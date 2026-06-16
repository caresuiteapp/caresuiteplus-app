import { useState } from 'react';
import { AdaptiveListDetail } from '@/components/adaptive';
import { OfficeMessageDetailSummaryPanel } from '@/components/office/OfficeMessageDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { OfficeMessagesListScreen } from './OfficeMessagesListScreen';

export function OfficeMessagesAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!useMasterDetail) {
    return <OfficeMessagesListScreen />;
  }

  return (
    <AdaptiveListDetail
      list={
        <OfficeMessagesListScreen
          embedded
          selectedId={selectedId}
          onMessagePress={setSelectedId}
        />
      }
      detail={
        selectedId ? <OfficeMessageDetailSummaryPanel messageId={selectedId} /> : undefined
      }
      showDetail={!!selectedId}
    />
  );
}
