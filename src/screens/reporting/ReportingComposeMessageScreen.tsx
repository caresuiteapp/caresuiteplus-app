import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP513 — Kommunikation Reporting */
export function ReportingComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={513}
      domain="reporting"
      permission="business.reporting.view"
      audienceScope="office"
    />
  );
}
