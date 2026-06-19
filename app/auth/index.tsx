import { Redirect } from 'expo-router';

/** Canonical public entry is `/` (AppStartScreen). Keep `/auth` as a stable alias. */
export default function AuthIndexRedirect() {
  return <Redirect href="/" />;
}
