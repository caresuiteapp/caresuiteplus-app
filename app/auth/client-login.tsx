import { Redirect, type Href } from 'expo-router';

export default function ClientLoginRoute() {
  return <Redirect href={'/auth/portal-code-login' as Href} />;
}
