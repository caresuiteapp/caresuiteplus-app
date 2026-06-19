import { useState } from 'react';
import { TripDetailGlassModal } from '@/components/assist/TripDetailGlassModal';
import { TripsListScreen } from './TripsListScreen';

type TripsAdaptiveScreenProps = {
  /** Deep-link from /assist/fahrten/[id] — opens modal on mount. */
  initialSelectedId?: string | null;
};

/** Full-width trips list; row tap opens TripDetailGlassModal. */
export function TripsAdaptiveScreen({ initialSelectedId = null }: TripsAdaptiveScreenProps = {}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  return (
    <>
      <TripsListScreen onTripPress={setSelectedId} selectedId={selectedId} />
      <TripDetailGlassModal
        visible={!!selectedId}
        tripId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
