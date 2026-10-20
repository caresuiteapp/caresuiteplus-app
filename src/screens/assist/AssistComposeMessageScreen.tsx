import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP253 */
export function AssistComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={253}
      domain="assistPlanning"
      permission="assist.assignments.view"
      audienceScope="office"
    />
  );
}
