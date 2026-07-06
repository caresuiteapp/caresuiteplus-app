import { Redirect } from 'expo-router';

/** Legacy MA-Portal route — canonical cs_* signatures hub under documents/signatures. */
export default function EmployeePortalSignaturesRedirect() {
  return <Redirect href="/portal/employee/documents/signatures" />;
}
