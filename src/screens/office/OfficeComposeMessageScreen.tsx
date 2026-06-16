import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP153 */
export function OfficeComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={153}
      domain="office"
      permission="office.access"
      audienceScope="office"
      enableRecipientSelection
      title="Nachricht verfassen"
      subtitle="Empfänger wählen und Nachricht senden"
    />
  );
}
