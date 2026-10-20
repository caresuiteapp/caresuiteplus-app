import { InfoBanner } from '@/components/ui';
import { CONNECT_PREPARED_INTERFACE, isConnectLiveReady } from '@/lib/connect';

export function ConnectPreparedBanner() {
  if (isConnectLiveReady()) return null;

  return (
    <InfoBanner
      title="Connect-Schnittstellen in Vorbereitung"
      message={CONNECT_PREPARED_INTERFACE}
    />
  );
}
