import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP413 */
export function BeratungComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={413}
      domain="beratung"
      permission="beratung.cases.view"
      audienceScope="office"
    />
  );
}
