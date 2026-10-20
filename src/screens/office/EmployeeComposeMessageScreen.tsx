import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP193 */
export function EmployeeComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={193}
      domain="employees"
      permission="office.employees.view"
      audienceScope="office"
    />
  );
}
