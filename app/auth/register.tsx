import { Redirect, type Href } from 'expo-router';

export default function RegisterRoute() {
  return <Redirect href={'/auth/register-business' as Href} />;
}
