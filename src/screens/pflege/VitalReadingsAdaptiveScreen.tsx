import { usePageRecord } from '@/hooks/usePageRecord';
import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { VitalReadingDetailSummaryPanel } from '@/components/pflege/VitalReadingDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { VitalReadingsListScreen } from './VitalReadingsListScreen';

export function VitalReadingsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = usePageRecord<string | null>('VitalReadingsAdaptiveScreen.record', null);

  if (!useMasterDetail) {
    return <VitalReadingsListScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <VitalReadingsListScreen
          embedded
          selectedId={selectedId}
          onReadingPress={setSelectedId}
        />
      }
      detail={
        selectedId ? <VitalReadingDetailSummaryPanel readingId={selectedId} /> : undefined
      }
      showDetail={!!selectedId}
    />
  );
}
