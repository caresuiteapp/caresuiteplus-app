import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP553 */
export function SecurityComposeMessageScreen() {
  return <MessageComposeScreenShell wpNumber={553} domain="security" permission="security.manage" audienceScope="office" />;
}
