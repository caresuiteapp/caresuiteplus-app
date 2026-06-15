import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP533 — Kommunikation Release */
export function ReleaseComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={533}
      domain="release"
      permission="release.manage"
      audienceScope="office"
    />
  );
}
