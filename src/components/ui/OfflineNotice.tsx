import { InfoBanner } from './InfoBanner';

type OfflineNoticeProps = {
  visible?: boolean;
};

/** Prepared offline state — wire to connectivity when NetInfo is available. */
export function OfflineNotice({ visible = false }: OfflineNoticeProps) {
  if (!visible) return null;

  return (
    <InfoBanner
      variant="warning"
      title="Offline"
      message="Keine Verbindung. Einige Funktionen sind erst wieder online verfügbar."
      icon="📡"
    />
  );
}
