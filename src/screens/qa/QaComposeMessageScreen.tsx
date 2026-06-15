import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP573 */
export function QaComposeMessageScreen() {
  return <MessageComposeScreenShell wpNumber={573} domain="qa" permission="qa.manage" audienceScope="office" />;
}
