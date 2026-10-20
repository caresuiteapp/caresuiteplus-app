import { Redirect } from 'expo-router';

/** Compatibility route. The removed legacy portal preview has no parallel UI. */
export default function EmployeePortalShellPreviewRoute() {
  return <Redirect href="/portal/employee" />;
}
