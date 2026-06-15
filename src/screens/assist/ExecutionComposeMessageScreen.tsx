import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP273 */
export function ExecutionComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={273}
      domain="execution"
      permission="assist.execution.view"
      audienceScope="office"
    />
  );
}
