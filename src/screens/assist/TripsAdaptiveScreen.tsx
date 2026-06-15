import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { TripDetailSummaryPanel } from '@/components/assist/TripDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { TripsListScreen } from './TripsListScreen';

export function TripsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!useMasterDetail) {
    return <TripsListScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <TripsListScreen embedded selectedId={selectedId} onTripPress={setSelectedId} />
      }
      detail={selectedId ? <TripDetailSummaryPanel tripId={selectedId} /> : undefined}
      showDetail={!!selectedId}
    />
  );
}
