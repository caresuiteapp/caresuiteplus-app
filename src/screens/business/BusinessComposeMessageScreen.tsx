import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP133 */
export function BusinessComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={133}
      domain="business"
      permission="dashboard.view"
      audienceScope="office"
    />
  );
}
