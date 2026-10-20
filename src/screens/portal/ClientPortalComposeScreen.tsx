import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP353 */
export function ClientPortalComposeScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={353}
      domain="clientPortal"
      permission="portal.client.messages.view"
      audienceScope="portal"
    />
  );
}
