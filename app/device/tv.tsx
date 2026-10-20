import { Redirect } from 'expo-router';

/** QR display is a browser feature; keep the native sign-in entry unchanged. */
export default function TvLoginNativeFallback() {
  return <Redirect href="/auth" />;
}
