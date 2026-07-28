import { Redirect } from 'expo-router';

/** Compatibility route. The removed legacy shell preview has no parallel UI. */
export default function ShellPreviewRoute() {
  return <Redirect href="/" />;
}
