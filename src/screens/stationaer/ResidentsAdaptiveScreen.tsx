import { usePageRecord } from '@/hooks/usePageRecord';
import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { ResidentDetailSummaryPanel } from '@/components/stationaer/ResidentDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { ResidentsListScreen } from './ResidentsListScreen';

export function ResidentsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = usePageRecord<string | null>('ResidentsAdaptiveScreen.record', null);

  if (!useMasterDetail) {
    return <ResidentsListScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <ResidentsListScreen
          embedded
          selectedId={selectedId}
          onResidentPress={setSelectedId}
        />
      }
      detail={selectedId ? <ResidentDetailSummaryPanel residentId={selectedId} /> : undefined}
      showDetail={!!selectedId}
    />
  );
}
