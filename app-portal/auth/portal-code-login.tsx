import { Redirect } from 'expo-router';

export default function LegacyClientPortalLoginRoute() {
  return <Redirect href="/auth/client-login" />;
}
