import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP433 */
export function AkademieComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={433}
      domain="akademie"
      permission="akademie.courses.view"
      audienceScope="office"
    />
  );
}
