import { Redirect } from 'expo-router';

/** German alias → canonical calendar route */
export default function AssistKalenderRedirect() {
  return <Redirect href="/assist/calendar" />;
}
