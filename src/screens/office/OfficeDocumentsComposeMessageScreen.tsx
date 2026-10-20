import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP213 */
export function OfficeDocumentsComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={213}
      domain="officeDocs"
      permission="office.documents.view"
      audienceScope="office"
    />
  );
}
