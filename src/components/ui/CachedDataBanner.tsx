import { InfoBanner } from './InfoBanner';
import { formatAssignmentCacheTimestamp } from '@/lib/offline/assignmentCacheService';

type CachedDataBannerProps = {
  visible?: boolean;
  cachedAt?: string | null;
  /** When true, clarify that workflow actions are blocked (execute offline). */
  readOnly?: boolean;
};

export function CachedDataBanner({
  visible = false,
  cachedAt = null,
  readOnly = false,
}: CachedDataBannerProps) {
  if (!visible || !cachedAt) return null;

  const timestamp = formatAssignmentCacheTimestamp(cachedAt);
  const message = readOnly
    ? `Zwischengespeicherte Einsatzdaten (Stand: ${timestamp}). Offline sind keine Änderungen möglich.`
    : `Zwischengespeicherte Daten (Stand: ${timestamp}). Bitte bei Gelegenheit online aktualisieren.`;

  return (
    <InfoBanner
      variant="info"
      title="Zwischengespeicherte Daten"
      message={message}
      icon="💾"
    />
  );
}
