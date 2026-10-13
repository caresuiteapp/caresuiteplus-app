import { Redirect } from 'expo-router';

/** Every public company setup entry uses the same free, server-confirmed registration. */
export function CompanySetupScreen() {
  return <Redirect href="/auth/register-business" />;
}
