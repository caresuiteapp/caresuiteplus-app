import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP393 */
export function StationaerComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={393}
      domain="stationaer"
      permission="stationaer.residents.view"
      audienceScope="office"
    />
  );
}
