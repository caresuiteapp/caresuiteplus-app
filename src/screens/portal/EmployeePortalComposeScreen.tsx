import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP333 */
export function EmployeePortalComposeScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={333}
      domain="employeePortal"
      permission="portal.employee.messages.view"
      audienceScope="portal"
    />
  );
}
