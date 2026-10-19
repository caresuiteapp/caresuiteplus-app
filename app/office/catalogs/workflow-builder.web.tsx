import { Redirect } from 'expo-router';

/** The former prototype did not persist workflows; use the live catalogue. */
export default function CatalogWorkflowRoute() {
  return <Redirect href="/office/catalogs" />;
}
