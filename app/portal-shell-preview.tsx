import { Redirect } from 'expo-router';

/** Compatibility route. The removed legacy portal preview has no parallel UI. */
export default function PortalPreviewRoute() {
  return <Redirect href="/portal/client" />;
}
