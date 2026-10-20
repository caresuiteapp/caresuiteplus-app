import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP373 */
export function PflegeComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={373}
      domain="pflege"
      permission="pflege.plans.view"
      audienceScope="office"
    />
  );
}
