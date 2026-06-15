import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP233 */
export function InvoiceComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={233}
      domain="billing"
      permission="office.invoices.view"
      audienceScope="office"
    />
  );
}
