import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP493 */
export function IntegrationComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={493}
      domain="integrations"
      permission="integrations.manage"
      audienceScope="office"
    />
  );
}
