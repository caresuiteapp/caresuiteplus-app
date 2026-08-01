import { Redirect } from 'expo-router';

export default function OfficeComposeMessageRoute() {
  return <Redirect href="/office/messages?compose=1" />;
}
