import { InfoBanner } from './InfoBanner';

type OfflineNoticeProps = {
  visible?: boolean;
  verifiedAt?: string | null;
};

/** OFFLINE.2 — honest connectivity banner with assignment cache hint. */
export const OFFLINE_NOTICE_MESSAGE =
  'Keine Verbindung. Zwischengespeicherte Einsatzdaten können eingesehen werden. Aktionen sind eingeschränkt.';

export function OfflineNotice({ visible = false, verifiedAt }: OfflineNoticeProps) {
  if (!visible) return null;

  return (
    <InfoBanner
      variant="warning"
      title="Offline"
      message={verifiedAt
        ? `Zuordnung zuletzt am ${new Date(verifiedAt).toLocaleString('de-DE')} bestätigt. Gespeicherte Einsatzdaten sind zum Lesen verfügbar. Änderungen erfordern eine Online-Verbindung.`
        : OFFLINE_NOTICE_MESSAGE}
      icon="📡"
    />
  );
}
