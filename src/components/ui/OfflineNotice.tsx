import { InfoBanner } from './InfoBanner';

type OfflineNoticeProps = {
  visible?: boolean;
};

/** OFFLINE.1 — honest connectivity banner; full offline persistence comes in later phases. */
export const OFFLINE_NOTICE_MESSAGE =
  'Keine Verbindung. Einige Funktionen sind eingeschränkt. Offline-Speicherung wird schrittweise vorbereitet.';

export function OfflineNotice({ visible = false }: OfflineNoticeProps) {
  if (!visible) return null;

  return (
    <InfoBanner
      variant="warning"
      title="Offline"
      message={OFFLINE_NOTICE_MESSAGE}
      icon="📡"
    />
  );
}
