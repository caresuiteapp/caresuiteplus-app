import { useState } from 'react';
import { AdaptiveListDetail } from '@/components/adaptive';
import { OfficeDocumentDetailSummaryPanel } from '@/components/office/OfficeDocumentDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { OfficeDocumentsListScreen } from './OfficeDocumentsListScreen';

export function OfficeDocumentsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!useMasterDetail) {
    return <OfficeDocumentsListScreen />;
  }

  return (
    <AdaptiveListDetail
      list={
        <OfficeDocumentsListScreen
          embedded
          selectedId={selectedId}
          onDocumentPress={setSelectedId}
        />
      }
      detail={
        selectedId ? <OfficeDocumentDetailSummaryPanel documentId={selectedId} /> : undefined
      }
      showDetail={!!selectedId}
    />
  );
}
