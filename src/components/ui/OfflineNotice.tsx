import { InfoBanner } from './InfoBanner';

type OfflineNoticeProps = {
  visible?: boolean;
};

/** OFFLINE.2 — honest connectivity banner with assignment cache hint. */
export const OFFLINE_NOTICE_MESSAGE =
  'Keine Verbindung. Zwischengespeicherte Einsatzdaten können eingesehen werden. Aktionen sind eingeschränkt.';

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
