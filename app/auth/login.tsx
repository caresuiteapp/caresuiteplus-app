import { Redirect } from 'expo-router';

export default function LegacyBusinessLoginRedirect() {
  return <Redirect href="/auth/business-login" />;
}
