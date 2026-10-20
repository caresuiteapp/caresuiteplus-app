import { usePageRecord } from '@/hooks/usePageRecord';
import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { CarePlanDetailSummaryPanel } from '@/components/pflege/CarePlanDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { CarePlansListScreen } from './CarePlansListScreen';

export function CarePlansAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = usePageRecord<string | null>('CarePlansAdaptiveScreen.record', null);

  if (!useMasterDetail) {
    return <CarePlansListScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <CarePlansListScreen
          embedded
          selectedId={selectedId}
          onPlanPress={setSelectedId}
        />
      }
      detail={selectedId ? <CarePlanDetailSummaryPanel planId={selectedId} /> : undefined}
      showDetail={!!selectedId}
    />
  );
}
