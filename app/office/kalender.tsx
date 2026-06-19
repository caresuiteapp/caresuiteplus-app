import { Redirect } from 'expo-router';

/** German alias → canonical calendar route */
export default function OfficeKalenderRedirect() {
  return <Redirect href="/office/calendar" />;
}
