import { Redirect } from 'expo-router';

export default function EinsatzCreateRedirect() {
  return <Redirect href="/assist/assignments?create=1" />;
}
