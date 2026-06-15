import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP473 */
export function PlatformComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={473}
      domain="platform"
      permission="platform.ai.manage"
      audienceScope="office"
    />
  );
}
