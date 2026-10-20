import { InfoBanner } from '@/components/ui';
import { GEO_PREPARED_MESSAGE, isGeoLiveReady } from '@/lib/geo';

type GeoPreparedBannerProps = {
  compact?: boolean;
};

/**
 * Hinweis für Karten/GPS — keine Live-Ortung ohne Rechtsgrundlage und Provider-Freigabe.
 */
export function GeoPreparedBanner({ compact: _compact = false }: GeoPreparedBannerProps) {
  if (isGeoLiveReady()) return null;

  return (
    <InfoBanner
      title="Routen & GPS in Vorbereitung"
      message={GEO_PREPARED_MESSAGE}
    />
  );
}
