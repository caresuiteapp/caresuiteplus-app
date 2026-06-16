import { Redirect } from 'expo-router';

/** Canonical public portal choice lives at /. */
export default function AuthIndex() {
  return <Redirect href="/" />;
}
