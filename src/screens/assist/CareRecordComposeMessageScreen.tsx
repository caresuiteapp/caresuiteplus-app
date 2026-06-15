import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP293 */
export function CareRecordComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={293}
      domain="careRecords"
      permission="assist.records.view"
      audienceScope="office"
    />
  );
}
