import { Redirect } from 'expo-router';

/** TV confirmation is a browser flow; existing native sign-in remains unchanged. */
export default function DeviceConfirmationNativeFallback() {
  return <Redirect href="/auth" />;
}
