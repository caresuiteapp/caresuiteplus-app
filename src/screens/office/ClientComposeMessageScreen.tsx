import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP173 */
export function ClientComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={173}
      domain="clients"
      permission="office.clients.view"
      audienceScope="office"
    />
  );
}
