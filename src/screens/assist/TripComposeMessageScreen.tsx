import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP313 */
export function TripComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={313}
      domain="trips"
      permission="assist.trips.view"
      audienceScope="office"
    />
  );
}
